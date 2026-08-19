// One-time setup: creates the Koji GO/Premium/Business Stripe Products, each
// with a monthly and an annual Price, then prints the price ids to paste
// into .env.local (and later into Vercel's env vars).
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

// Annual price = 10x the monthly price (2 months offerts). Adjust the cents
// amounts here if the pricing changes before running this script.
const PLANS = [
  { id: "go", name: "Koji GO", monthlyCents: 1999, yearlyCents: 19990 },
  { id: "premium", name: "Koji Premium", monthlyCents: 4999, yearlyCents: 49990 },
  { id: "business", name: "Koji Business", monthlyCents: 9999, yearlyCents: 99990 }
];

async function main() {
  const envLines = [];
  for (const plan of PLANS) {
    const product = await stripe.products.create({ name: plan.name });
    const monthly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: plan.monthlyCents,
      recurring: { interval: "month" },
      nickname: `${plan.name} — mensuel`
    });
    const yearly = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: plan.yearlyCents,
      recurring: { interval: "year" },
      nickname: `${plan.name} — annuel`
    });
    console.log(`${plan.name}: produit ${product.id} (mensuel ${monthly.id}, annuel ${yearly.id})`);
    envLines.push(`STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY=${monthly.id}`);
    envLines.push(`STRIPE_PRICE_${plan.id.toUpperCase()}_YEARLY=${yearly.id}`);
  }

  console.log("\nAjoutez ces lignes à .env.local, puis sur Vercel (Project Settings → Environment Variables) :\n");
  console.log(envLines.join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
