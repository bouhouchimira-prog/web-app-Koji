import { randomUUID } from "node:crypto";
import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { phaseDeLegende, PHASES } from "../../../lib/photos-chantier";

// Photos avant / après d'un chantier (maquette PRO-02.2), site et app Koji Pro.
// - POST (multipart) : une photo prise dans l'app ; le serveur pose la date,
//   l'heure et l'auteur (non modifiables). Fichier rangé dans le bucket
//   privé « quote_attachments » (chantier-photos/…), jamais public.
// - GET ?projectId= : les photos du chantier (liens signés valables 1 h),
//   avec celles des compagnons (app ouvriers, table worker_photos).
// Métadonnées dans db.chantierPhotos.
const BUCKET = "quote_attachments";
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const TAILLE_MAX = 8 * 1024 * 1024;
const DUREE_LIEN = 3600;

async function chantierDe(admin, projectId, userId) {
  const { data } = await admin.from("chantiers").select("id,user_id").eq("id", projectId).maybeSingle();
  return data && data.user_id === userId ? data : null;
}

async function nomAuteur(admin, userId) {
  const { data } = await admin.from("users").select("business_info,email").eq("id", userId).maybeSingle();
  const info = data?.business_info || {};
  return String(info._name || info.raisonSociale || data?.email || "Vous").trim();
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!projectId) return badRequest("Chantier manquant.");
  const admin = getSupabaseAdmin();
  if (!(await chantierDe(admin, projectId, userId))) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  const propres = (db.chantierPhotos || []).filter((p) => p.userId === userId && p.projectId === projectId);
  const { data: liens } = propres.length
    ? await admin.storage.from(BUCKET).createSignedUrls(propres.map((p) => p.path), DUREE_LIEN)
    : { data: [] };
  const parChemin = new Map((liens || []).map((l) => [l.path, l.signedUrl]));
  const photos = propres.map((p) => ({
    id: p.id, lot: p.lot || "", taskId: p.taskId || "", reserveId: p.reserveId || "", phase: p.phase, takenAt: p.takenAt,
    author: p.author, source: "pro", url: parChemin.get(p.path) || ""
  }));

  // Photos des compagnons sur ce chantier (app ouvriers).
  try {
    const { data: taches } = await admin.from("scheduled_tasks").select("id,title").eq("chantier_id", projectId);
    const ids = (taches || []).map((t) => t.id);
    if (ids.length) {
      const { data: wp } = await admin.from("worker_photos").select("id,scheduled_task_id,worker_id,storage_path,caption,created_at").in("scheduled_task_id", ids);
      const workerIds = [...new Set((wp || []).map((p) => p.worker_id).filter(Boolean))];
      const { data: workers } = workerIds.length
        ? await admin.from("workers").select("id,first_name,last_name").in("id", workerIds)
        : { data: [] };
      const nom = new Map((workers || []).map((w) => [w.id, `${w.first_name || ""} ${String(w.last_name || "").slice(0, 1)}${w.last_name ? "." : ""}`.trim()]));
      const titre = new Map((taches || []).map((t) => [t.id, t.title]));
      for (const p of wp || []) {
        photos.push({
          id: `w-${p.id}`, lot: "", taskTitle: titre.get(p.scheduled_task_id) || "", phase: phaseDeLegende(p.caption),
          takenAt: p.created_at, author: nom.get(p.worker_id) || "Compagnon", source: "compagnon", caption: p.caption || "",
          url: admin.storage.from("worker-uploads").getPublicUrl(p.storage_path).data.publicUrl
        });
      }
    }
  } catch {
    // Les photos des compagnons sont un complément : leur absence ne bloque pas.
  }

  photos.sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)));
  return ok({ photos });
}

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Envoi invalide.");
  }
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const fichier = form.get("file");
  const projectId = String(form.get("projectId") || "");
  const lot = String(form.get("lot") || "").trim().slice(0, 120);
  const phase = String(form.get("phase") || "");
  const taskId = String(form.get("taskId") || "").slice(0, 120);
  const reserveId = String(form.get("reserveId") || "").slice(0, 120);
  // Une photo de réserve (PRO-02.3) n'a pas de lot ; les autres en ont un.
  if (!projectId || (!lot && !reserveId)) return badRequest("Chantier ou lot manquant.");
  if (!PHASES.includes(phase)) return badRequest("Phase inconnue : avant, pendant ou après.");
  if (!fichier || typeof fichier === "string") return badRequest("Photo manquante.");
  const extension = TYPES[fichier.type];
  if (!extension) return badRequest("Format de photo non accepté (JPEG, PNG, WebP ou HEIC).");
  if (fichier.size > TAILLE_MAX) return badRequest("Photo trop lourde (8 Mo au plus).");

  const admin = getSupabaseAdmin();
  if (!(await chantierDe(admin, projectId, userId))) return badRequest("Chantier introuvable.", 404);

  const id = randomUUID();
  const path = `chantier-photos/${userId}/${projectId}/${id}.${extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type, upsert: false });
  if (error) return badRequest("La photo n'a pas pu être enregistrée.", 500);

  const photo = {
    id, userId, projectId, lot, taskId, reserveId, phase, path,
    takenAt: new Date().toISOString(),
    author: await nomAuteur(admin, userId).catch(() => "Vous")
  };
  const db = await readDb();
  db.chantierPhotos = [...(db.chantierPhotos || []), photo];
  await writeDb(db);

  const { data: lien } = await admin.storage.from(BUCKET).createSignedUrl(path, DUREE_LIEN);
  return ok({ photo: { id, lot, taskId, reserveId, phase, takenAt: photo.takenAt, author: photo.author, source: "pro", url: lien?.signedUrl || "" } }, 201);
}
