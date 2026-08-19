// One-time migration: flags every account that already exists as
// "_grandfathered" so it keeps unlimited (Koji Business-level) access once
// real Stripe plan tracking goes live — see lib/user-profile.js's
// buildWebUser, which only falls back to the "trial" plan (with real quote
// limits) for accounts that are neither grandfathered nor subscribed.
//
// Idempotent: skips any row that's already grandfathered or already has a
// real billing plan, so it's safe to run more than once.
//
// Run once, before (or right after) deploying the Stripe integration:
//   node --env-file=.env.local scripts/grandfather-existing-users.js
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: users, error } = await supabase.from("users").select("id, business_info");
  if (error) throw error;

  let updated = 0;
  let skipped = 0;
  for (const user of users || []) {
    const info = user.business_info || {};
    if (info._grandfathered || info._billingPlan) {
      skipped += 1;
      continue;
    }
    const nextInfo = { ...info, _grandfathered: true };
    const { error: updateError } = await supabase
      .from("users")
      .update({ business_info: nextInfo })
      .eq("id", user.id);
    if (updateError) {
      console.error(`Échec pour ${user.id}: ${updateError.message}`);
      continue;
    }
    updated += 1;
  }

  console.log(`Terminé. ${updated} compte(s) marqué(s) "grandfathered" (accès illimité conservé), ${skipped} déjà à jour.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
