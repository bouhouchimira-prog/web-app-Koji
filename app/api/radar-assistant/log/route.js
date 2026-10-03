import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";

// Enregistrement de la conversation Radar des Chantiers (2 oct, demande
// d'Amira : "en cas ou on rencontre un probleme", consultable cote admin
// pour chaque client sur /admin/clients). Contrairement au reste du
// parcours garde-fou (app/api/radar-assistant/route.js, volontairement
// stateless), cette route-ci est deliberement stateful : le client renvoie
// le tableau turns complet apres chaque echange reussi, et on sauvegarde/
// ecrase simplement l'enregistrement correspondant — aucune logique metier
// ici, juste une trace. N'empeche jamais la conversation de continuer :
// appelee en tache de fond cote client, erreurs ignorees.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const conversationId = String(body.conversationId || "").trim();
  if (!conversationId) return badRequest("Identifiant de conversation manquant.");
  const turns = Array.isArray(body.turns) ? body.turns : [];

  const db = await readDb();
  if (!Array.isArray(db.radarConversations)) db.radarConversations = [];
  const now = new Date().toISOString();
  const existing = db.radarConversations.find((c) => c.id === conversationId && c.userId === portalUserId);
  if (existing) {
    existing.turns = turns;
    if (body.metier) existing.metier = body.metier;
    existing.updatedAt = now;
  } else {
    db.radarConversations.push({
      id: conversationId,
      userId: portalUserId,
      turns,
      metier: body.metier || "",
      chantierOffreId: null,
      createdAt: now,
      updatedAt: now
    });
  }
  await writeDb(db);
  return ok({ saved: true });
}
