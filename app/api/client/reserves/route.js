import { randomUUID } from "node:crypto";
import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { chantierDuClient } from "../../../../lib/portal-acces";
import { auteurPublic } from "../../../../lib/avis";
import { prochainNumero } from "../../../../lib/reserves";
import { jourDeParis, plusAns } from "../../../../lib/cloture-chantier";
import { BUCKET_CHANTIER } from "../../../../lib/cloture-db";

// « Signaler un problème » dans Koji Client après la réception (maquette
// PRO-02.6) : pendant la garantie de parfait achèvement (un an), le
// signalement arrive à l'entreprise comme une réserve « proposée par le
// client » (PRO-02.3), avec sa photo horodatée.

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return badRequest("Requête invalide."); }
  const db = await readDb();
  const r = await chantierDuClient(request, db, form.get("quoteId"));
  if (r.erreur) return badRequest(r.erreur, r.code);
  const { chantier, quote, user } = r;
  const cloture = (db.clotures || []).find((c) => c.projectId === chantier.id && c.userId === chantier.user_id);
  if (!cloture?.pv?.signeLe) return badRequest("Avant la réception, utilisez « Signaler un souci » sur le suivi du chantier.");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (aujourdhui > plusAns(jourDeParis(cloture.pv.signeLe), 1)) return badRequest("La garantie de parfait achèvement est terminée : contactez directement l'entreprise.");

  const titre = String(form.get("texte") || "").trim().slice(0, 200);
  if (!titre) return badRequest("Décrivez le problème.");
  const file = form.get("file");
  if (file && typeof file !== "string") {
    if (!TYPES[file.type]) return badRequest("Photo en JPEG, PNG ou WebP.");
    if (file.size > 8 * 1024 * 1024) return badRequest("Photo trop lourde (8 Mo au plus).");
  }

  const auteur = auteurPublic(user.name || quote.client || "");
  const maintenant = new Date().toISOString();
  const duChantier = (db.reserves || []).filter((x) => x.projectId === chantier.id);
  const reserve = {
    id: randomUUID(),
    userId: chantier.user_id,
    projectId: chantier.id,
    numero: `R${prochainNumero(duChantier)}`,
    titre,
    lieu: String(form.get("lieu") || "").trim().slice(0, 120),
    attribueeA: "",
    attribueeNom: "",
    pourLe: "",
    statut: "proposee",
    source: "client",
    signaleePar: auteur,
    photoId: "",
    photoLeveeId: "",
    note: "",
    creeLe: maintenant
  };

  if (file && typeof file !== "string" && file.size > 0) {
    const id = randomUUID();
    const path = `chantier-photos/${chantier.user_id}/${chantier.id}/${id}.${TYPES[file.type]}`;
    const { error } = await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return badRequest(`Photo non enregistrée : ${error.message}`, 500);
    db.chantierPhotos = [...(db.chantierPhotos || []), { id, userId: chantier.user_id, projectId: chantier.id, lot: "", taskId: "", reserveId: reserve.id, phase: "reserve", path, takenAt: maintenant, author: auteur, source: "client" }];
    reserve.photoId = id;
  }

  db.reserves = [...(db.reserves || []), reserve];
  addHistory(db, { userId: chantier.user_id, type: "chantier.reserve_client", label: `Problème signalé par le client : ${titre}`, entityId: chantier.id, entityType: "project", meta: { projectId: chantier.id, reserveId: reserve.id } });
  await writeDb(db);
  return ok({ reserve: { numero: reserve.numero, titre, creeLe: maintenant } }, 201);
}
