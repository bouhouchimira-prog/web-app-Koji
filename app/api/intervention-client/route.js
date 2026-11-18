import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { buildWebUser } from "../../../lib/user-profile";
import { addCompanyNotification } from "../../../lib/worker-portal";
import { etapeDe, heureParis, messagePrix, suiviClient } from "../../../lib/intervention-rapide";

// Page du client d'une intervention rapide (PRO-17.1) : il lit les prix
// envoyés par l'artisan et les accepte par écrit, puis suit l'intervention.
// Accès par le lien reçu (jeton), sans compte.
async function trouver(token) {
  const t = String(token || "");
  if (t.length < 20) return null;
  const db = await readDb();
  const i = (db.interventions || []).find((x) => x.rapide && x.token === t);
  return i ? { db, i } : null;
}

async function entreprise(userId) {
  try {
    const { data } = await getSupabaseAdmin().from("users").select("*").eq("id", userId).maybeSingle();
    const u = data ? buildWebUser({ id: data.id, email: data.email || "", profile: data }) : null;
    return { nom: u?.business?.raisonSociale || u?.name || "Votre artisan", telephone: u?.business?.telephone || u?.phone || "" };
  } catch { return { nom: "Votre artisan", telephone: "" }; }
}

async function vue(i) {
  const e = await entreprise(i.userId);
  return {
    entreprise: e.nom,
    telephone: e.telephone,
    client: i.client,
    probleme: i.probleme,
    adresse: i.site,
    prix: messagePrix({ entreprise: e.nom, prix: i.prix || {} }),
    etape: etapeDe(i),
    suivi: suiviClient(i),
    accepteLe: i.accepteLe ? heureParis(i.accepteLe) : "",
    arriveeVers: i.arriveeVers || ""
  };
}

export async function GET(request) {
  const r = await trouver(new URL(request.url).searchParams.get("t"));
  if (!r) return badRequest("Lien inconnu ou expiré.", 404);
  return ok(await vue(r.i));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const r = await trouver(body.t);
  if (!r) return badRequest("Lien inconnu ou expiré.", 404);
  const { db, i } = r;
  if (body.action !== "accepter") return badRequest("Action inconnue.");
  if (i.annuleeLe) return badRequest("Cette intervention a été annulée.");
  if (!i.prix) return badRequest("Aucun prix à accepter.");
  if (!i.accepteLe) {
    i.accepteLe = new Date().toISOString();
    i.updatedAt = i.accepteLe;
    addCompanyNotification(db, { userId: i.userId, type: "company.intervention_acceptee", title: `${i.client} a accepté vos prix`, message: `${i.probleme || "Intervention"} · ${i.site}`, actionUrl: `/interventions/rapide/${i.id}`, actionLabel: "Ouvrir l'intervention" });
    addHistory(db, { userId: i.userId, type: "intervention.prix_acceptes", label: `Prix acceptés par écrit : ${i.client}`, entityId: i.id, entityType: "intervention" });
    await writeDb(db);
  }
  return ok(await vue(i));
}
