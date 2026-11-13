import { randomUUID } from "node:crypto";
import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { prochainNumero } from "../../../lib/reserves";

// Réserves d'un chantier (maquette PRO-02.3), site et app Koji Pro.
// GET ?projectId= · POST { projectId, titre, lieu, attribueeA, attribueeNom,
// pourLe, photoId } · PATCH { id, action: faite | valider | refuser |
// attribuer, … }. Les dates d'action sont posées par le serveur. Les photos
// passent par /api/chantier-photos (phase « reserve » ou « levee »).
// Seul le titulaire du chantier lit ou modifie ; db.reserves.

async function chantierAMoi(projectId, userId) {
  const { data } = await getSupabaseAdmin().from("chantiers").select("id,user_id").eq("id", projectId).maybeSingle();
  return Boolean(data && data.user_id === userId);
}

function texte(v, max) {
  return String(v || "").trim().slice(0, max);
}

function date(v) {
  const t = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!projectId) return badRequest("Chantier manquant.");
  if (!(await chantierAMoi(projectId, userId))) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();
  const reserves = (db.reserves || [])
    .filter((r) => r.userId === userId && r.projectId === projectId)
    .sort((a, b) => (Number(a.numero.slice(1)) || 0) - (Number(b.numero.slice(1)) || 0));
  return ok({ reserves });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = texte(body.projectId, 80);
  const titre = texte(body.titre, 200);
  if (!projectId || !titre) return badRequest("Décrivez la réserve.");
  if (!(await chantierAMoi(projectId, userId))) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  const duChantier = (db.reserves || []).filter((r) => r.projectId === projectId);
  const reserve = {
    id: randomUUID(),
    userId,
    projectId,
    numero: `R${prochainNumero(duChantier)}`,
    titre,
    lieu: texte(body.lieu, 120),
    attribueeA: texte(body.attribueeA, 80),
    attribueeNom: texte(body.attribueeNom, 120),
    pourLe: date(body.pourLe),
    statut: "a_faire",
    source: "pro",
    photoId: texte(body.photoId, 80),
    photoLeveeId: "",
    note: "",
    creeLe: new Date().toISOString()
  };
  db.reserves = [...(db.reserves || []), reserve];
  await writeDb(db);
  return ok({ reserve }, 201);
}

export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const db = await readDb();
  const index = (db.reserves || []).findIndex((r) => r.id === body.id && r.userId === userId);
  if (index < 0) return badRequest("Réserve introuvable.", 404);
  const r = { ...db.reserves[index] };
  const maintenant = new Date().toISOString();

  switch (body.action) {
    case "faite": // l'intervenant a fait la réserve et l'a photographiée
      if (r.statut === "levee") return badRequest("Cette réserve est déjà levée.");
      r.statut = "faite";
      r.photoLeveeId = texte(body.photoLeveeId, 80) || r.photoLeveeId || "";
      r.note = texte(body.note, 500);
      r.faiteLe = maintenant;
      break;
    case "valider":
      if (r.statut !== "faite") return badRequest("La réserve doit d'abord être faite et photographiée.");
      r.statut = "levee";
      r.leveeLe = maintenant;
      break;
    case "refuser":
      if (r.statut !== "faite") return badRequest("Seule une levée à vérifier peut être refusée.");
      r.statut = "a_faire";
      r.refuseeLe = maintenant;
      r.motifRefus = texte(body.motif, 300);
      break;
    case "attribuer":
      r.attribueeA = texte(body.attribueeA, 80);
      r.attribueeNom = texte(body.attribueeNom, 120);
      if (body.pourLe !== undefined) r.pourLe = date(body.pourLe);
      if (r.statut === "proposee") r.statut = "a_faire";
      break;
    default:
      return badRequest("Action inconnue.");
  }
  db.reserves[index] = r;
  await writeDb(db);
  return ok({ reserve: r });
}
