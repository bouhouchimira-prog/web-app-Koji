// Fournitures d'un chantier (maquette PRO-07.1) et stock léger (PRO-07.4).
// La liste découle des lignes du devis : fournitures choisies sur la ligne,
// plus les articles liés à l'ouvrage (consommation par unité × quantité de
// la ligne × perte), avenants signés inclus ; rangée par fournisseur.
import { avecPerte, arrondiConditionnement, fournisseurPrefere, manquesArticle, nombre, prixAchat, r2 } from "./fournitures-pro.js";

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Même clé de ligne que le planning et la fiche chantier.
export function cleLigne(ligne, index) {
  return `${ligne.roomId || ligne.room || "chantier"}-${ligne.taskId || ligne.code || index}`;
}

const codeLigne = (ligne) => String(ligne.code || ligne.ouvrageCode || ligne.taskId || "").toUpperCase();

// Quantité de chaque ligne après les avenants signés (modification :
// nouvelle quantité ; suppression : 0).
export function quantitesApresAvenants(items = [], avenants = []) {
  const map = new Map();
  items.forEach((item, i) => map.set(cleLigne(item, i), { quantite: nombre(item.quantity ?? item.qty, 1), avenant: false }));
  for (const av of avenants) {
    if (av.status !== "Signe") continue;
    for (const l of av.lignes || []) {
      const cle = l.ligneDevisRef;
      if (!cle || !map.has(cle)) continue;
      if (l.type === "suppression") map.set(cle, { quantite: 0, avenant: true, numero: av.numero });
      else if (l.type === "modification" && l.quantiteApres != null) map.set(cle, { quantite: nombre(l.quantiteApres), avenant: true, numero: av.numero });
    }
  }
  return map;
}

function trouverArticle(articles, materiel) {
  if (materiel.productId) {
    const parId = articles.find((a) => a.id === materiel.productId);
    if (parId) return parId;
  }
  const nom = sansAccents(materiel.productName || materiel.name);
  return nom ? articles.find((a) => sansAccents(a.name) === nom) || null : null;
}

// Besoins du chantier, un par article (lots réunis).
export function besoinsChantier({ quote = {}, avenants = [], articles = [] } = {}) {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const quantites = quantitesApresAvenants(items, avenants);
  const parCle = new Map();

  const ajouter = (article, base, { lot, posee, quantite, detail, avenant }) => {
    const cle = article?.id || `nom:${sansAccents(base.name)}`;
    const ex = parCle.get(cle);
    if (ex) {
      ex.posee = r2(ex.posee + posee);
      ex.quantite = r2(ex.quantite + quantite);
      if (!ex.lots.includes(lot)) ex.lots.push(lot);
      ex.avenant = ex.avenant || avenant;
      ex.detail = "";
      return;
    }
    parCle.set(cle, { cle, article, ...base, lots: [lot], posee: r2(posee), quantite: r2(quantite), detail, avenant });
  };

  items.forEach((item, i) => {
    const etat = quantites.get(cleLigne(item, i)) || { quantite: nombre(item.quantity, 1), avenant: false };
    const qLigne = nombre(item.quantity ?? item.qty, 1);
    const facteur = qLigne > 0 ? etat.quantite / qLigne : 0;
    if (!(facteur > 0)) return;
    const lot = String(item.room || "Chantier").trim() || "Chantier";
    const dejaLies = new Set();
    for (const m of item.materialLines || []) {
      if (!(m.productId || m.productName || m.name)) continue;
      const article = trouverArticle(articles, m);
      if (article) dejaLies.add(article.id);
      const q = r2(nombre(m.unitsToBuy ?? m.quantityNeeded) * facteur);
      if (!(q > 0)) continue;
      ajouter(article, {
        name: article?.name || m.productName || m.name || "Fourniture",
        unit: article?.unit || m.unit || "u",
        prixHt: article ? prixAchat(article) : r2(nombre(m.purchasePriceInput)),
        supplierName: m.supplierName || ""
      }, { lot, posee: q, quantite: q, detail: "", avenant: etat.avenant });
    }
    const code = codeLigne(item);
    if (!code) return;
    for (const a of articles) {
      if (dejaLies.has(a.id)) continue;
      const lien = (a.ouvrages || []).find((o) => String(o.code || "").toUpperCase() === code);
      if (!lien) continue;
      const posee = r2(etat.quantite * nombre(lien.conso, 1));
      if (!(posee > 0)) continue;
      const perte = nombre(a.perte);
      const quantite = perte > 0 ? avecPerte(posee, perte) : posee;
      ajouter(a, { name: a.name, unit: a.unit || "u", prixHt: prixAchat(a), supplierName: "" }, {
        lot,
        posee,
        quantite,
        detail: perte > 0 ? `${String(posee).replace(".", ",")} ${a.unit || ""} + ${String(perte).replace(".", ",")} % de perte`.replace(/\s+/g, " ") : "",
        avenant: etat.avenant
      });
    }
  });

  return [...parCle.values()].map((b) => {
    const a = b.article;
    const f = a ? fournisseurPrefere(a) : null;
    const manques = a ? manquesArticle(a) : [b.supplierName ? null : "fournisseur", b.prixHt > 0 ? null : "prix"].filter(Boolean);
    const prixHt = b.prixHt;
    return {
      cle: b.cle,
      articleId: a?.id || "",
      name: b.name,
      ref: f?.ref || a?.ref || "",
      lots: b.lots,
      posee: b.posee,
      quantite: b.quantite,
      unit: b.unit,
      detail: b.detail,
      avenant: b.avenant,
      prixHt,
      totalHt: r2(b.quantite * prixHt),
      supplierId: f?.supplierId || a?.supplierId || "",
      supplierName: f?.supplierName || a?.supplierName || b.supplierName || "",
      contenance: nombre(a?.contenance, 1) || 1,
      uniteCond: a?.uniteCond || "",
      venteUnite: Boolean(a?.venteUnite),
      manques
    };
  });
}

// Rangement par fournisseur ; les articles sans fournisseur ou sans prix
// restent « À compléter » et ne sortent pas sur les bons.
export function rangerParFournisseur(besoins = []) {
  const aCompleter = besoins.filter((b) => b.manques.length > 0);
  const groupes = new Map();
  for (const b of besoins) {
    if (b.manques.length > 0) continue;
    const cle = b.supplierId || `nom:${sansAccents(b.supplierName)}`;
    if (!groupes.has(cle)) groupes.set(cle, { supplierId: b.supplierId, supplierName: b.supplierName, lignes: [], totalHt: 0 });
    const g = groupes.get(cle);
    g.lignes.push(b);
    g.totalHt = r2(g.totalHt + b.totalHt);
  }
  const fournisseurs = [...groupes.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName, "fr"));
  return {
    aCompleter,
    fournisseurs,
    totalHt: r2(fournisseurs.reduce((s, g) => s + g.totalHt, 0)),
    articles: fournisseurs.reduce((s, g) => s + g.lignes.length, 0)
  };
}

// Ce qui est déjà commandé pour ce chantier (bons envoyés), par article.
export function dejaCommande(bons = [], projectId = "") {
  const map = new Map();
  for (const bon of bons) {
    if (bon.projectId !== projectId || bon.etat === "brouillon" || bon.etat === "annule") continue;
    for (const l of bon.lignes || []) {
      const cle = l.articleId || `nom:${sansAccents(l.name)}`;
      map.set(cle, r2((map.get(cle) || 0) + nombre(l.quantiteBesoin ?? l.quantite)));
    }
  }
  return map;
}

// --- Stock léger (PRO-07.4, Business) ---------------------------------

export const LIEUX_MAX = 3;
export const ORIGINES = { chantier: "Reliquat de chantier", arrondi: "Écart d'arrondi au conditionnement", manuel: "Ajout manuel" };
export const SORTIES = { chantier: "Affectation à un chantier", perte: "Perte", casse: "Casse", interne: "Usage interne" };

export function valeurStock(lignes = []) {
  return r2(lignes.reduce((s, l) => s + nombre(l.quantite) * nombre(l.prixHt), 0));
}

// Mois entiers depuis la dernière entrée ou utilisation.
export function moisSansUsage(ligne = {}, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const depuis = String(ligne.utiliseLe || ligne.entreeLe || "").slice(0, 10);
  if (!depuis) return 0;
  const [a1, m1, j1] = depuis.split("-").map(Number);
  const [a2, m2, j2] = aujourdhui.split("-").map(Number);
  let mois = (a2 - a1) * 12 + (m2 - m1);
  if (j2 < j1) mois -= 1;
  return Math.max(0, mois);
}

export const nonUtilise = (ligne, aujourdhui) => moisSansUsage(ligne, aujourdhui) >= 7;

// Fin de chantier : Koji propose commandé − posé ; la casse est décochée.
export function restesProbables({ commandes = [], posees = new Map() } = {}) {
  return commandes
    .map((c) => {
      const pose = nombre(posees.get(c.cle) ?? c.posee);
      const reste = r2(nombre(c.commande) - pose);
      return { ...c, pose, reste, coche: reste > 0 && !c.casse };
    })
    .filter((c) => c.reste > 0 || c.entame);
}

// Avant commande : le stock correspondant ligne par ligne ; seul le reste
// est commandé. Jamais coché d'office quand la teinte peut différer.
const TEINTE = /carrel|faien|gres|parquet|peinture|enduit/;

export function proposerStock(besoins = [], stock = []) {
  return besoins.map((b) => {
    const dispo = stock.filter((s) => (b.articleId && s.articleId === b.articleId) || (!b.articleId && sansAccents(s.name) === sansAccents(b.name)));
    const enStock = r2(dispo.reduce((s, l) => s + nombre(l.quantite), 0));
    if (!(enStock > 0)) return { ...b, enStock: 0, utiliser: 0, coche: false, teinte: false };
    const teinte = TEINTE.test(sansAccents(`${b.name} ${b.famille || ""}`));
    return { ...b, enStock, utiliser: r2(Math.min(enStock, b.quantite)), coche: !teinte, teinte, lieux: [...new Set(dispo.map((d) => d.lieu))] };
  });
}

// Ce qui reste à commander une fois le stock coché pris, au conditionnement.
export function resteACommander(ligne = {}) {
  const pris = ligne.coche ? nombre(ligne.utiliser) : 0;
  const besoin = r2(Math.max(0, nombre(ligne.quantite) - pris));
  const arr = arrondiConditionnement(besoin, ligne.contenance || 1, ligne.venteUnite);
  return { besoin, ...arr, prisHt: r2(pris * nombre(ligne.prixHt)) };
}
