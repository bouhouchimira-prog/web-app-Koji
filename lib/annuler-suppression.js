// Message « Annuler » pendant 10 secondes après une suppression (maquette
// PRO-19.1). Gardé au niveau du module pour survivre au changement de page
// (chaque page monte son propre Shell).
export const DUREE_ANNULER_MS = 10000;
let enCours = null;
const abonnes = new Set();

export function annoncerSuppression({ label, annuler }) {
  enCours = { id: Date.now(), label, annuler, jusqua: Date.now() + DUREE_ANNULER_MS };
  abonnes.forEach((f) => f(enCours));
}
export function suppressionEnCours() {
  return enCours && enCours.jusqua > Date.now() ? enCours : null;
}
export function oublierSuppression() {
  enCours = null;
  abonnes.forEach((f) => f(null));
}
export function abonnerSuppression(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
