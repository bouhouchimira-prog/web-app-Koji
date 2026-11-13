import { fixText } from "./text.js";

// Taux par métier (démarrage guidé, étape 3 ; app/api/entreprise/taux),
// rangés par famille d'ouvrage : { ELEC: 60, PEI: 50, … } en € HT/h.
// lib/ouvrages.js les applique à la bibliothèque de l'entreprise.

export function indexFamilles(familles = []) {
  return {
    parNom: new Map(familles.map((f) => [fixText(f.name), f.code])),
    codes: new Set(familles.map((f) => f.code))
  };
}

// Famille d'un ouvrage : son code de famille, sinon le nom de sa famille,
// sinon le préfixe de son code (« PLO-WC-02 » → PLO).
export function codeFamille(item, index) {
  if (item.familyCode) return item.familyCode;
  const parNom = index.parNom.get(fixText(item.family || ""));
  if (parNom) return parNom;
  const prefixe = String(item.code || "").split("-")[0].toUpperCase();
  return index.codes.has(prefixe) ? prefixe : "";
}

// Un ouvrage au temps sans taux propre prend le taux de sa famille ; à
// défaut, les devis et le Radar gardent le taux de l'entreprise (taux
// journalier), comme avant. Un taux propre à l'ouvrage l'emporte toujours.
export function appliquerTauxMetiers(liste, parFamille, index) {
  if (!parFamille || !Object.keys(parFamille).length) return liste;
  return liste.map((item) => {
    if (item.billingMode === "fixed" || Number(item.hourlyRate) > 0) return item;
    const taux = Number(parFamille[codeFamille(item, index)]);
    return taux > 0 ? { ...item, hourlyRate: taux, tauxSource: "metier" } : item;
  });
}
