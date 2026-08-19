// One-time setup: creates the Koji Pro product (monthly + annual price) and
// the Site web Koji add-on product (monthly + annual price), then prints the
// price ids to paste into .env.local (and later into Vercel's env vars).
//
// Run once, in TEST mode first:
//   node --env-file=.env.local scripts/stripe-setup.js
//
// Safe to re-run: it always creates NEW products/prices (Stripe prices are
// immutable), so only run it again if you actually want a fresh set — e.g.
// once more when switching from a test-mode key to a live-mode key.
const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY manquant. Ajoutez-le dans .env.local avant de lancer ce script.");
  process.exit(1);
}

const stripe = new Stripe(key);

// Placeholder price — change this before running the script if you land on
// a different number. Annual price = 10x the monthly price (2 mois offerts).
const PRO_MONTHLY_CENTS = 4999; // 49,99 €
const PRO_YEARLY_CENTS = PRO_MONTHLY_CENTS * 10;

const WEBSITE_MONTHLY_CENTS = 1499; // 14,99 €
const WEBSITE_YEARLY_CENTS = WEBSITE_MONTHLY_CENTS * 10;

async function createRecurringPrices(product, monthlyCents, yearlyCents, name) {
  const monthly = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: monthlyCents,
    recurring: { interval: "month" },
    nickname: `${name} — mensuel`
  });
  const yearly = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: yearlyCents,
    recurring: { interval: "year" },
    nickname: `${name} — annuel`
  });
  return { monthly, yearly };
}

async function main() {
  const proProduct = await stripe.products.create({ name: "Koji Pro" });
  const pro = await createRecurringPrices(proProduct, PRO_MONTHLY_CENTS, PRO_YEARLY_CENTS, "Koji Pro");
  console.log(`Koji Pro: produit ${proProduct.id} (mensuel ${pro.monthly.id}, annuel ${pro.yearly.id})`);

  const websiteProduct = await stripe.products.create({ name: "Site web Koji" });
  const website = await createRecurringPrices(websiteProduct, WEBSITE_MONTHLY_CENTS, WEBSITE_YEARLY_CENTS, "Site web Koji");
  console.log(`Site web Koji: produit ${websiteProduct.id} (mensuel ${website.monthly.id}, annuel ${website.yearly.id})`);

  console.log("\nAjoutez ces lignes à .env.local, puis sur Vercel (Project Settings → Environment Variables) :\n");
  console.log([
    `STRIPE_PRICE_PRO_MONTHLY=${pro.monthly.id}`,
    `STRIPE_PRICE_PRO_YEARLY=${pro.yearly.id}`,
    `STRIPE_PRICE_WEBSITE_MONTHLY=${website.monthly.id}`,
    `STRIPE_PRICE_WEBSITE_YEARLY=${website.yearly.id}`
  ].join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
