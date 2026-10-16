import { ok } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { makeToken } from "../../../../lib/db";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";
import { sendPasswordResetEmail } from "../../../../lib/mailer";

const RESET_TTL_MS = 2 * 60 * 60 * 1000; // 2h — plus court qu'une activation de compte

// Reinitialisation de mot de passe (16 oct, meme correctif que le signup :
// supabase.auth.resetPasswordForEmail() depend du meme service email
// Supabase peu fiable qui a cause le bug d'activation). Email maison via le
// SMTP Hostinger (lib/mailer.js), pour les deux types de compte :
// - entreprise : token stocke sur la ligne Supabase `users` (compte Supabase
//   Auth partage avec l'app mobile), mot de passe change via
//   auth.admin.updateUserById au moment ou le lien est utilise
//   (app/api/auth/set-password/route.js) — pas via Supabase Auth cote email.
// - particulier : token stocke sur lib/particulier-users.js (meme store que
//   particulier-signup/activate), ce flux etait jusqu'ici completement
//   casse (resetPasswordForEmail ne fait rien pour un compte qui n'existe
//   pas dans Supabase Auth).
// Reponse volontairement identique dans tous les cas (compte existant ou
// non), pour ne jamais laisser deviner quels emails sont inscrits.
const GENERIC_MESSAGE = "Si ce compte existe, un e-mail de réinitialisation vient d'être envoyé.";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!email) return ok({ message: GENERIC_MESSAGE });

  try {
    if (accountType === "entreprise") {
      const admin = getSupabaseAdmin();
      const { data: row } = await admin.from("users").select("id, email").eq("email", email).maybeSingle();
      if (row) {
        const resetToken = makeToken("reset");
        const resetExpiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
        await admin.from("users").update({ password_reset_token: resetToken, password_reset_expires_at: resetExpiresAt }).eq("id", row.id);
        const resetUrl = `${appUrl}/set-password?token=${resetToken}&mode=reset&type=entreprise`;
        await sendPasswordResetEmail({ email: row.email, resetUrl });
      }
    } else {
      const users = await readUsers();
      const user = users.find((candidate) => candidate.accountType === "particulier" && String(candidate.email || "").toLowerCase() === email);
      if (user) {
        user.resetToken = makeToken("reset");
        user.resetExpiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
        await writeUsers(users);
        const resetUrl = `${appUrl}/set-password?token=${user.resetToken}&mode=reset&type=particulier`;
        await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
      }
    }
  } catch (error) {
    console.warn(`forgot-password failed: ${error.message}`);
  }

  return ok({ message: GENERIC_MESSAGE });
}
