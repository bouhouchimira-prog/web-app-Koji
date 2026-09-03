import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { readDb } from "../../../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { getSupabaseAdmin } from "../../../../../../lib/supabase";
import { buildWebUser } from "../../../../../../lib/user-profile";
import { isTrialUser } from "../../../../../../lib/plan";
import { buildBusinessCardPdf, businessCardFilename } from "../../../../../../lib/document-generator";

// Carte de visite d'une entreprise, consultable par le particulier
// proprietaire d'une offre a laquelle cette entreprise a repondu (et
// uniquement celle-ci — pas un lookup libre par id). Reserve aux entreprises
// ayant deja un compte payant/grandfathered ("achete via koji") ou admin ;
// une entreprise en essai gratuit n'a pas encore de carte a montrer.
export async function GET(request, context) {
  const { id } = await context.params;
  const entrepriseUserId = new URL(request.url).searchParams.get("entrepriseUserId") || "";
  if (!entrepriseUserId) return badRequest("Entreprise non précisée.");

  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre || offre.userId !== portalUserId) return badRequest("Offre introuvable.", 404);

  const hasThread = (db.chantierOffreMessages || []).some(
    (m) => m.offerId === id && m.entrepriseUserId === entrepriseUserId
  );
  if (!hasThread) return badRequest("Cette entreprise ne vous a pas encore contacté.", 403);

  const { data: profile, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("id", entrepriseUserId)
    .maybeSingle();
  if (error || !profile) return badRequest("Profil entreprise introuvable.", 404);

  const webUser = buildWebUser({ id: entrepriseUserId, email: profile.email || "", profile });
  if (!webUser.isAdmin && isTrialUser(webUser)) {
    return badRequest("Cette entreprise n'a pas encore de carte de visite Koji.", 402);
  }

  const inline = Boolean(new URL(request.url).searchParams.get("preview"));
  const pdfBuffer = await buildBusinessCardPdf({ company: webUser.business, professions: webUser.professions });
  const filename = businessCardFilename(webUser.business);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`
    }
  });
}
