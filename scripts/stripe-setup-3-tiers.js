// One-time setup (24 oct) : cree les produits/prix Stripe pour le nouveau
// modele a 3 paliers (page publique /abonnement, maquette Amira) — Pro et
// Business, mensuel + annuel. Start est gratuit, aucun produit Stripe.
// Remplace scripts/stripe-setup.js (ancien modele 1 plan + 2 addons,
// jamais execute — aucun produit "Koji Pro"/addon n'existe encore sur le
// compte Stripe au moment d'ecrire ce script, verifie via l'API avant de
// lancer).
//
// Montants (maquette, HT) : Pro 29 €/mois ou 276 €/an (23 €/mois equivalent,
// "2 mois offerts" implicite). Business 59 €/mois ou 564 €/an (47 €/mois
// equivalent).
//
// Run (mode TEST d'abord) :
//   node --env-file=.env.local scripts/stripe-setup-3-tiers.js
const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY manquant. Ajoutez-le dans .env.local avant de lancer ce script.");
  process.exit(1);
}

const stripe = new Stripe(key);

const PRO_MONTHLY_CENTS = 2900;   // 29,00 €
const PRO_YEARLY_CENTS = 27600;   // 276,00 € (23 €/mois equivalent)
const BUSINESS_MONTHLY_CENTS = 5900; // 59,00 €
const BUSINESS_YEARLY_CENTS = 56400; // 564,00 € (47 €/mois equivalent)

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

  const businessProduct = await stripe.products.create({ name: "Koji Business" });
  const business = await createRecurringPrices(businessProduct, BUSINESS_MONTHLY_CENTS, BUSINESS_YEARLY_CENTS, "Koji Business");
  console.log(`Koji Business: produit ${businessProduct.id} (mensuel ${business.monthly.id}, annuel ${business.yearly.id})`);

  console.log("\nAjoutez ces lignes à .env.local, puis sur Vercel (Project Settings → Environment Variables) :\n");
  console.log([
    `STRIPE_PRICE_PRO_MONTHLY=${pro.monthly.id}`,
    `STRIPE_PRICE_PRO_YEARLY=${pro.yearly.id}`,
    `STRIPE_PRICE_BUSINESS_MONTHLY=${business.monthly.id}`,
    `STRIPE_PRICE_BUSINESS_YEARLY=${business.yearly.id}`
  ].join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
