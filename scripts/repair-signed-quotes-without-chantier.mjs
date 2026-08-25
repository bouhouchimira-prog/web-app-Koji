// One-time repair: finds devis marked "Signe" that have no linked chantier
// (chantier_id is null) — a gap that existed until the fix in
// lib/quote-projects.js's ensureChantierForQuote (signing a devis created
// outside a chantier used to silently create nothing). Creates the missing
// chantier for each one and links it back to the devis, so it appears in
// Chantiers. Self-contained (no lib/ imports — Node's plain ESM resolver
// can't follow this repo's extensionless imports the way Next's bundler
// does), so this mirrors the chantier-creation half of the real fix only;
// the devis's own items still show up once opened.
//
// Run once: node --env-file=.env.local scripts/repair-signed-quotes-without-chantier.mjs
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function fixText(value) {
  return String(value || "").trim();
}

async function main() {
  const { data: rows, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("status", "Signe")
    .is("chantier_id", null);
  if (error) throw new Error(error.message);

  console.log(`${(rows || []).length} devis signe(s) sans chantier trouve(s).`);
  if (!rows || rows.length === 0) return;

  let fixed = 0;
  for (const row of rows) {
    const metadata = row.metadata || {};
    const extras = row.web_extras || {};
    const client = metadata.client || {};
    const reference = fixText(extras.projectReference || extras.project || row.reference || "Chantier");

    const { data: chantier, error: chantierError } = await supabase
      .from("chantiers")
      .insert({
        user_id: row.user_id,
        reference,
        street: fixText(metadata.siteAddress || ""),
        client_email: client.email || "",
        status: "Signe"
      })
      .select("id")
      .single();
    if (chantierError || !chantier) {
      console.error(`Echec creation chantier pour devis ${row.reference} (${row.id}): ${chantierError?.message}`);
      continue;
    }

    await supabase.from("chantier_budgets").insert({
      chantier_id: chantier.id,
      main_oeuvre_estimated: 0,
      main_oeuvre_real: 0,
      fourniture_estimated: 0,
      fourniture_real: 0
    });

    const { error: updateError } = await supabase.from("quotes").update({ chantier_id: chantier.id }).eq("id", row.id);
    if (updateError) {
      console.error(`Echec liaison devis ${row.reference}: ${updateError.message}`);
      continue;
    }

    fixed += 1;
    console.log(`OK: devis ${row.reference} -> chantier ${chantier.id}`);
  }

  console.log(`Termine. ${fixed}/${rows.length} devis corrige(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
