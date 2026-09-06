import { addHistory, makeToken } from "./db";

// Garde-fou beta (decisions du 4 septembre) : a chaque devis Radar des
// Chantiers signe, on enregistre l'ecart entre le milieu de la fourchette
// publiee au particulier (app/api/chantier-offres/route.js) et le total
// final accepte par l'entreprise. C'est la mesure de fiabilite qui
// permettra, plus tard, de resserrer la fourchette (+/-15% aujourd'hui).
// Pas de UI de reporting pour l'instant, seule la donnee est collectee.
//
// Meme points d'appel que createPaiementEcheancesForQuote : signature
// manuelle (app/api/quotes/route.js) et signature client
// (app/api/signatures/[token]/route.js). Ne fait rien pour un devis "normal"
// (hors Radar des Chantiers) ni si l'ecart a deja ete enregistre pour ce
// devis (idempotent).
export function recordEstimationAccuracy(db, quote, now = new Date().toISOString()) {
  if (!quote.chantierOffreId) return;
  if (!Array.isArray(db.estimationAccuracy)) db.estimationAccuracy = [];
  if (db.estimationAccuracy.some((entry) => entry.quoteId === quote.id)) return;

  const offre = (db.chantierOffres || []).find((entry) => entry.id === quote.chantierOffreId);
  if (!offre || !Number.isFinite(Number(offre.priceRangeMin)) || !Number.isFinite(Number(offre.priceRangeMax))) return;

  const priceRangeMin = Number(offre.priceRangeMin);
  const priceRangeMax = Number(offre.priceRangeMax);
  const midpoint = (priceRangeMin + priceRangeMax) / 2;
  const totalTtc = Number(quote.totalTtc || 0);
  const ecart = Math.round((totalTtc - midpoint) * 100) / 100;
  const ecartPercent = midpoint > 0 ? Math.round((ecart / midpoint) * 1000) / 10 : null;

  db.estimationAccuracy.push({
    id: makeToken("accuracy"),
    quoteId: quote.id,
    offerId: offre.id,
    expertiseId: offre.expertiseId || "",
    priceRangeMin,
    priceRangeMax,
    midpoint,
    totalTtc,
    ecart,
    ecartPercent,
    createdAt: now
  });

  addHistory(db, {
    userId: "",
    type: "radar.estimation_accuracy",
    label: `Écart expertise/devis final : ${ecart >= 0 ? "+" : ""}${ecart}€${ecartPercent != null ? ` (${ecartPercent}%)` : ""}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { offerId: offre.id, priceRangeMin, priceRangeMax, totalTtc }
  });
}
