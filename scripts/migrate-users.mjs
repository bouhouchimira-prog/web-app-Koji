// migrate-users.mjs
//
// Porte les comptes particuliers (stockes dans particulier_users_state,
// JSONB) vers la table unifiee Supabase `users` (migration 0006).
//
// Chaque ligne recoit account_type = 'particulier' et is_pro = false.
// Idempotent : upsert sur id.
//
// Usage :
//   node --env-file=.env.local scripts/migrate-users.mjs            # dry-run
//   node --env-file=.env.local scripts/migrate-users.mjs --apply     # ecriture

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log(`Mode : ${apply ? "APPLY (ecriture)" : "DRY-RUN (aucune ecriture)"}`);

  // Lire particulier_users_state (table JSONB dediee)
  const { data: state, error: stateError } = await supabase
    .from("particulier_users_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (stateError) throw stateError;
  const users = Array.isArray(state?.data) ? state.data : [];
  console.log(`Comptes particuliers trouves : ${users.length}`);

  if (users.length === 0) {
    console.log("Aucun compte a migrer.");
    return;
  }

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email || "",
    full_name: u.name || "",
    is_pro: false,
    is_admin: false,
    is_profile_complete: Boolean(u.isProfileComplete),
    is_business_info_complete: Boolean(u.isBusinessInfoComplete),
    is_active: u.isActive !== false,
    account_type: "particulier",
    portal_identifier: u.portalIdentifier || null,
    created_at: u.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  console.log(`Lignes a verser : ${rows.length}`);

  if (!apply) {
    console.log("\nExemple de ligne :");
    console.log(JSON.stringify(rows[0], null, 2));
    console.log("\nDry-run termine. Relancer avec --apply pour ecrire.");
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("users").upsert(batch, { onConflict: "id" });
    if (error) {
      console.error(`Erreur sur le lot ${i / 100 + 1} :`, error.message);
      process.exit(1);
    }
    written += batch.length;
    console.log(`Lot ${i / 100 + 1} : ${batch.length} lignes (total ${written})`);
  }

  console.log(`\nMigration terminee : ${written} comptes dans users.`);
}

main().catch((err) => {
  console.error("Erreur migration :", err);
  process.exit(1);
});
