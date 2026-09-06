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

// Single paid plan (Koji Pro) × billing interval, plus one optional add-on
// (Site web Koji). Created once via scripts/stripe-setup.js, then pasted
// into .env.local (and Vercel). Radar des Chantiers access is included in
// Koji Pro (no separate price) — the paid part of that module is the
// staged escrow payment between particulier and entreprise, via Stripe
// Connect (see app/api/billing/connect and .../offres/[id]/paiement),
// a different Stripe capability from the subscription helpers below.
export const PRO_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
  year: process.env.STRIPE_PRICE_PRO_YEARLY || ""
};

export const WEBSITE_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_WEBSITE_MONTHLY || "",
  year: process.env.STRIPE_PRICE_WEBSITE_YEARLY || ""
};

export function priceIdFor(interval) {
  return PRO_PRICE_IDS[interval] || "";
}

export function addonPriceIdFor(interval) {
  return WEBSITE_PRICE_IDS[interval] || "";
}

export function isWebsitePriceId(priceId) {
  return Boolean(priceId) && (priceId === WEBSITE_PRICE_IDS.month || priceId === WEBSITE_PRICE_IDS.year);
}

// Reverse lookup used by the webhook, which only receives Stripe price ids.
export function intervalFromProPriceId(priceId) {
  if (priceId === PRO_PRICE_IDS.month) return "month";
  if (priceId === PRO_PRICE_IDS.year) return "year";
  return null;
}
