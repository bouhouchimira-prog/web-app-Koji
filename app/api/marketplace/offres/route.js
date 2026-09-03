import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { fixText } from "../../../../lib/text";

// Cote entreprise (Koji Pro) de Radar des Chantiers : liste des offres
// publiees par des particuliers. V1 minimale — pas encore de diffusion par
// zone/metier (cahier des charges 3.2/4.3, necessite PostGIS + zones
// entreprise, pas construites), donc toutes les offres publiees sont
// visibles par toute entreprise pour l'instant. Les coordonnees du
// particulier (nom/email/telephone) ne sont pas exposees ici : le cahier des
// charges (5.4) prevoit qu'elles ne soient partagees qu'apres positionnement
// + RDV fixe, mecanisme pas encore construit.
function publicMarketplaceOffer(offer) {
  return {
    id: offer.id,
    photos: Array.isArray(offer.photos) ? offer.photos : [],
    description: fixText(offer.description || ""),
    metier: fixText(offer.metier || ""),
    address: fixText(offer.address || ""),
    budget: offer.priceVisible !== false ? Number(offer.budget || 0) : null,
    withSupplies: Boolean(offer.withSupplies),
    status: offer.status,
    createdAt: offer.createdAt
  };
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const offres = (db.chantierOffres || [])
    .filter((offre) => offre.status === "Publiee")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map(publicMarketplaceOffer);

  return ok({ offres });
}
