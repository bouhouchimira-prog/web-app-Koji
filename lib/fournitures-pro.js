// Fournitures Koji Pro (maquette PRO-07 à 07.2) : prix de vente selon le
// mode choisi par article, marge, conditionnement, pertes et rendement.
// Logique pure, sans base ni réseau : partagée par les routes, la page web
// et testée (tests/unit/fournitures-pro.test.js). L'app Koji Pro porte les
// mêmes règles en Dart (fournitures_logic.dart).

export const MODES_PRIX = {
  public: "Prix public",
  coefficient: "Coefficient sur achat",
  manuel: "Prix manuel"
};

// Coefficient du compte quand un article n'a pas de prix public (décision
// du 30 oct. : le mode par défaut bascule alors sur un coefficient).
export const COEF_COMPTE_DEFAUT = 1.3;

// Pertes par défaut par famille (maquette PRO-07.2 : 5 % en carrelage).
export const PERTES_FAMILLE = {
  carrelage: 5,
  faience: 5,
  parquet: 7,
  peinture: 10,
  plomberie: 0,
  electricite: 5,
  platrerie: 8
};

export const UNITES = ["u", "m²", "ml", "m³", "kg", "l", "sac", "boîte", "seau", "rouleau", "lot", "kit", "couronne"];

export function nombre(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(typeof value === "string" ? value.replace(/[\s  ]/g, "").replace(",", ".") : value);
  return Number.isFinite(n) ? n : fallback;
}

export const r2 = (n) => Math.round((nombre(n) + Number.EPSILON) * 100) / 100;

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function perteFamille(famille = "") {
  const f = sansAccents(famille);
  const cle = Object.keys(PERTES_FAMILLE).find((k) => f.includes(k));
  return cle ? PERTES_FAMILLE[cle] : 0;
}

// Prix d'achat ramené à l'unité client : 69,12 € la boîte de 1,44 m² = 48,00 €/m².
export function achatParUnite(prixConditionnement, contenance = 1) {
  const c = nombre(contenance, 1);
  return r2(nombre(prixConditionnement) / (c > 0 ? c : 1));
}

// Fournisseur préféré (ou le premier) parmi ceux de l'article.
export function fournisseurPrefere(article = {}) {
  const liste = Array.isArray(article.fournisseurs) ? article.fournisseurs : [];
  return liste.find((f) => f.prefere) || liste[0] || null;
}

// Prix d'achat HT à l'unité client : celui du fournisseur préféré, sinon
// le prix d'achat de l'article.
export function prixAchat(article = {}) {
  const f = fournisseurPrefere(article);
  if (f && nombre(f.achat) > 0) return r2(nombre(f.achat));
  return r2(nombre(article.achat));
}

// Mode réellement appliqué : sans prix public, « public » bascule sur le
// coefficient du compte.
// Règle du compte (Mes prix, PRO-08.2) pour les articles laissés « au prix
// public » : prix public (défaut), achat + un pourcentage, ou achat.
export const MODES_COMPTE = { public: "Prix public", coefficient: "Prix d'achat + un pourcentage", achat: "Prix d'achat" };

export function modeEffectif(article = {}, { modeDefaut = "public" } = {}) {
  const mode = MODES_PRIX[article.modePrix] ? article.modePrix : "public";
  if (mode === "public" && (modeDefaut === "coefficient" || modeDefaut === "achat")) return "coefficient";
  if (mode === "public" && !(nombre(article.prixPublic) > 0)) return "coefficient";
  return mode;
}

function coefApplique(article, coefCompte, modeDefaut) {
  if (article.modePrix === "coefficient" && nombre(article.coef) > 0) return nombre(article.coef);
  if (article.modePrix !== "coefficient" && modeDefaut === "achat") return 1;
  return nombre(coefCompte, COEF_COMPTE_DEFAUT) || COEF_COMPTE_DEFAUT;
}

export function prixVente(article = {}, { coefCompte = COEF_COMPTE_DEFAUT, modeDefaut = "public" } = {}) {
  const mode = modeEffectif(article, { modeDefaut });
  if (mode === "manuel") return r2(nombre(article.prixManuel));
  if (mode === "coefficient") return r2(prixAchat(article) * coefApplique(article, coefCompte, modeDefaut));
  return r2(nombre(article.prixPublic));
}

// Marge en € et en % du prix de vente ; écart au prix public signalé.
export function marge(article = {}, options = {}) {
  // options : coefCompte, modeDefaut (règle du compte, Mes prix).
  const vente = prixVente(article, options);
  const achat = prixAchat(article);
  const euros = r2(vente - achat);
  const pct = vente > 0 && achat > 0 ? Math.round((euros / vente) * 100) : null;
  const pub = nombre(article.prixPublic);
  const ecartPublic = pub > 0 ? r2(vente - pub) : null;
  return { vente, achat, euros, pct, ecartPublic };
}

// Libellé de la colonne « Prix » du catalogue : Public, Manuel, × 1,30.
export function libelleMode(article = {}, { coefCompte = COEF_COMPTE_DEFAUT, modeDefaut = "public" } = {}) {
  const mode = modeEffectif(article, { modeDefaut });
  if (mode === "manuel") return "Manuel";
  if (mode === "public") return "Public";
  const coef = coefApplique(article, coefCompte, modeDefaut);
  return coef === 1 ? "Achat" : `× ${coef.toFixed(2).replace(".", ",")}`;
}

// Un article ne sort sur un bon que s'il a un fournisseur et un prix.
export function manquesArticle(article = {}) {
  const manques = [];
  if (!fournisseurPrefere(article) && !article.supplierId) manques.push("fournisseur");
  if (!(prixAchat(article) > 0)) manques.push("prix");
  return manques;
}

export const articleComplet = (article) => manquesArticle(article).length === 0;

// Quantité avec la perte, arrondie au dixième supérieur : 5,8 m² + 5 % = 6,1 m².
export function avecPerte(quantite, pertePct = 0) {
  const q = nombre(quantite) * (1 + nombre(pertePct) / 100);
  return Math.ceil(r2(q) * 10 - 1e-9) / 10;
}

// Commande arrondie au conditionnement : 6,1 m² en boîtes de 1,44 m² →
// 5 boîtes (7,20 m²). Vente à l'unité : pas d'arrondi au paquet.
export function arrondiConditionnement(quantite, contenance = 1, venteUnite = false) {
  const q = nombre(quantite);
  const c = nombre(contenance, 1);
  if (venteUnite || !(c > 0) || c === 1) {
    const unites = Math.ceil(q - 1e-9);
    return { paquets: unites, quantite: unites, ecart: r2(unites - q) };
  }
  const paquets = Math.ceil(q / c - 1e-9);
  const total = r2(paquets * c);
  return { paquets, quantite: total, ecart: r2(total - q) };
}

// Rendement d'un produit qui se consomme au m² : un sac de 25 kg couvre
// 5 m² → 5 kg/m² ; 14,2 m² à 4 m²/sac → 3,55 sacs → 4 sacs.
export function rendement(quantiteConditionnement, couvre) {
  const q = nombre(quantiteConditionnement);
  const c = nombre(couvre);
  return c > 0 ? r2(q / c) : 0;
}

export function paquetsPourSurface(surface, couvreParPaquet) {
  const c = nombre(couvreParPaquet);
  if (!(c > 0)) return { exact: 0, paquets: 0 };
  const exact = r2(nombre(surface) / c);
  return { exact, paquets: Math.ceil(exact - 1e-9) };
}

// Code interne proposé : famille + désignation (« GC6060-R »), modifiable.
export function codeInterne(designation = "", existants = []) {
  const mots = sansAccents(designation).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const lettres = mots.filter((m) => !/^\d/.test(m) && m.length > 2).slice(0, 2).map((m) => m[0]).join("").toUpperCase();
  const chiffres = mots.filter((m) => /^\d/.test(m)).slice(0, 2).join("");
  let base = [lettres || "ART", chiffres].filter(Boolean).join("");
  if (!base) base = "ART";
  const pris = new Set(existants.map((c) => String(c).toUpperCase()));
  if (!pris.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) if (!pris.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now() % 1000}`;
}

// Articles proches (variante de teinte ou doublon) : mêmes mots principaux.
export function articlesProches(designation = "", articles = [], exclureId = "") {
  const mots = (s) => new Set(sansAccents(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((m) => m.length > 1));
  const cible = mots(designation);
  if (cible.size < 2) return [];
  return articles
    .filter((a) => a.id !== exclureId)
    .map((a) => {
      const autres = mots(a.name);
      const communs = [...cible].filter((m) => autres.has(m)).length;
      return { article: a, score: communs / Math.max(cible.size, autres.size) };
    })
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.article);
}

// Tarif fournisseur importé (CSV) : référence, désignation, achat, public,
// conditionnement. Séparateur ; ou , ; montants « 1 234,56 ».
export function lireTarifCsv(texte = "") {
  const lignes = String(texte).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return { lignes: [], erreurs: ["Fichier vide."] };
  const sep = (lignes[0].match(/;/g) || []).length >= (lignes[0].match(/,/g) || []).length ? ";" : ",";
  const cellules = (l) => {
    const out = [];
    let cur = "";
    let quote = false;
    for (const ch of l) {
      if (ch === '"') quote = !quote;
      else if (ch === sep && !quote) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const tete = cellules(lignes[0]).map(sansAccents);
  const col = (...noms) => tete.findIndex((t) => noms.some((n) => t.includes(n)));
  const iRef = col("ref", "code", "article");
  const iNom = col("designation", "libelle", "produit", "nom");
  const iAchat = col("achat", "net", "prix pro", "remise");
  const iPublic = col("public", "ppi", "brut", "catalogue");
  const iCond = col("condition", "colisage", "contenance");
  if (iRef < 0 || (iAchat < 0 && iPublic < 0)) return { lignes: [], erreurs: ["Colonnes attendues : référence, et prix d'achat ou prix public."] };
  const out = [];
  const erreurs = [];
  lignes.slice(1).forEach((l, i) => {
    const c = cellules(l);
    const ref = c[iRef] || "";
    if (!ref) { erreurs.push(`Ligne ${i + 2} : référence absente.`); return; }
    out.push({
      ref,
      designation: iNom >= 0 ? c[iNom] || "" : "",
      achat: iAchat >= 0 ? r2(nombre(c[iAchat])) : 0,
      public: iPublic >= 0 ? r2(nombre(c[iPublic])) : 0,
      conditionnement: iCond >= 0 ? c[iCond] || "" : ""
    });
  });
  return { lignes: out, erreurs };
}

// Applique un tarif aux articles dont une référence fournisseur correspond.
export function appliquerTarif(articles = [], lignes = [], { supplierId = "" } = {}) {
  const parRef = new Map(lignes.map((l) => [sansAccents(l.ref).replace(/\s+/g, ""), l]));
  const majs = [];
  for (const a of articles) {
    const refs = [a.ref, ...(a.fournisseurs || []).filter((f) => !supplierId || f.supplierId === supplierId).map((f) => f.ref)].filter(Boolean);
    const ligne = refs.map((r) => parRef.get(sansAccents(r).replace(/\s+/g, ""))).find(Boolean);
    if (!ligne) continue;
    majs.push({ id: a.id, ref: ligne.ref, achat: ligne.achat, public: ligne.public });
  }
  return majs;
}

// Les quatre chiffres de la page Fournitures.
export function chiffresFournitures({ articles = [], besoins = [], bons = [], aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const incomplets = articles.filter((a) => !articleComplet(a) || !(prixVente(a) > 0)).length;
  const aCommander = besoins.filter((b) => b.aCommanderHt > 0);
  const commandes = bons.filter((b) => b.etat === "envoye" || b.etat === "partiel");
  const debut = new Date(`${aujourdhui}T12:00:00Z`);
  debut.setUTCDate(debut.getUTCDate() - 30);
  const depuis = debut.toISOString().slice(0, 10);
  let vente = 0;
  let achat = 0;
  for (const b of bons) {
    if (!b.envoyeLe || b.envoyeLe.slice(0, 10) < depuis) continue;
    for (const l of b.lignes || []) {
      if (!(nombre(l.venteHt) > 0)) continue;
      vente += nombre(l.venteHt) * nombre(l.quantite);
      achat += nombre(l.prixHt) * nombre(l.quantite);
    }
  }
  let source = "bons";
  if (!(vente > 0)) {
    source = "catalogue";
    for (const a of articles) {
      const m = marge(a);
      if (m.vente > 0 && m.achat > 0) { vente += m.vente; achat += m.achat; }
    }
  }
  return {
    aCommander: aCommander.length,
    aCommanderHt: r2(aCommander.reduce((s, b) => s + b.aCommanderHt, 0)),
    commandes: commandes.length,
    prochaineLivraison: commandes.map((b) => b.livraisonLe).filter(Boolean).sort()[0] || "",
    incomplets,
    margeMoyenne: vente > 0 ? Math.round(((vente - achat) / vente) * 100) : null,
    margeSource: source
  };
}
