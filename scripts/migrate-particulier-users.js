// Migration unique (4 oct) : deplace db.users du gros bloc koji_web_state
// vers sa propre table particulier_users_state (voir lib/particulier-users.js
// et supabase_web_setup.sql). Idempotent — rejouable sans risque de doublon
// (ecrase simplement la table users avec le contenu actuel du bloc, puis
// retire users du bloc).
//
// Usage : node --env-file=.env.local scripts/migrate-particulier-users.js
import { getSupabaseAdmin } from "../lib/supabase.js";

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: stateRow, error: readError } = await supabase
    .from("koji_web_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (readError) throw readError;
  if (!stateRow) {
    console.log("koji_web_state vide — rien a migrer.");
    return;
  }

  const users = Array.isArray(stateRow.data.users) ? stateRow.data.users : [];
  console.log(`${users.length} compte(s) particulier trouve(s) dans koji_web_state.`);

  const { error: upsertError } = await supabase
    .from("particulier_users_state")
    .upsert({ id: 1, data: users, updated_at: new Date().toISOString() });
  if (upsertError) throw upsertError;
  console.log("Copie dans particulier_users_state : OK.");

  const { users: _omit, ...rest } = stateRow.data;
  const { error: writeError } = await supabase
    .from("koji_web_state")
    .upsert({ id: 1, data: rest, updated_at: new Date().toISOString() });
  if (writeError) throw writeError;
  console.log("users retire de koji_web_state : OK. Migration terminee.");
}

main().catch((err) => {
  console.error("Echec de la migration :", err.message);
  process.exit(1);
});
