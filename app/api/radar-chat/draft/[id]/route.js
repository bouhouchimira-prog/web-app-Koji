import { badRequest, ok } from "../../../../../lib/http";
import { getVerifiedPortalUserId } from "../../../../../lib/portal-session";
import { getDraft } from "../../../../../lib/radar-offer-draft";

// Lecture d'un brouillon d'offre par id (9-10 oct) — utilisee par l'ecran
// de recap existant (app/client/radar/new/page.jsx, ?draftId=...) pour
// charger "l'etat structure en base" une fois terminer_collecte appelee
// par le nouveau chat (app/client/radar/new-chat/page.jsx).
export async function GET(request, context) {
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const draft = await getDraft(id);
  if (!draft || draft.user_id !== portalUserId) return badRequest("Brouillon introuvable.", 404);

  return ok({ draft: { id: draft.id, status: draft.status, data: draft.data } });
}
