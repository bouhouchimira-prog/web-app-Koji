import { ok } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { makeToken } from "../../../../lib/db";
import { readUsers, writeUsers } from "../../../../lib/particulier-users";
import { sendPasswordResetEmail } from "../../../../lib/mailer";
import { checkRateLimit, recordFailedAttempt } from "../../../../lib/rate-limit";
import { ensureProfileRow, findAuthUserByEmail } from "../../../../lib/ensure-profile";
import { appDuLien } from "../../../../lib/reset-app";

// 30 minutes (maquette PRO-00.1) — bien plus court qu'une activation de compte.
const RESET_TTL_MS = 30 * 60 * 1000;
const RATE_SCOPE = "forgot-password";

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

  // Protection contre le bombardement de boite mail (16 oct) — la reponse
  // reste volontairement identique (meme en cas de limite atteinte), pour ne
  // jamais laisser deviner si une adresse est inscrite ou juste spammee.
  const limit = await checkRateLimit(RATE_SCOPE, email);
  if (!limit.allowed) return ok({ message: GENERIC_MESSAGE });
  await recordFailedAttempt(RATE_SCOPE, email);

  try {
    if (accountType === "entreprise") {
      const admin = getSupabaseAdmin();
      let { data: row } = await admin.from("users").select("id, email, is_pro").eq("email", email).maybeSingle();
      // Compte Supabase Auth sans ligne `users` (trigger d'inscription absent
      // en prod, voir lib/ensure-profile.js) : avant, aucun e-mail ne partait.
      if (!row) {
        const authUser = await findAuthUserByEmail(admin, email);
        if (authUser) {
          const profil = await ensureProfileRow(admin, authUser);
          row = { id: profil?.id || authUser.id, email: profil?.email || authUser.email, is_pro: profil?.is_pro };
        }
      }
      if (row) {
        const resetToken = makeToken("reset");
        const resetExpiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
        await admin.from("users").update({ password_reset_token: resetToken, password_reset_expires_at: resetExpiresAt }).eq("id", row.id);
        // Demande venue d'une app : la page finit par « Retournez dans
        // l'app … » au lieu de connecter au site Pro (lib/reset-app.js).
        const app = appDuLien({ demande: body.app, isPro: row.is_pro, userAgent: request.headers.get("user-agent") });
        const resetUrl = `${appUrl}/set-password?token=${resetToken}&mode=reset&type=entreprise${app ? `&app=${app}` : ""}`;
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
