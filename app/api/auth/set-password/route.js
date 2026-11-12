import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/worker-auth";
import { hashPassword as hashParticulierPassword } from "../../../../lib/password-hash";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";
import { erreurMotDePasse } from "../../../../lib/password-rules";
import { getSupabase } from "../../../../lib/supabase";

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

// Écran « Nouveau mot de passe » (maquette PRO-00.1) : avant la saisie,
// la page affiche le compte concerné et l'heure limite du lien, ou l'écran
// « Ce lien ne fonctionne plus ». Seulement pour les liens de
// réinitialisation entreprise (jeton maison de la table users).
export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  if (!token || url.searchParams.get("type") !== "entreprise") return badRequest("Lien invalide", 404);
  const admin = getSupabaseAdmin();
  const { data: row } = await admin.from("users").select("email, password_reset_expires_at").eq("password_reset_token", token).maybeSingle();
  if (!row) return badRequest("Lien de réinitialisation invalide", 404);
  if (row.password_reset_expires_at && new Date(row.password_reset_expires_at).getTime() < Date.now()) {
    return badRequest("Lien de réinitialisation expiré", 410);
  }
  return ok({ email: row.email || "", expiresAt: row.password_reset_expires_at || null });
}

// Les autres appareils sont déconnectés à chaque changement de mot de passe
// (maquette PRO-00.1) : une session ouverte avec le nouveau mot de passe sert
// à révoquer toutes les sessions du compte, puis la page se connecte.
async function deconnecterPartout(email, password) {
  try {
    const { data } = await getSupabase().auth.signInWithPassword({ email, password });
    const jwt = data?.session?.access_token;
    if (jwt) await getSupabaseAdmin().auth.admin.signOut(jwt, "global");
  } catch (error) {
    console.warn(`set-password: déconnexion des autres appareils impossible (${error.message})`);
  }
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
    const regle = erreurMotDePasse(password, row.email);
    if (regle) return badRequest(regle);
    // email_confirm : le lien reçu prouve l'adresse, Supabase doit le savoir
    // aussi (sinon « Email not confirmed » à la connexion).
    const { error: updateError } = await admin.auth.admin.updateUserById(row.id, { password, email_confirm: true });
    if (updateError) return badRequest(updateError.message || "Réinitialisation impossible", 400);
    // Le lien reçu par e-mail prouve l'adresse : le compte est aussi activé.
    await admin.from("users").update({ password_reset_token: null, password_reset_expires_at: null, email_verified: true }).eq("id", row.id);
    await deconnecterPartout(row.email, password);
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
    message: mode === "reset" ? "Mot de passe reinitialise avec succes." : "Compte active et mot de passe enregistre."
  });
}
