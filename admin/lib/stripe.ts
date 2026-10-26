import Stripe from 'stripe'

export const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY)

let client: Stripe | null = null

export function getStripe() {
  if (!hasStripe) {
    throw new Error("Stripe n'est pas configuré — définissez STRIPE_SECRET_KEY dans .env.local")
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY as string)
  return client
}

// Memes 4 ids de prix que cote koji-web (lib/stripe.js, memes Produits
// Stripe "Koji Pro"/"Koji Business" crees par scripts/stripe-setup-3-tiers.js)
// — coller les memes valeurs dans .env.local ici que celles deja en place
// cote koji-web.
export const PRO_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  year: process.env.STRIPE_PRICE_PRO_YEARLY || ''
}
export const BUSINESS_PRICE_IDS = {
  month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
  year: process.env.STRIPE_PRICE_BUSINESS_YEARLY || ''
}
