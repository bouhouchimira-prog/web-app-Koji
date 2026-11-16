// Bons de commande fournisseur (maquette PRO-07.6), réception des
// livraisons (PRO-07.5) et mercuriale des partenaires Koji (PRO-07.3).
// Logique pure, testée dans tests/unit/fournitures-bons.test.js.
import { nombre, r2 } from "./fournitures-pro.js";

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const ETATS_BON = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  partiel: "Livré en partie",
  livre: "Livré",
  annule: "Annulé"
};

// Numéro continu par entreprise et par an : BC-2026-031.
export function numeroBon(bons = [], annee = new Date().getFullYear()) {
  const prefixe = `BC-${annee}-`;
  const max = bons
    .map((b) => String(b.numero || ""))
    .filter((n) => n.startsWith(prefixe))
    .map((n) => Number(n.slice(prefixe.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefixe}${String(max + 1).padStart(3, "0")}`;
}

// Bon passé chez un partenaire Koji : numéro Koji global, BC-KJ-2026-0042.
export function numeroBonPartenaire(tousBons = [], annee = new Date().getFullYear()) {
  const prefixe = `BC-KJ-${annee}-`;
  const max = tousBons
    .map((b) => String(b.numeroKoji || ""))
    .filter((n) => n.startsWith(prefixe))
    .map((n) => Number(n.slice(prefixe.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefixe}${String(max + 1).padStart(4, "0")}`;
}

export const totalLigne = (l) => r2(nombre(l.quantite) * nombre(l.prixHt));

export function totauxBon(lignes = [], tauxTva = 20) {
  const ht = r2(lignes.reduce((s, l) => s + totalLigne(l), 0));
  const tva = r2(ht * nombre(tauxTva) / 100);
  return { ht, tva, ttc: r2(ht + tva) };
}

// État d'un bon envoyé d'après ce qui a été pointé à la livraison.
export function etatBon(bon = {}) {
  if (bon.etat === "brouillon" || bon.etat === "annule") return bon.etat;
  const lignes = bon.lignes || [];
  if (!bon.envoyeLe) return "brouillon";
  const livrees = lignes.filter((l) => nombre(l.livre) >= nombre(l.quantite) - 1e-9).length;
  const touchees = lignes.filter((l) => nombre(l.livre) > 0).length;
  if (lignes.length > 0 && livrees === lignes.length) return "livre";
  if (touchees > 0) return "partiel";
  return "envoye";
}

export function resteALivrer(bon = {}) {
  return (bon.lignes || [])
    .filter((l) => nombre(l.livre) < nombre(l.quantite) - 1e-9)
    .map((l) => ({ ...l, quantite: r2(nombre(l.quantite) - nombre(l.livre)), livre: 0 }));
}

// Les trois chiffres du mois de l'onglet Commandes.
export function chiffresBons(bons = [], { mois = new Date().toISOString().slice(0, 7) } = {}) {
  const duMois = bons.filter((b) => String(b.envoyeLe || "").slice(0, 7) === mois);
  const attente = bons.filter((b) => ["envoye", "partiel"].includes(etatBon(b)));
  const ecarts = bons.filter((b) => b.facture && Math.abs(nombre(b.facture.ecartHt)) >= 0.01);
  return {
    envoyes: duMois.length,
    envoyesHt: r2(duMois.reduce((s, b) => s + totauxBon(b.lignes).ht, 0)),
    attente: attente.length,
    attenteFournisseurs: [...new Set(attente.map((b) => b.supplierName).filter(Boolean))],
    ecarts: ecarts.length,
    ecartsHt: r2(ecarts.reduce((s, b) => s + nombre(b.facture.ecartHt), 0))
  };
}

// --- Réception d'une livraison (PRO-07.5) ------------------------------

const mots = (s) => new Set(sansAccents(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((m) => m.length > 1));

function ressemblance(a, b) {
  const x = mots(a);
  const y = mots(b);
  if (!x.size || !y.size) return 0;
  const communs = [...x].filter((m) => y.has(m)).length;
  return communs / Math.min(x.size, y.size);
}

// Compare le bon de livraison lu sur la photo au bon de commande, ligne à
// ligne : conforme, manquant, partiel, cassé ; les lignes en plus sont
// signalées « non commandé ».
export function comparerLivraison(lignesBon = [], lignesLues = []) {
  const restantes = lignesLues.map((l, i) => ({ ...l, i }));
  const out = lignesBon.map((b) => {
    let best = null;
    let bestScore = 0;
    for (const l of restantes) {
      const memeRef = b.ref && l.ref && sansAccents(b.ref) === sansAccents(l.ref);
      const score = memeRef ? 2 : ressemblance(b.name, l.name);
      if (score > bestScore) { best = l; bestScore = score; }
    }
    const lue = bestScore >= 0.5 ? best : null;
    if (lue) restantes.splice(restantes.indexOf(lue), 1);
    const commande = nombre(b.quantite);
    const livre = lue ? nombre(lue.quantite) : 0;
    let etat = "conforme";
    if (lue?.casse) etat = "casse";
    else if (!(livre > 0)) etat = "manquant";
    else if (livre < commande - 1e-9) etat = "partiel";
    return { ligneId: b.id || "", name: b.name, ref: b.ref || "", unit: b.unit || "", commande, livre, etat, defaut: lue?.defaut || "" };
  });
  for (const l of restantes) out.push({ ligneId: "", name: l.name, ref: l.ref || "", unit: l.unit || "", commande: 0, livre: nombre(l.quantite), etat: "en_plus", defaut: "" });
  return out;
}

export const ETATS_LIVRAISON = { conforme: "conforme", manquant: "manquant", partiel: "partiel", casse: "cassé", en_plus: "non commandé" };

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function jourCourt(iso = "") {
  const [a, m, j] = String(iso).slice(0, 10).split("-").map(Number);
  return a && m && j ? `${j} ${MOIS_COURTS[m - 1]}` : "";
}

// Jours ouvrés après une date (samedi et dimanche sautés).
export function plusJoursOuvres(iso, n = 2) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  let reste = n;
  while (reste > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const jour = d.getUTCDay();
    if (jour !== 0 && jour !== 6) reste -= 1;
  }
  return d.toISOString().slice(0, 10);
}

// Nom court pour la réclamation : « Receveur extra-plat 90 × 120 blanc » →
// « receveur 90 × 120 ».
export function nomCourt(nom = "") {
  const t = String(nom).replace(/,.*$/, "").trim();
  const m = t.match(/^(\S+)\s.*?(\d[\d\s×x,.]*\d)/);
  const base = m ? `${m[1]} ${m[2].trim()}` : t;
  return base.charAt(0).toLowerCase() + base.slice(1);
}

export function texteReclamation({ numeroBl = "", date = "", ecarts = [], dateLimite = "" } = {}) {
  const pb = ecarts.filter((e) => ["manquant", "partiel", "casse"].includes(e.etat));
  if (!pb.length) return "";
  const constats = pb.map((e) => {
    const n = nomCourt(e.name);
    if (e.etat === "casse") return `${n} livré avec ${e.defaut || "un défaut"} (photo jointe)`;
    if (e.etat === "manquant") return `${n} manquant`;
    return `${n} : ${String(e.livre).replace(".", ",")} livré(s) sur ${String(e.commande).replace(".", ",")}`;
  });
  const demandes = pb.map((e) => (e.etat === "casse" ? `remplacer le ${nomCourt(e.name).split(" ")[0]}` : `livrer le ${nomCourt(e.name).split(" ")[0]}${e.etat === "partiel" ? " manquant" : ""}`));
  const liste = (xs, lien = "et") => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} ${lien} ${xs[xs.length - 1]}` : xs[0]);
  const limite = dateLimite ? ` avant le ${jourCourt(dateLimite)}` : "";
  const fin = `${liste(demandes, "et de")}${limite}`;
  return `Bonjour, livraison ${numeroBl || "du jour"}${date ? ` du ${jourCourt(date)}` : ""} : ${liste(constats)}. Merci de ${fin}${fin.endsWith(".") ? "" : "."}`;
}

// --- Partenaires Koji (PRO-07.3) --------------------------------------

export const UNITES_MERCURIALE = ["u", "m²", "m2", "ml", "m", "kg", "l", "sac", "boîte", "boite", "seau", "rouleau", "lot", "kit", "couronne", "paquet", "palette"];

export function lireMercurialeCsv(texte = "") {
  const lignes = String(texte).replace(/^﻿/, "").split(/\r?\n/);
  const tete = lignes[0] || "";
  const sep = (tete.match(/;/g) || []).length >= (tete.match(/,/g) || []).length ? ";" : ",";
  const cellules = (l) => {
    const out = [];
    let cur = "";
    let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const t = cellules(tete).map(sansAccents);
  const col = (...noms) => t.findIndex((c) => noms.some((n) => c.includes(n)));
  const idx = {
    ref: col("ref", "code"),
    designation: col("designation", "libelle", "article"),
    conditionnement: col("conditionnement", "colisage"),
    unite: col("unite"),
    prixKoji: col("prix koji", "koji"),
    prixPublic: col("public"),
    validite: col("validite", "valable")
  };
  const rows = [];
  lignes.slice(1).forEach((l, i) => {
    if (!l.trim()) return;
    const c = cellules(l);
    const v = (k) => (idx[k] >= 0 ? c[idx[k]] || "" : "");
    rows.push({
      ligne: i + 2,
      ref: v("ref"),
      designation: v("designation"),
      conditionnement: v("conditionnement"),
      unite: v("unite"),
      prixKoji: r2(nombre(v("prixKoji"))),
      prixPublic: r2(nombre(v("prixPublic"))),
      validite: v("validite")
    });
  });
  return rows;
}

// Contrôles de l'import (back-office) : seules les lignes valides sont
// publiées ; la date de validité est obligatoire.
export function controlerMercuriale(rows = []) {
  const vues = new Map();
  const erreurs = [];
  const valides = [];
  for (const r of rows) {
    const cle = sansAccents(r.designation).replace(/\s+/g, "");
    let probleme = "";
    let action = "Corriger";
    if (!r.designation || !(r.prixKoji > 0)) probleme = "Désignation ou prix Koji manquant";
    else if (!String(r.conditionnement).trim()) probleme = "Conditionnement manquant";
    else if (r.unite && !UNITES_MERCURIALE.includes(sansAccents(r.unite).replace("boite", "boîte")) && !UNITES_MERCURIALE.includes(String(r.unite).toLowerCase())) probleme = `Unité inconnue « ${r.unite} »`;
    else if (r.prixPublic > 0 && r.prixKoji > r.prixPublic) { probleme = "Prix Koji supérieur au prix public"; action = "Vérifier"; }
    else if (vues.has(cle)) { probleme = `Doublon de la ligne ${vues.get(cle)}`; action = "Ignorer"; }
    else if (!String(r.validite).trim()) probleme = "Date de validité absente";
    if (probleme) erreurs.push({ ligne: r.ligne, article: r.designation, probleme, action });
    else { valides.push(r); vues.set(cle, r.ligne); }
  }
  return { lues: rows.length, valides, erreurs };
}

// Écart moyen prix Koji / prix public, en % arrondi (− 28 %).
export function ecartMoyen(articles = []) {
  const avec = articles.filter((a) => nombre(a.prixPublic) > 0 && nombre(a.prixKoji) > 0);
  if (!avec.length) return null;
  const moy = avec.reduce((s, a) => s + (nombre(a.prixKoji) - nombre(a.prixPublic)) / nombre(a.prixPublic), 0) / avec.length;
  return Math.round(moy * 100);
}

// Contenance lue dans le conditionnement : « boîte 1,44 m² » → 1,44 ;
// « sac 25 kg » → 25 (la quantité, pas l'unité client).
export function contenanceDe(conditionnement = "") {
  const m = String(conditionnement).match(/(\d+(?:[.,]\d+)?)/);
  return m ? nombre(m[1], 1) : 1;
}

export function initiales(nom = "") {
  return String(nom).split(/[\s&-]+/).filter((m) => m && /[A-Za-zÀ-ÿ]/.test(m[0]) && m.length > 1).slice(0, 2).map((m) => m[0].toUpperCase()).join("") || "KJ";
}
