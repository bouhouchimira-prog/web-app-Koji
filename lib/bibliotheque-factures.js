// Taux d'après les factures (maquette PRO-08.3) : chaque ligne lue est
// rattachée à un ouvrage de la bibliothèque ; prix − fournitures au prix
// public = main-d'œuvre ; ÷ (quantité × temps de l'ouvrage) = taux
// implicite ; taux du métier = médiane. Logique pure (tests/unit).
import { METIERS_DEMARRAGE } from "./demarrage.js";
import { ecartPct, propositionMetier, r2, statsMetier, tauxLigne } from "./bibliotheque-pro.js";

const n = (v, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

export const QUESTIONS_MAX = 3;

export function metierDeFamille(familyCode = "") {
  return METIERS_DEMARRAGE.find((m) => m.familles.includes(familyCode)) || null;
}

// Fournitures par unité d'ouvrage au prix public (ou de vente à défaut),
// d'après les articles liés à l'ouvrage (PRO-07).
export function fournituresParUnite(code, articles = []) {
  const liees = articles.filter((a) => (a.ouvrages || []).some((o) => String(o.code).toUpperCase() === String(code).toUpperCase()));
  const total = liees.reduce((s, a) => {
    const lien = a.ouvrages.find((o) => String(o.code).toUpperCase() === String(code).toUpperCase());
    const prix = n(a.prixPublic) > 0 ? n(a.prixPublic) : n(a.vente);
    return s + n(lien.conso, 1) * (1 + n(a.perte) / 100) * prix;
  }, 0);
  return { parUnite: r2(total), noms: liees.map((a) => a.name), connues: liees.length > 0 };
}

// Calcule chaque ligne ; les lignes non comprises reçoivent une question
// (3 au plus pour toute l'analyse), les autres sont écartées.
export function calculerLignes(lignes = [], ouvrages = [], articles = [], { questionsDejaPosees = 0 } = {}) {
  const parCode = new Map(ouvrages.map((o) => [String(o.code).toUpperCase(), o]));
  let questions = questionsDejaPosees;
  return lignes.map((l) => {
    const o = l.code ? parCode.get(String(l.code).toUpperCase()) : null;
    const base = { ...l, code: o?.code || "", ouvrage: o?.label || "", familyCode: o?.familyCode || String(o?.code || "").split("-")[0], unite: l.unite || o?.unit || "" };
    let motif = "";
    if (!o) motif = "Ligne non rattachée à un ouvrage";
    else if (!(n(l.quantite) > 0)) motif = "Forfait sans quantité";
    else if (!(n(o.normativeTime) > 0)) motif = "Ouvrage sans temps dans la bibliothèque";
    const four = o && l.fourni ? fournituresParUnite(o.code, articles) : { parUnite: 0, noms: [], connues: true };
    if (!motif && l.fourni && !four.connues) motif = "Fourniture comprise, mais aucune fourniture liée à l'ouvrage";
    const calc = !motif ? tauxLigne({ total: l.total, quantite: l.quantite, fournituresParUnite: four.parUnite, temps: o.normativeTime }) : null;
    if (!motif && !calc) motif = "Prix trop bas une fois les fournitures déduites";
    const metier = o ? metierDeFamille(base.familyCode) : null;
    if (motif) {
      const question = questions < QUESTIONS_MAX ? (questions += 1, motif === "Forfait sans quantité" ? `« ${l.designation} » : quelle quantité, et quel ouvrage ?` : `« ${l.designation} » : à quel ouvrage correspond cette ligne ?`) : "";
      return { ...base, statut: question ? "a_verifier" : "ecartee", motif, question };
    }
    return { ...base, statut: "ok", metier: metier?.metier || "", activite: metier?.activite || "", fournitures: calc.fournitures, fournituresNoms: four.noms, mo: calc.mo, heures: calc.heures, taux: calc.taux, temps: o.normativeTime };
  });
}

// Synthèse par métier : taux déduit, fourchette, confiance, proposition.
export function syntheseMetiers(lignes = [], { tauxParMetier = {}, valides = {}, defauts = {} } = {}) {
  const groupes = new Map();
  for (const l of lignes) {
    if (l.statut !== "ok" || !l.metier) continue;
    if (!groupes.has(l.metier)) groupes.set(l.metier, []);
    groupes.get(l.metier).push(l.taux);
  }
  return METIERS_DEMARRAGE.filter((m) => groupes.has(m.metier)).map((m) => {
    const stats = statsMetier(groupes.get(m.metier));
    const regle = n(tauxParMetier[m.metier]);
    const proposition = propositionMetier(stats, regle);
    return { metier: m.metier, activite: m.activite, ...stats, regle, valideLe: valides[m.metier] || "", defaut: n(defauts[m.metier]), proposition, ecart: ecartPct(regle, stats?.taux) };
  }).sort((a, b) => b.lignes - a.lignes);
}

// Exemple affiché dans « Comment Koji calcule » : la ligne au total le plus
// élevé parmi celles comprises.
export function ligneExemple(lignes = []) {
  return lignes.filter((l) => l.statut === "ok").sort((a, b) => n(b.total) - n(a.total))[0] || null;
}
