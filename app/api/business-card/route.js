import { NextResponse } from "next/server";
import { badRequest } from "../../../lib/http";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { buildBusinessCardPdf, businessCardFilename } from "../../../lib/document-generator";

// One fixed Koji-branded template, filled with the caller's own saved
// profile (never trusts data from the request).
//
// TEMPORARY (until further notice from Amira): free for admin accounts only,
// while this feature is still being trialed internally — not yet gated by
// paid plan. To reopen it to paying customers later, swap the isAdmin check
// below for `isTrialUser(legacyUser)` from lib/plan.js (see git history for
// the original version of this route).
export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data: profile, error } = await auth.supabase
    .from("users")
    .select("*")
    .eq("id", auth.userId)
    .maybeSingle();
  if (error) return badRequest(`Lecture du profil impossible: ${error.message}`, 500);

  const user = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  if (!user.isAdmin) {
    return badRequest("La carte de visite professionnelle n'est pas encore disponible pour votre compte.", 402);
  }

  const inline = Boolean(new URL(request.url).searchParams.get("preview"));
  const pdfBuffer = await buildBusinessCardPdf({ company: user.business, professions: user.professions });
  const filename = businessCardFilename(user.business);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`
    }
  });
}
