// Bibliothèque Koji Pro (maquettes PRO-08 à 08.3) : main-d'œuvre d'un
// ouvrage, sensibilité aux facteurs de situation, contrôles de création,
// taux par métier, taux déduits des factures. Logique pure, testée dans
// tests/unit/bibliotheque.test.js ; l'app porte les mêmes règles en Dart.
import { SITUATION_FACTORS } from "./situation-factors.js";

const n = (v, d = 0) => {
  if (v === null || v === undefined || v === "") return d;
  const x = Number(typeof v === "string" ? v.replace(/[\s  ]/g, "").replace(",", ".") : v);
  return Number.isFinite(x) ? x : d;
};
export const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Sensibilité d'un ouvrage à un facteur : les valeurs du catalogue Koji.
export const NIVEAUX_SENSIBILITE = [
  { id: "nulle", label: "Nulle", valeur: 0 },
  { id: "faible", label: "Faible", valeur: 0.3 },
  { id: "moyenne", label: "Moyenne", valeur: 0.5 },
  { id: "forte", label: "Forte", valeur: 1 }
];
export function niveauSensibilite(valeur) {
  const v = n(valeur);
  return NIVEAUX_SENSIBILITE.reduce((best, x) => (Math.abs(x.valeur - v) < Math.abs(best.valeur - v) ? x : best), NIVEAUX_SENSIBILITE[0]);
}

// Facteurs affichés dans la fiche, dans l'ordre de la maquette, avec une
// situation d'exemple (la valeur réelle vient des réponses du Devis guidé).
export const FACTEURS_FICHE = [
  { key: "ACC", nom: "Accès", aide: "étage sans ascenseur, stationnement", exemple: 2 },
  { key: "EXI", nom: "Exiguïté", aide: "pièce", exemple: 1 },
  { key: "HSP", nom: "Hauteur", aide: "> 2,70 m sous plafond", exemple: 1 },
  { key: "OCC", nom: "Occupation", aide: "logement occupé", exemple: 1 },
  { key: "SUP", nom: "Support", aide: "ancien revêtement conservé", exemple: 1 },
  { key: "STO", nom: "Stockage", aide: "pas de zone de stockage", exemple: 1 },
  { key: "HOR", nom: "Horaires", aide: "horaires contraints", exemple: 1 }
];

// Multiplicateur d'un facteur pour un ouvrage : 1 + (valeur − 1) × sensibilité
// (même formule que lib/pricing.js).
export const multiplicateur = (valeurFacteur, sensibilite) => 1 + (n(valeurFacteur, 1) - 1) * n(sensibilite);

export function facteursSensibles(ouvrage = {}) {
  const s = ouvrage.sensitivities || {};
  return FACTEURS_FICHE.filter((f) => n(s[f.key]) > 0).map((f) => {
    const def = SITUATION_FACTORS.find((x) => x.key === f.key);
    const option = def?.options[Math.min(f.exemple, (def?.options.length || 1) - 1)] || { label: "", value: 1 };
    return { ...f, sensibilite: n(s[f.key]), niveau: niveauSensibilite(s[f.key]), situation: option.label, multiplicateur: r2(multiplicateur(option.value, s[f.key])) };
  });
}

// Taux appliqué : propre à l'ouvrage, sinon celui du métier, sinon défaut.
export function tauxOuvrage(ouvrage = {}, { tauxFamille = 0, tauxDefaut = 0 } = {}) {
  return n(ouvrage.hourlyRate) || n(tauxFamille) || n(tauxDefaut);
}

// Main-d'œuvre par unité en conditions de référence : temps × taux ×
// coefficient × (1 − réduction) ; le temps fixe est à part, par intervention.
export function moOuvrage(ouvrage = {}, taux = 0) {
  const coef = n(ouvrage.coefficient, 1) || 1;
  const reduction = Math.min(100, Math.max(0, n(ouvrage.discount)));
  const facteur = coef * (1 - reduction / 100);
  return {
    parUnite: r2(n(ouvrage.normativeTime) * n(taux) * facteur),
    fixe: r2(n(ouvrage.fixedTime) * n(taux) * facteur),
    facteur
  };
}

// Aperçu d'une ligne de devis : MO (temps × quantité + temps fixe) et
// fournitures liées au prix de vente.
export function apercuLigne(ouvrage = {}, { taux = 0, quantite = 1, fournitures = [] } = {}) {
  const mo = moOuvrage(ouvrage, taux);
  const moTotal = r2(mo.parUnite * n(quantite) + mo.fixe);
  const four = r2(fournitures.reduce((s, f) => s + n(f.conso) * (1 + n(f.perte) / 100) * n(quantite) * n(f.vente), 0));
  const heures = r2(n(ouvrage.normativeTime) * n(quantite) + n(ouvrage.fixedTime));
  return { mo: moTotal, fournitures: four, total: r2(moTotal + four), heures };
}

// Exemple en situation : les facteurs s'appliquent au temps de base
// seulement, le temps fixe reste tel quel.
export function exempleSituation(ouvrage = {}, taux = 0, situations = []) {
  const mo = moOuvrage(ouvrage, taux);
  const produit = situations.reduce((p, s) => p * n(s.multiplicateur, 1), 1);
  return { produit: r2(produit), mo: r2(mo.parUnite * produit + mo.fixe) };
}

// Exiguïté en fonction de la surface d'une pièce (même échelle que le Devis guidé).
export function valeurExiguite(surface) {
  const s = n(surface);
  return s > 0 && s < 4 ? 1.2 : s < 10 ? 1.1 : 1;
}

// Code proposé : préfixe de la famille et numéro libre (PLO-160).
export function prochainCode(familyCode = "", codes = []) {
  const p = String(familyCode || "PERSO").toUpperCase();
  const pris = new Set(codes.map((c) => String(c).toUpperCase()));
  const nums = codes.map((c) => String(c).toUpperCase().match(new RegExp(`^${p}-(\\d+)$`))).filter(Boolean).map((m) => Number(m[1]));
  let next = nums.length ? Math.ceil((Math.max(...nums) + 1) / 10) * 10 : 10;
  while (pris.has(`${p}-${String(next).padStart(3, "0")}`)) next += 10;
  return `${p}-${String(next).padStart(3, "0")}`;
}

// Libellé à verbe d'action : « Poser », « Réaliser », « Créer »…
const VERBES = /^(poser|deposer|realiser|creer|fournir|installer|remplacer|raccorder|peindre|enduire|poncer|demolir|evacuer|monter|tirer|couler|ragreer|carreler|isoler|habiller|nettoyer|proteger|percer|fixer|regler|mettre|reprendre|traiter|appliquer|tracer|decouper|assembler|demonter|ouvrir|fermer|boucher|refaire|renover|preparer|calfeutrer|etancher|cabler|brancher|dresser|lisser|vitrifier|cirer|vernir|tapisser|demousser|nettoyer)\b/;
export const verbeAction = (label = "") => VERBES.test(sansAccents(label)) || /^[a-zà-ÿ]+(er|ir|re)\b/i.test(sansAccents(label).split(" ")[0] || "");

// Unité la plus fréquente de la famille.
export function uniteFamille(ouvrages = [], familyCode = "") {
  const compte = new Map();
  for (const o of ouvrages) if ((o.familyCode || String(o.code).split("-")[0]) === familyCode) compte.set(o.unit, (compte.get(o.unit) || 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

export function ouvragesProches(label = "", ouvrages = [], exclureId = "") {
  const mots = (s) => new Set(sansAccents(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((m) => m.length > 3));
  const cible = mots(label);
  if (cible.size < 2) return [];
  return ouvrages
    .filter((o) => o.id !== exclureId)
    .map((o) => {
      const autres = mots(o.label);
      const communs = [...cible].filter((m) => autres.has(m)).length;
      return { o, score: communs / Math.min(cible.size, Math.max(1, autres.size)) };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.o);
}

export function controlesOuvrage(ouvrage = {}, ouvrages = []) {
  const unite = uniteFamille(ouvrages, ouvrage.familyCode);
  const proches = ouvragesProches(ouvrage.label, ouvrages, ouvrage.id);
  return [
    { ok: verbeAction(ouvrage.label), texte: verbeAction(ouvrage.label) ? "Libellé à verbe d'action" : "Commencez le libellé par un verbe d'action (Poser, Réaliser…)" },
    { ok: !unite || unite === ouvrage.unit, texte: !unite || unite === ouvrage.unit ? "Unité cohérente avec la famille" : `Unité inhabituelle pour la famille (souvent « ${unite} »)` },
    { ok: ouvrage.confidence !== "C", texte: ouvrage.confidence === "C" ? "Temps en confiance C : à chronométrer" : `Temps en confiance ${ouvrage.confidence || "B"}` },
    proches.length
      ? { ok: false, texte: `Doublon possible : ${proches.map((p) => `${p.code} « ${p.label} »`).join(", ")}` }
      : { ok: true, texte: "Aucun doublon proche" }
  ];
}

// Recherche : code, libellé, synonymes, famille.
export function rechercherOuvrages(ouvrages = [], q = "") {
  const t = sansAccents(q);
  if (!t) return ouvrages;
  const mots = t.split(/\s+/).filter(Boolean);
  return ouvrages.filter((o) => {
    const texte = sansAccents([o.code, o.label, o.family, ...(o.synonyms || [])].join(" "));
    return mots.every((m) => texte.includes(m) || texte.includes(m.replace(/er$/, "")));
  });
}

// --- Taux par métier (PRO-08.2) ----------------------------------------

// État d'un taux : validé (date), à confirmer, à régler (Koji utilise la
// valeur par défaut de la famille en attendant).
export function etatTaux({ taux = 0, valideLe = "", defaut = 0 } = {}) {
  if (n(taux) > 0 && valideLe) return { etat: "valide", texte: `validé le ${valideLe}` };
  if (n(taux) > 0) return { etat: "a_confirmer", texte: "à confirmer" };
  return { etat: "a_regler", texte: `Koji utilise ${n(defaut)} € en attendant` };
}

// Calculateur : (charges + revenu) ÷ heures facturées par an.
export function tauxMinimumDetail({ charges, revenu, heuresParSemaine, semaines }) {
  const total = n(charges) + n(revenu);
  const heures = n(heuresParSemaine) * n(semaines);
  if (!(total > 0) || !(heures > 0)) return null;
  return { total: r2(total), heures: r2(heures), taux: Math.ceil(total / heures) };
}

// --- Taux d'après les factures (PRO-08.3) ------------------------------

// Une ligne de facture : prix − fournitures au prix public = main-d'œuvre ;
// ÷ (quantité × temps de la bibliothèque) = taux implicite.
export function tauxLigne({ total, quantite, fournituresParUnite = 0, temps }) {
  const q = n(quantite);
  const t = n(temps);
  if (!(q > 0) || !(t > 0) || !(n(total) > 0)) return null;
  const fournitures = r2(n(fournituresParUnite) * q);
  const mo = r2(n(total) - fournitures);
  if (!(mo > 0)) return null;
  const heures = r2(q * t);
  return { fournitures, mo, heures, taux: Math.round((mo / heures) * 10) / 10 };
}

const mediane = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (s, q) => {
  if (!s.length) return 0;
  const pos = (s.length - 1) * q;
  const b = Math.floor(pos);
  return s[b + 1] !== undefined ? s[b] + (pos - b) * (s[b + 1] - s[b]) : s[b];
};

// Taux d'un métier = médiane de ses lignes, lignes très éloignées écartées
// (hors 1,5 × écart interquartile) ; fourchette = 1er et 3e quartiles ;
// confiance selon le nombre de lignes et la dispersion.
export function statsMetier(taux = []) {
  const s = taux.filter((t) => t > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const gardes = s.filter((t) => t >= q1 - 1.5 * iqr && t <= q3 + 1.5 * iqr);
  const med = Math.round(mediane(gardes));
  const bas = Math.floor(quantile(gardes, 0.25));
  const haut = Math.ceil(quantile(gardes, 0.75));
  const dispersion = med > 0 ? (haut - bas) / med : 1;
  const confiance = gardes.length >= 20 && dispersion <= 0.3 ? "forte" : gardes.length >= 10 ? "moyenne" : "faible";
  return { lignes: gardes.length, ecartees: s.length - gardes.length, taux: med, bas, haut, confiance };
}

// Ce que Koji propose pour un métier ; jamais appliqué sans validation.
export function propositionMetier(stats, regle = 0, tolerance = 0.05) {
  if (!stats) return null;
  const r = n(regle);
  if (stats.confiance === "faible") return { action: "confirmer", libelle: "Confirmer", texte: "Peu de lignes : à confirmer par vous.", taux: stats.taux };
  if (!(r > 0)) return { action: "appliquer", libelle: "Appliquer", texte: `Aucun taux réglé : Koji propose ${stats.taux} €.`, taux: stats.taux };
  if (stats.taux > r * (1 + tolerance)) return { action: "appliquer", libelle: "Appliquer", texte: "Votre taux réglé est trop bas.", taux: stats.taux };
  if (stats.taux < r * (1 - tolerance)) return { action: "garder", libelle: `Garder ${r} €`, texte: "Vos factures sont sous votre taux : devis récents trop bas ?", taux: r };
  return { action: "rien", libelle: "Rien à changer", texte: "Vos factures confirment votre taux.", taux: r };
}

// « Vos devis carrelage sont trop bas d'environ 17 % » (Ce que Koji a appris).
export function ecartPct(regle, deduit) {
  const r = n(regle);
  const d = n(deduit);
  return r > 0 && d > 0 ? Math.round(((d - r) / d) * 100) : null;
}
