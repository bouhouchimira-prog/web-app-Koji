import { makeToken } from "./db";

// Repartition par defaut (cahier des charges 3.6/4.6 : acompte / avancement
// / solde), utilisee UNIQUEMENT si l'entreprise n'a defini aucune etape de
// paiement sur son devis. Depuis les decisions du 4 septembre, l'entreprise
// definit desormais ses propres etapes dans l'editeur (DevisEditor.jsx,
// panneau "Etapes de paiement", visible seulement sur un devis lie a une
// offre Radar) — c'est quote.paymentMilestones qui prime des qu'il existe ;
// plus jamais de repartition fixe imposee dans ce cas.
const FALLBACK_STEP_SPLIT = [
  { step: "acompte", ratio: 0.3 },
  { step: "avancement", ratio: 0.4 },
  { step: "solde", ratio: 0.3 }
];

function buildSteps(quote) {
  if (Array.isArray(quote.paymentMilestones) && quote.paymentMilestones.length > 0) {
    const sum = quote.paymentMilestones.reduce((s, m) => s + Number(m.percent || 0), 0);
    // Somme incoherente (devis envoye avant validation cote UI, ou modifie
    // hors editeur) : plutot que de creer un echeancier qui ne totalise pas
    // le prix du devis, on retombe sur une seule echeance a 100 % — jamais
    // de split arbitraire invente ici.
    if (Math.round(sum) !== 100) {
      return [{ step: "solde", ratio: 1 }];
    }
    return quote.paymentMilestones.map((m, index) => ({
      step: m.label || `Étape ${index + 1}`,
      ratio: Number(m.percent || 0) / 100
    }));
  }
  return quote.chantierOffreId ? FALLBACK_STEP_SPLIT : [{ step: "solde", ratio: 1 }];
}

// Appele juste apres qu'un devis lie a une offre Radar des Chantiers soit
// signe (memes points d'appel que generateTasksForSignedQuote : signature
// manuelle dans app/api/quotes/route.js et signature client dans
// app/api/signatures/[token]/route.js). Ne fait rien pour un devis "normal"
// (hors Radar des Chantiers, pas de chantierOffreId) ni si les echeances
// existent deja pour ce devis (idempotent).
export function createPaiementEcheancesForQuote(db, quote, now = new Date().toISOString()) {
  if (!quote.chantierOffreId) return;
  if (!Array.isArray(db.chantierPaiements)) db.chantierPaiements = [];
  if (db.chantierPaiements.some((p) => p.quoteId === quote.id)) return;

  const offre = (db.chantierOffres || []).find((entry) => entry.id === quote.chantierOffreId);
  if (!offre) return;

  const totalTtc = Number(quote.totalTtc || 0);
  if (totalTtc <= 0) return;

  const steps = buildSteps(quote);
  let allocated = 0;
  steps.forEach((entry, index) => {
    const isLast = index === steps.length - 1;
    const amountTtc = isLast ? Math.round((totalTtc - allocated) * 100) / 100 : Math.round(totalTtc * entry.ratio * 100) / 100;
    allocated += amountTtc;
    db.chantierPaiements.push({
      id: makeToken("paiement"),
      quoteId: quote.id,
      offerId: offre.id,
      entrepriseUserId: quote.userId,
      particulierUserId: offre.userId,
      step: entry.step,
      amountTtc,
      status: "pending",
      stripePaymentIntentId: "",
      stripeTransferId: "",
      photos: [],
      validatedAt: "",
      createdAt: now
    });
  });
}
