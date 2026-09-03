import { badRequest, ok } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { getVerifiedUserId } from "../../../../../lib/server-auth";
import { fixText } from "../../../../../lib/text";

// Detail cote entreprise (Koji Pro) d'une offre Radar des Chantiers. V1 beta
// interne (cahier des charges §9 : ouverture a de vraies entreprises externes
// prevue seulement en V2) — toute entreprise connectee peut voir l'adresse
// complete et les coordonnees du particulier des l'ouverture de l'offre, sans
// etape de positionnement/RDV intermediaire (celle-ci n'est pas encore
// construite). A revisiter avant l'ouverture a des entreprises externes.
function detailOffer(offer) {
  return {
    id: offer.id,
    photos: Array.isArray(offer.photos) ? offer.photos : [],
    description: fixText(offer.description || ""),
    metier: fixText(offer.metier || ""),
    address: fixText(offer.address || ""),
    budget: offer.priceVisible !== false ? Number(offer.budget || 0) : null,
    withSupplies: Boolean(offer.withSupplies),
    status: offer.status,
    createdAt: offer.createdAt,
    clientName: fixText(offer.clientName || "Particulier"),
    clientEmail: offer.clientEmail || "",
    clientPhone: fixText(offer.clientPhone || "")
  };
}

export async function GET(request, context) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  return ok({ offre: detailOffer(offre) });
}
