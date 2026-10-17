import { badRequest, ok } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { getVerifiedUserId } from "../../../../../lib/server-auth";
import { hasConfirmedRdv } from "../../../../../lib/rdv";
import { hasPhotoAccess } from "../../../../../lib/photo-access";
import { fixText } from "../../../../../lib/text";
import { maskedCityPostal } from "../../../../../lib/offer-privacy";

// Detail cote entreprise (Koji Pro) d'une offre Radar des Chantiers.
// Regle unique (decisions du 4 septembre) : aucune coordonnee visible
// (adresse exacte, email, telephone), dans les deux sens, tant que le RDV
// n'est pas confirme — l'echange passe par la messagerie interne. Les
// photos suivent une regle independante : masquees par defaut, debloquees
// par le particulier entreprise par entreprise (lib/photo-access.js).
function detailOffer(offer, rdvUnlocked, photosUnlocked) {
  const base = {
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
    rdvConfirmed: rdvUnlocked
  };

  if (rdvUnlocked) {
    return {
      ...base,
      address: fixText(offer.address || ""),
      clientName: fixText(offer.clientName || "Particulier"),
      clientEmail: offer.clientEmail || "",
      clientPhone: fixText(offer.clientPhone || "")
    };
  }

  return {
    ...base,
    address: maskedCityPostal(offer),
    // Le nom du client fuyait ici meme sans RDV confirme (12 oct, bug
    // remonte par Amira) — reste generique tant que le RDV n'est pas
    // confirme, meme regle que l'adresse/email/telephone ci-dessus.
    clientName: "Particulier",
    clientEmail: "",
    clientPhone: ""
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
