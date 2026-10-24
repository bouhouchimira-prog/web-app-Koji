import Stripe from "stripe";

let client = null;

export const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);

export function getStripe() {
  if (!hasStripe) {
    throw new Error("Stripe n'est pas configuré — définissez STRIPE_SECRET_KEY dans .env.local");
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// 3 paliers (24 oct, page publique /abonnement, maquette Amira) : Start
// (gratuit, aucun prix Stripe), Pro et Business, chacun mensuel/annuel.
// Remplace l'ancien modele 1 plan + 2 addons cumulables (Site web Koji,
// Koji Premium) — ces 2 addons disparaissent de la vente/gestion, mais les
// champs _addonWebsite/_addonPremium restent tels quels dans le modele de
// donnees (dormants, plus jamais ecrits par le webhook). Crees via
// scripts/stripe-setup-3-tiers.js, puis colles dans .env.local (et Vercel).
// Radar des Chantiers reste inclus dans Pro/Business (pas de prix separe) —
// la seule mecanique d'argent du Radar aujourd'hui est l'escrow Stripe
// Connect particulier→entreprise (voir app/api/billing/connect et
// .../offres/[id]/paiement), une capacite Stripe differente de ces
// abonnements. Le systeme de "jetons" affiche sur la page publique n'est
// pas encore relie a Stripe (Phase 2, pas construit).
export const PRO_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
  year: process.env.STRIPE_PRICE_PRO_YEARLY || ""
};

export const BUSINESS_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || "",
  year: process.env.STRIPE_PRICE_BUSINESS_YEARLY || ""
};

export function priceIdFor(plan, interval) {
  const ids = plan === "business" ? BUSINESS_PRICE_IDS : PRO_PRICE_IDS;
  return ids[interval] || "";
}

// Reverse lookup used by the webhook, which only receives Stripe price ids.
export function planAndIntervalFromPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === PRO_PRICE_IDS.month) return { plan: "pro", interval: "month" };
  if (priceId === PRO_PRICE_IDS.year) return { plan: "pro", interval: "year" };
  if (priceId === BUSINESS_PRICE_IDS.month) return { plan: "business", interval: "month" };
  if (priceId === BUSINESS_PRICE_IDS.year) return { plan: "business", interval: "year" };
  return null;
}
