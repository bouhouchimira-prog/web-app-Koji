import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { fixObjectText } from "../../../../lib/text";

function publicOffer(offer) {
  return fixObjectText(offer);
}

export async function GET(request, context) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id && entry.userId === userId);
  if (!offre) return badRequest("Offre introuvable.", 404);

  return ok({ offre: publicOffer(offre) });
}
