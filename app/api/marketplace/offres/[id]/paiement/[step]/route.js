import { badRequest, ok } from "../../../../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../../../../lib/db";
import { resolveEntreprise } from "../../../../../../../lib/entreprise-auth";

// L'entreprise ajoute des photos des travaux pour l'echeance en cours —
// c'est sur cette base que le particulier valide et debloque les fonds
// (cahier des charges 3.6/4.4 : "chaque etape validee par le client sur
// photos envoyees par l'entreprise"). Echeance identifiee par son id, voir
// checkout/route.js pour le pourquoi (etapes a libelle libre depuis le
// 4 septembre).
export async function PATCH(request, context) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id, step: paiementId } = await context.params;

  const body = await request.json().catch(() => ({}));
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : null;
  if (!photos) return badRequest("Aucune photo fournie.");

  const db = await readDb();
  const paiement = (db.chantierPaiements || []).find(
    (p) => p.offerId === id && p.id === paiementId && p.entrepriseUserId === entreprise.userId
  );
  if (!paiement) return badRequest("Échéance introuvable.", 404);
  if (paiement.status !== "paid_platform") {
    return badRequest("Cette échéance n'a pas encore été réglée par le client.", 409);
  }

  paiement.photos = photos;

  addHistory(db, {
    userId: entreprise.userId,
    type: "radar.paiement_photos",
    label: `Photos ajoutées pour l'échéance ${paiement.step}`,
    entityId: paiement.id,
    entityType: "chantier-paiement",
    meta: { offerId: id, step: paiement.step }
  });
  await writeDb(db);

  return ok({ paiement: { id: paiement.id, photos: paiement.photos } });
}
