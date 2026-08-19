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
// into .env.local (and Vercel). Marketplace has no price yet — it's shown
// as "bientôt disponible" and isn't sellable through Stripe.
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
