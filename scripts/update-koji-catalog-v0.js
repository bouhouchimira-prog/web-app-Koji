// Mise a jour (24 oct) de la bibliotheque de prix Koji vers le nouveau
// modele compositionnel v0 (KOJI_bibliotheque_ouvrages_v0.xlsx, 448
// ouvrages, 23 familles) — remplace entierement le catalogue v8 (381
// ouvrages, modele a plat). db.kojiOuvrages reste la source vivante
// (voir scripts/migrate-ouvrages-to-db.js, scripts/update-koji-catalog-v8.js) ;
// ce script-ci n'est PAS idempotent, il REMPLACE db.kojiOuvrages par le
// contenu de data/catalog-ouvrages.json (deja regenere avec les nouveaux
// champs : synonyms, nature, sensitivities, parameters, triggers,
// fixedTime, measurementRule, includes/excludes, confidence).
//
// Avant d'ecraser : meme garde que le script v8 — verifie qu'aucun admin
// n'a modifie db.kojiOuvrages directement depuis la derniere mise a jour
// (aucune entree d'historique ouvrage.koji_created/koji_updated/koji_deleted
// posterieure a celle-ci). Si ce n'est plus le cas au moment de
// l'executer, le script s'arrete et affiche le detail plutot que
// d'ecraser a l'aveugle.
//
// Run:
//   node --env-file=.env.local scripts/update-koji-catalog-v0.js
const { createClient } = require("@supabase/supabase-js");
const catalog = require("../data/catalog-ouvrages.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: row, error } = await supabase.from("koji_web_state").select("data").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!row?.data) {
    console.error("koji_web_state introuvable — l'application doit avoir tourné au moins une fois avant ce script.");
    process.exit(1);
  }

  const db = row.data;
  const existingCount = Array.isArray(db.kojiOuvrages) ? db.kojiOuvrages.length : 0;

  const kojiHistory = (db.history || []).filter((h) => (h.type || "").startsWith("ouvrage.koji_"));
  if (kojiHistory.length) {
    console.error(`Arret : ${kojiHistory.length} modification(s) admin directe(s) sur db.kojiOuvrages depuis la derniere mise a jour — verifier manuellement avant de remplacer, sinon ces changements seraient perdus :`);
    kojiHistory.forEach((h) => console.error(`  - ${h.createdAt || ""} ${h.type} ${h.label}`));
    process.exit(1);
  }

  const nextData = { ...db, kojiOuvrages: catalog };

  const { error: updateError } = await supabase
    .from("koji_web_state")
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (updateError) throw updateError;

  console.log(`Terminé. db.kojiOuvrages : ${existingCount} -> ${catalog.length} ouvrage(s) (modele v0 compositionnel).`);
  console.log("Les ouvrages personnalises (db.ouvrages) et les masquages par entreprise (db.deletedOuvrages) ne sont pas touches.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
