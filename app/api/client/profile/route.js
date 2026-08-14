import { badRequest, ok } from "../../../../lib/http";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";

export async function GET(request) {
  const db = await readDb();
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return badRequest("Session expiree. Reconnectez-vous.", 401);
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);
  return ok({ user: publicUser(user) });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const userId = getVerifiedPortalUserId(request, body);
  if (!userId) return badRequest("Session expiree. Reconnectez-vous.", 401);

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);

  const personal = body.personal || {};
  user.accountType = "particulier";
  user.personal = { ...user.personal, ...personal };
  const fullName = [user.personal.firstName, user.personal.lastName].filter(Boolean).join(" ").trim();
  if (fullName) user.name = fullName;

  await writeDb(db);
  // No portalToken here — the session cookie set at login is still valid and
  // is the only place the portal token lives now.
  return ok({ user: publicUser(user) });
}