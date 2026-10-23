import { badRequest, ok } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { getVerifiedUserId } from "../../../../../lib/server-auth";
import { hasConfirmedRdv } from "../../../../../lib/rdv";
import { hasPhotoAccess } from "../../../../../lib/photo-access";
import { fixText } from "../../../../../lib/text";
import { clientContactFields } from "../../../../../lib/offer-privacy";

// Detail cote entreprise (Koji Pro) d'une offre Radar des Chantiers.
// Regle unique (decisions du 4 septembre) : aucune coordonnee visible
// (adresse exacte, email, telephone), dans les deux sens, tant que le RDV
// n'est pas confirme — l'echange passe par la messagerie interne. Les
// photos suivent une regle independante : masquees par defaut, debloquees
// par le particulier entreprise par entreprise (lib/photo-access.js).
// clientContactFields (lib/offer-privacy.js, 23 oct) centralise la partie
// coordonnees/adresse, reutilisee telle quelle par
// app/api/marketplace/mes-chantiers/route.js — jamais reecrite 2 fois.
function detailOffer(offer, rdvUnlocked, photosUnlocked) {
  return {
    id: offer.id,
    photos: photosUnlocked ? (Array.isArray(offer.photos) ? offer.photos : []) : [],
    photosCount: Array.isArray(offer.photos) ? offer.photos.length : 0,
    photosUnlocked,
    description: fixText(offer.description || ""),
    ouvrages: Array.isArray(offer.ouvrages) ? offer.ouvrages : [],
    metier: fixText(offer.metier || ""),
    delaiEstimeJours: offer.delaiEstimeJours || null,
    status: offer.status,
    createdAt: offer.createdAt,
    rdvConfirmed: rdvUnlocked,
    ...clientContactFields(offer, rdvUnlocked)
  };
}

export async function GET(request, context) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  const rdvUnlocked = hasConfirmedRdv(db.chantierOffreMessages, id, userId);
  const photosUnlocked = hasPhotoAccess(db.chantierOffreMessages, id, userId);
  return ok({ offre: detailOffer(offre, rdvUnlocked, photosUnlocked) });
}
