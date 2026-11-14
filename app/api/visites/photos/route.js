import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Photos du mode visite (maquette PRO-03.8) : envoyées depuis l'app au
// retour du réseau, une par une. Rangées dans le bucket privé
// « quote_attachments » (visites/…), jamais publiques ; l'heure de prise
// vient du téléphone (« prisLe »), l'heure de réception est posée ici.
const BUCKET = "quote_attachments";
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const TAILLE_MAX = 8 * 1024 * 1024;
const id = (v) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);

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
  const visiteId = id(form.get("visiteId"));
  const photoId = id(form.get("photoId"));
  const pieceId = id(form.get("pieceId"));
  const pointId = id(form.get("pointId"));
  const prisLe = Number.isFinite(new Date(String(form.get("prisLe") || "")).getTime()) ? new Date(String(form.get("prisLe"))).toISOString() : "";
  if (!visiteId || !photoId) return badRequest("Visite ou photo manquante.");
  if (!fichier || typeof fichier === "string") return badRequest("Photo manquante.");
  const extension = TYPES[fichier.type];
  if (!extension) return badRequest("Format de photo non accepté (JPEG, PNG, WebP ou HEIC).");
  if (fichier.size > TAILLE_MAX) return badRequest("Photo trop lourde (8 Mo au plus).");

  const db = await readDb();
  const visite = (db.visites || []).find((v) => v.id === visiteId);
  if (!visite || visite.userId !== userId) return badRequest("Visite introuvable.", 404);

  const path = `visites/${userId}/${visiteId}/${photoId}.${extension}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type, upsert: true });
  if (error) return badRequest("La photo n'a pas pu être enregistrée.", 500);

  const recuLe = new Date().toISOString();
  const pieces = visite.pieces?.length ? visite.pieces : [{ id: pieceId || "piece-1", nom: "Pièce", cotes: [], points: [], notes: [], photos: [] }];
  let rangee = false;
  for (const p of pieces) {
    p.photos = p.photos || [];
    const ph = p.photos.find((x) => x.id === photoId);
    if (ph) {
      Object.assign(ph, { path, recuLe, le: ph.le || prisLe });
      rangee = true;
    }
  }
  if (!rangee) {
    const piece = pieces.find((p) => p.id === pieceId) || pieces[0];
    piece.photos.push({ id: photoId, le: prisLe, pointId, path, recuLe });
  }
  visite.pieces = pieces;
  await writeDb(db);
  return ok({ photo: { id: photoId, recuLe } }, 201);
}
