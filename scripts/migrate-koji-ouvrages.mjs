// migrate-koji-ouvrages.mjs
//
// Verse le catalogue historique dans la table partagee koji_ouvrages
// (migration 0002 + 0007).
//
// Sources (dans l'ordre de priorite) :
//   1. db.kojiOuvrages (catalogue admin-edite, koji_web_state) si non vide
//   2. data/catalog-ouvrages.json (catalogue de base, 448 ouvrages)
//
// Chaque ligne recoit is_shared = true et user_id = null (socle commun).
// Les ouvrages personnels (db.ouvrages) ne sont PAS touches : ils restent
// dans le blob tant que la table ne les porte pas.
//
// Usage :
//   node --env-file=.env.local scripts/migrate-koji-ouvrages.mjs            # dry-run
//   node --env-file=.env.local scripts/migrate-koji-ouvrages.mjs --apply    # ecriture
//
// Idempotent : upsert sur `code`. A executer apres les migrations 0002 et 0007.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function toRow(item) {
  return {
    code: item.code || item.id || null,
    original_id: item.id || null,
    famille: item.family || item.category || "Autre",
    label: item.label || "",
    unite: item.unit || "u",
    prix_unitaire_ht: Number(item.fixedAmountHt || 0) || null,
    temps_unitaire: Number(item.normativeTime || 0) || null,
    hourly_rate: Number(item.hourlyRate || 0) || null,
    coefficient: Number(item.coefficient || 1) || 1,
    metier: item.profession || item.family || null,
    description: item.description || null,
    is_shared: true,
    user_id: null,
    is_active: true,
    updated_at: new Date().toISOString()
  };
}

async function main() {
  console.log(`Mode : ${apply ? "APPLY (ecriture)" : "DRY-RUN (aucune ecriture)"}`);

  // 1. Lire db.kojiOuvrages (catalogue admin-edite)
  const { data: state, error: stateError } = await supabase
    .from("koji_web_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (stateError) throw stateError;

  const adminCatalog = Array.isArray(state?.data?.kojiOuvrages) ? state.data.kojiOuvrages : [];

  // 2. Fallback : catalogue JSON
  const jsonPath = path.join(process.cwd(), "data", "catalog-ouvrages.json");
  const baseCatalog = JSON.parse(await readFile(jsonPath, "utf8"));

  const source = adminCatalog.length > 0 ? adminCatalog : baseCatalog;
  console.log(`Source : ${adminCatalog.length > 0 ? "db.kojiOuvrages (admin-edite)" : "data/catalog-ouvrages.json"}`);
  console.log(`Ouvrages a verser : ${source.length}`);

  const rows = source.filter((o) => o && (o.code || o.id) && o.label).map(toRow);
  console.log(`Lignes valides : ${rows.length}`);

  if (!apply) {
    console.log("\nExemple de ligne :");
    console.log(JSON.stringify(rows[0], null, 2));
    console.log("\nDry-run termine. Relancer avec --apply pour ecrire.");
    return;
  }

  // 3. Upsert par lots de 100
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("koji_ouvrages").upsert(batch, { onConflict: "code" });
    if (error) {
      console.error(`Erreur sur le lot ${i / 100 + 1} :`, error.message);
      process.exit(1);
    }
    written += batch.length;
    console.log(`Lot ${i / 100 + 1} : ${batch.length} lignes (total ${written})`);
  }

  console.log(`\nMigration terminee : ${written} ouvrages dans koji_ouvrages.`);
}

main().catch((err) => {
  console.error("Erreur migration :", err);
  process.exit(1);
});
