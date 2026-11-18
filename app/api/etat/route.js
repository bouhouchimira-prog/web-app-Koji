import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { getSupabaseAdmin } from "../../../lib/supabase";

// État du service (maquette PRO-22) : vérifié en direct (données de Koji et
// base des comptes), et les derniers incidents notés dans db.incidents
// ({ le, texte }). Public, sans aucune donnée de compte.
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  let donnees = false;
  let comptes = false;
  let incidents = [];
  try {
    const db = await readDb();
    donnees = true;
    incidents = (Array.isArray(db.incidents) ? db.incidents : [])
      .filter((i) => i?.le && i?.texte)
      .sort((a, b) => String(b.le).localeCompare(String(a.le)))
      .slice(0, 3)
      .map((i) => ({ le: String(i.le).slice(0, 10), texte: String(i.texte).slice(0, 200) }));
  } catch { donnees = false; }
  try {
    const { error } = await getSupabaseAdmin().from("users").select("id", { head: true, count: "exact" }).limit(1);
    comptes = !error;
  } catch { comptes = false; }
  const fonctionne = donnees && comptes;
  return ok({ fonctionne, texte: fonctionne ? "Tout fonctionne" : "Service perturbé", verifieLe: new Date().toISOString(), dureeMs: Date.now() - t0, incidents });
}
