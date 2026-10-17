// Garde-fou beta (decisions du 4 septembre), mesurait l'ecart entre le
// milieu de la fourchette de prix publiee au particulier et le total final
// accepte par l'entreprise. Fourchette retiree le 17 oct (decision d'Amira
// : chaque entreprise a son propre taux journalier, plus aucun prix annonce
// a l'avance) — la mesure elle-meme n'a donc plus de sens, no-op gardee
// pour ne pas casser les deux call sites qui l'importent encore
// (app/api/quotes/route.js et app/api/signatures/[token]/route.js).
export function recordEstimationAccuracy(db, quote, now = new Date().toISOString()) {}
