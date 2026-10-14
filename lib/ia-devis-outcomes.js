import { makeToken } from "./db";

// Devis "100% IA" (app/api/devis-ia/route.js, quote.mode === "ia_complet") :
// on enregistre l'issue de chaque devis qui atteint un etat terminal
// (envoye/accepte vs archive/annule/supprime), avec les lots/items generes
// et le total final apres modifications eventuelles de l'entreprise. Sert
// de matiere premiere pour enrichir la bibliotheque de prix plus tard —
// pas de systeme d'apprentissage construit maintenant, juste la donnee
// collectee et exploitable (meme principe que lib/estimation-accuracy.js).
//
// Appele aux memes points d'action que le reste de app/api/quotes/route.js.
// Ne fait rien pour un devis du chemin manuel (mode !== "ia_complet"), pour
// une action qui n'est pas un etat terminal, ni si une issue a deja ete
// enregistree pour ce devis (idempotent).
const ACCEPTED_ACTIONS = new Set(["send", "accept-manually"]);
const REFUSED_ACTIONS = new Set(["archive", "cancel", "delete", "refuse"]);

export function recordIaDevisOutcome(db, quote, action, now = new Date().toISOString()) {
  if (quote.mode !== "ia_complet") return;

  const outcome = ACCEPTED_ACTIONS.has(action) ? "accepted" : REFUSED_ACTIONS.has(action) ? "refused" : null;
  if (!outcome) return;

  if (!Array.isArray(db.iaDevisOutcomes)) db.iaDevisOutcomes = [];
  if (db.iaDevisOutcomes.some((entry) => entry.quoteId === quote.id)) return;

  db.iaDevisOutcomes.push({
    id: makeToken("iaoutcome"),
    quoteId: quote.id,
    entrepriseUserId: quote.userId,
    action,
    outcome,
    rooms: quote.rooms || [],
    items: quote.items || [],
    lotDetails: quote.iaLotDetails || null,
    totalHt: Number(quote.totalHt || 0),
    totalTtc: Number(quote.totalTtc || 0),
    createdAt: now
  });
}
