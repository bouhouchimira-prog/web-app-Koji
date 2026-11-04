// migrate-subscriptions.mjs
//
// Porte les abonnements Stripe existants (stockes dans users.business_info
// sous _billingPlan/_billingInterval/_billingStatus/_stripeCustomerId/
// _stripeSubscriptionId) dans la table unifiee `subscriptions`
// (source='stripe'). Idempotent : upsert sur (user_id, source).
//
// Usage :
//   node --env-file=.env.local scripts/migrate-subscriptions.mjs            # dry-run
//   node --env-file=.env.local scripts/migrate-subscriptions.mjs --apply     # ecriture

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function splitBusinessInfo(bi) {
  const extras = {};
  for (const [k, v] of Object.entries(bi || {})) {
    if (k.startsWith("_")) extras[k] = v;
  }
  return extras;
}

async function main() {
  console.log(`Mode : ${apply ? "APPLY (ecriture)" : "DRY-RUN (aucune ecriture)"}`);

  const { data: users, error } = await supabase.from("users").select("id, email, business_info");
  if (error) throw error;

  const rows = [];
  for (const u of users || []) {
    const extras = splitBusinessInfo(u.business_info);
    const billingPlan = extras._billingPlan;
    if (!billingPlan) continue; // pas d'abonnement stripe
    rows.push({
      user_id: u.id,
      plan: billingPlan,
      status: extras._billingStatus || "active",
      source: "stripe",
      interval: extras._billingInterval || null,
      external_id: extras._stripeSubscriptionId || extras._stripeCustomerId || null,
      current_period_end: null,
      updated_at: new Date().toISOString()
    });
  }

  console.log(`Utilisateurs avec abonnement Stripe : ${rows.length}`);

  if (!apply) {
    console.log("\nExemple de ligne :");
    if (rows[0]) console.log(JSON.stringify(rows[0], null, 2));
    console.log("\nDry-run termine. Relancer avec --apply pour ecrire.");
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error: upsertError } = await supabase.from("subscriptions").upsert(batch, { onConflict: "user_id,source" });
    if (upsertError) {
      console.error(`Erreur sur le lot ${i / 100 + 1} :`, upsertError.message);
      process.exit(1);
    }
    written += batch.length;
    console.log(`Lot ${i / 100 + 1} : ${batch.length} lignes (total ${written})`);
  }

  console.log(`\nMigration terminee : ${written} abonnements dans subscriptions.`);
}

main().catch((err) => {
  console.error("Erreur migration :", err);
  process.exit(1);
});
