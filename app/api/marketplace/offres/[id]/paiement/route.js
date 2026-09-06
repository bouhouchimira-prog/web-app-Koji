import { badRequest, ok } from "../../../../../../lib/http";
import { readDb } from "../../../../../../lib/db";
import { resolveEntreprise } from "../../../../../../lib/entreprise-auth";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";

// Liste les 3 echeances de paiement (acompte/avancement/solde) d'un
// chantier Radar des Chantiers, une fois le devis signe (voir
// lib/chantier-paiements.js pour leur creation). Visible par l'entreprise
// concernee et par le particulier proprietaire de l'offre.
function publicPaiement(p) {
  return {
    id: p.id,
    offerId: p.offerId,
    entrepriseUserId: p.entrepriseUserId,
    step: p.step,
    amountTtc: p.amountTtc,
    status: p.status,
    photos: p.photos || [],
    validatedAt: p.validatedAt || "",
    createdAt: p.createdAt
  };
}

export async function GET(request, context) {
  const { id } = await context.params;
  const db = await readDb();

  const entreprise = await resolveEntreprise(request);
  if (entreprise) {
    const list = (db.chantierPaiements || [])
      .filter((p) => p.offerId === id && p.entrepriseUserId === entreprise.userId)
      .map(publicPaiement);
    return ok({ paiements: list });
  }

  const portalUserId = getVerifiedPortalUserId(request);
  if (portalUserId) {
    const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
    if (!offre || offre.userId !== portalUserId) return badRequest("Offre introuvable.", 404);
    const list = (db.chantierPaiements || []).filter((p) => p.offerId === id).map(publicPaiement);
    return ok({ paiements: list });
  }

  return badRequest("Session expirée. Reconnectez-vous.", 401);
}
