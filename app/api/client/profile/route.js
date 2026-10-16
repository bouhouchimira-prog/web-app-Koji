import { badRequest, ok } from "../../../../lib/http";
import { publicUser } from "../../../../lib/db";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { hashPassword, verifyHashedPassword } from "../../../../lib/password-hash";

// Ne touche que les comptes (lib/particulier-users.js, 4 oct) — saute le
// gros bloc partage koji_web_state, inutile ici.
export async function GET(request) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return badRequest("Session expiree. Reconnectez-vous.", 401);
  const users = await readUsers();
  const user = users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);
  return ok({ user: publicUser(user) });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const userId = getVerifiedPortalUserId(request, body);
  if (!userId) return badRequest("Session expiree. Reconnectez-vous.", 401);

  const users = await readUsers();
  const user = users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);

  const personal = body.personal || {};
  user.accountType = "particulier";
  user.personal = { ...user.personal, ...personal };
  const fullName = [user.personal.firstName, user.personal.lastName].filter(Boolean).join(" ").trim();
  if (fullName) user.name = fullName;

  const newPassword = String(body.password || "").trim();
  if (newPassword) {
    if (newPassword.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caracteres.", 400);
    // Redemande le mot de passe actuel (16 oct) — sans ça, n'importe qui
    // utilisant une session active (poste partage, session volee) pouvait
    // changer le mot de passe et prendre le compte sans rien prouver. Un
    // compte qui n'a encore aucun mot de passe (premiere configuration)
    // n'a rien a verifier.
    if (user.passwordHash) {
      const currentPassword = String(body.currentPassword || "").trim();
      if (!currentPassword || !verifyHashedPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
        return badRequest("Mot de passe actuel incorrect.", 403);
      }
    }
    const { salt, hash } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    delete user.password;
  }

  await writeUsers(users);
  // No portalToken here — the session cookie set at login is still valid and
  // is the only place the portal token lives now.
  return ok({ user: publicUser(user) });
}