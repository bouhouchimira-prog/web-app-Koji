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

// One Stripe Price per plan × billing interval. Created once via
// scripts/stripe-setup.js, then pasted into .env.local (and Vercel).
export const PLAN_PRICE_IDS = {
  go: { month: process.env.STRIPE_PRICE_GO_MONTHLY || "", year: process.env.STRIPE_PRICE_GO_YEARLY || "" },
  premium: { month: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || "", year: process.env.STRIPE_PRICE_PREMIUM_YEARLY || "" },
  business: { month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || "", year: process.env.STRIPE_PRICE_BUSINESS_YEARLY || "" }
};

export function priceIdFor(plan, interval) {
  return PLAN_PRICE_IDS[plan]?.[interval] || "";
}

// Reverse lookup used by the webhook, which only receives a Stripe price id.
export function planFromPriceId(priceId) {
  for (const [plan, byInterval] of Object.entries(PLAN_PRICE_IDS)) {
    for (const [interval, id] of Object.entries(byInterval)) {
      if (id && id === priceId) return { plan, interval };
    }
  }
  return { plan: null, interval: null };
}
