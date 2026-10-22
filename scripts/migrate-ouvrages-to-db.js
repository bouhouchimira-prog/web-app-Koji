// One-time migration (21 oct) : fait passer le catalogue de base Koji
// (data/catalog-ouvrages.json, ~360 ouvrages) dans koji_web_state
// (db.kojiOuvrages), pour que les comptes admin puissent le modifier sans
// deploiement de code — voir lib/ouvrages.js::mergedOuvrages.
//
// Reinitialise aussi db.deletedOuvrages au nouveau format scope-par-
// entreprise ({ouvrageId, userId}) : les anciennes suppressions globales
// (simples chaines d'id) s'appliquaient a TOUT LE MONDE avant cette date —
// elles sont honorees ici en excluant directement ces ouvrages du
// catalogue migre, ce qui preserve exactement le meme comportement visible
// pour tous les comptes plutot que de les reporter telles quelles dans un
// format qui n'a plus de sens.
//
// Les ouvrages personnalises existants (db.ouvrages) ne sont PAS modifies :
// ils ont deja un champ userId (pose a leur creation), donc ils deviennent
// automatiquement scopes a leur veritable createur des que le nouveau code
// d'app/api/ouvrages/route.js est deploye — rien a transformer ici. Les
// items sans userId (tres anciens, ou crees manuellement en base) sont
// seulement signales pour verification manuelle, jamais touches.
//
// Idempotent : si db.kojiOuvrages est deja peuple, ne fait rien.
//
// Run once, apres avoir deploye ce changement :
//   node --env-file=.env.local scripts/migrate-ouvrages-to-db.js
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
  if (Array.isArray(db.kojiOuvrages) && db.kojiOuvrages.length) {
    console.log(`Rien à faire : db.kojiOuvrages contient déjà ${db.kojiOuvrages.length} ouvrage(s).`);
    return;
  }

  const legacyDeletedIds = new Set((db.deletedOuvrages || []).filter((entry) => typeof entry === "string"));
  const kojiOuvrages = catalog.filter((item) => !legacyDeletedIds.has(item.id));

  const customOuvrages = Array.isArray(db.ouvrages) ? db.ouvrages : [];
  const withoutOwner = customOuvrages.filter((item) => !item.userId);

  const nextData = {
    ...db,
    kojiOuvrages,
    // Les suppressions globales sont deja honorees ci-dessus (exclues du
    // catalogue migre) ; on repart sur une liste vide au nouveau format
    // {ouvrageId, userId}, rempli au fur et a mesure des nouvelles
    // suppressions propres a chaque entreprise.
    deletedOuvrages: []
  };

  const { error: updateError } = await supabase
    .from("koji_web_state")
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (updateError) throw updateError;

  console.log(`Terminé. ${kojiOuvrages.length} ouvrage(s) du catalogue de base migré(s) dans db.kojiOuvrages (sur ${catalog.length} au total, ${legacyDeletedIds.size} exclu(s) car déjà masqué(s) globalement avant cette date).`);
  console.log(`${customOuvrages.length} ouvrage(s) personnalisé(s) existant(s) conservé(s) tels quels — ils deviennent automatiquement propres à leur créateur (champ userId déjà présent).`);
  if (withoutOwner.length) {
    console.warn(`Attention : ${withoutOwner.length} ouvrage(s) personnalisé(s) n'ont AUCUN userId et deviendront invisibles pour tout le monde tant qu'ils ne seront pas réassignés manuellement :`);
    withoutOwner.forEach((item) => console.warn(`  - ${item.id} (${item.code} — ${item.label})`));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
