import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/worker-auth";
import { hashPassword as hashParticulierPassword } from "../../../../lib/password-hash";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";

// Supabase recovery links land on /set-password with session tokens in the URL
// hash; the page forwards them as accessToken and the password is updated via
// the Supabase Auth API. The legacy token flow below still serves old
// file-based activation/reset links (worker & portal accounts).
async function setSupabasePassword(accessToken, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.message || data.error_description || "Lien de reinitialisation invalide ou expire");
  }
  return data;
}

export async function POST(request) {
  const body = await request.json();
  const password = String(body.password || "");
  if (password.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caractères");

  const accessToken = String(body.accessToken || "").trim();
  if (accessToken) {
    try {
      const authUser = await setSupabasePassword(accessToken, password);
      return ok({
        message: "Mot de passe reinitialise avec succes.",
        email: authUser.email || ""
      });
    } catch (error) {
      return badRequest(error.message, 400);
    }
  }

  const token = String(body.token || "").trim();
  const mode = body.mode === "reset" ? "reset" : "activation";
  const accountType = body.accountType === "particulier" ? "particulier" : body.accountType === "entreprise" ? "entreprise" : "";
  if (!token) return badRequest("Token manquant");

  // ── Reinitialisation compte entreprise (16 oct) — compte Supabase Auth,
  // token maison verifie sur la table `users` (voir forgot-password/route.js
  // pour pourquoi : resetPasswordForEmail() etait le meme mecanisme peu
  // fiable que l'ancien email d'activation). Le mot de passe est change via
  // la cle service_role, pas via un flux de session Supabase classique.
  if (mode === "reset" && accountType === "entreprise") {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin.from("users").select("id, email, password_reset_expires_at").eq("password_reset_token", token).maybeSingle();
    if (!row) return badRequest("Lien de réinitialisation invalide", 404);
    if (row.password_reset_expires_at && new Date(row.password_reset_expires_at).getTime() < Date.now()) {
      return badRequest("Lien de réinitialisation expiré", 410);
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(row.id, { password });
    if (updateError) return badRequest(updateError.message || "Réinitialisation impossible", 400);
    await admin.from("users").update({ password_reset_token: null, password_reset_expires_at: null }).eq("id", row.id);
    return ok({ message: "Mot de passe réinitialisé avec succès.", email: row.email || "" });
  }

  // ── Reinitialisation compte particulier (16 oct) — meme store que
  // particulier-signup/activate (lib/particulier-users.js).
  if (mode === "reset" && accountType === "particulier") {
    const users = await readUsers();
    const user = users.find((candidate) => candidate.resetToken === token);
    if (!user) return badRequest("Lien de réinitialisation invalide", 404);
    if (user.resetExpiresAt && new Date(user.resetExpiresAt).getTime() < Date.now()) {
      return badRequest("Lien de réinitialisation expiré", 410);
    }
    const { salt, hash } = hashParticulierPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.resetToken = null;
    user.resetExpiresAt = null;
    await writeUsers(users);
    return ok({ message: "Mot de passe réinitialisé avec succès.", email: user.email || "" });
  }

  // ── Legacy file-based token flow (comptes ouvriers/portail) ────────────────
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
