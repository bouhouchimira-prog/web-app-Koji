import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/worker-auth";

export async function POST(request) {
  const body = await request.json();
  const token = String(body.token || "").trim();
  const mode = body.mode === "reset" ? "reset" : "activation";
  const password = String(body.password || "");

  if (!token) return badRequest("Token manquant");
  if (password.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caractères");

  const db = await readDb();
  const tokenField = mode === "reset" ? "resetPasswordToken" : "activationToken";
  const expiresField = mode === "reset" ? "resetPasswordExpiresAt" : "activationExpiresAt";
  const user = db.users.find((candidate) => candidate[tokenField] === token);

  if (!user) {
    return badRequest(mode === "reset" ? "Lien de reinitialisation invalide" : "Lien d'activation invalide", 404);
  }

  if (user[expiresField] && new Date(user[expiresField]).getTime() < Date.now()) {
    return badRequest(mode === "reset" ? "Lien de reinitialisation expire" : "Lien d'activation expire", 410);
  }

  const { passwordHash, passwordSalt } = hashPassword(password);
  user.passwordHash = passwordHash;
  user.passwordSalt = passwordSalt;
  delete user.password;
  user.isActive = true;
  user.lastLoginAt = nowIso();
  user.activationToken = null;
  user.activationExpiresAt = null;
  user.resetPasswordToken = null;
  user.resetPasswordExpiresAt = null;

  await writeDb(db);

  return ok({
    user: publicUser(user),
    token: `demo-token-${user.id}`,
    message: mode === "reset" ? "Mot de passe reinitialise avec succes." : "Compte active et mot de passe enregistre."
  });
}
