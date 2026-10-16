import { badRequest, ok } from "../../../../lib/http";
import { getSupabase, getSupabaseAdmin } from "../../../../lib/supabase";
import { makeToken } from "../../../../lib/db";
import { sendEntrepriseVerificationEmail } from "../../../../lib/mailer";
import { checkRateLimit, recordFailedAttempt, rateLimitMessage } from "../../../../lib/rate-limit";

const ACTIVATION_TTL_MS = 48 * 60 * 60 * 1000; // 48h, same convention as particulier-signup
const RATE_SCOPE = "entreprise-signup";

// Creates the account in Supabase Auth — shared with the koji-main Flutter app
// and koji-admin. The handle_new_user DB trigger creates the `users` profile
// row from the is_pro metadata, exactly like a signup from the mobile app.
//
// Email verification (16 oct, bug report : compte actif immediatement, aucun
// email recu) — deliberement independant du toggle "Confirm email" du projet
// Supabase (qui etait desactive, d'ou le bug) : on gere notre propre gate,
// avec notre propre email (SMTP Hostinger, lib/mailer.js, meme mecanisme que
// particulier-signup), verifie au moment du login (app/api/auth/login) plutot
// que de dependre du comportement de signUp()/Supabase. N'affecte que ce site
// web — un compte entreprise cree ici reste utilisable immediatement depuis
// l'app mobile Flutter, qui parle a Supabase Auth directement (voir colonne
// email_verified, par defaut true, ajoutee dans supabase_web_setup.sql).
export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0] || "Utilisateur";
  const accountType = body.accountType || "entreprise";

  if (!email || !password) return badRequest("Email et mot de passe obligatoires");
  if (password.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caractères");

  // Protection contre le spam d'inscriptions repetees sur la meme adresse
  // (16 oct) — meme systeme que le reste de l'app (lib/rate-limit.js).
  const limit = await checkRateLimit(RATE_SCOPE, email);
  if (!limit.allowed) return badRequest(rateLimitMessage(limit.retryAfterSeconds), 429);
  await recordFailedAttempt(RATE_SCOPE, email);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { is_pro: accountType !== "particulier", name },
      emailRedirectTo: `${new URL(request.url).origin}/login?type=${accountType}`
    }
  });

  if (error) {
    const message = String(error.message || "");
    if (/already registered/i.test(message)) {
      return badRequest("Un compte existe déjà avec cet e-mail", 409);
    }
    return badRequest(message || "Création du compte impossible");
  }

  // Supabase returns an obfuscated existing user (no identities) when the
  // email is already registered and confirmations are enabled.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return badRequest("Un compte existe déjà avec cet e-mail", 409);
  }

  if (accountType !== "entreprise" || !data.user) {
    return ok({ activationRequired: false, emailSent: false, message: "Compte créé. Vous pouvez vous connecter." }, 201);
  }

  const activationToken = makeToken("activate");
  const activationExpiresAt = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();
  let updateError = null;
  try {
    const admin = getSupabaseAdmin();
    const { error: dbError } = await admin.from("users").update({
      email_verified: false,
      email_verify_token: activationToken,
      email_verify_expires_at: activationExpiresAt
    }).eq("id", data.user.id);
    updateError = dbError;
  } catch (thrown) {
    updateError = thrown;
  }
  if (updateError) {
    // Si la colonne/table n'existe pas encore (migration SQL pas encore
    // executee) ou si la ligne de profil n'existe pas (trigger pas encore
    // passe), on laisse le compte actif plutot que de bloquer
    // l'inscription — degradation gracieuse, meme principe que le reste
    // de l'app face a une migration en attente.
    return ok({ activationRequired: false, emailSent: false, message: "Compte créé. Vous pouvez vous connecter." }, 201);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const activationUrl = `${appUrl}/activate?token=${activationToken}&type=entreprise`;
  const mailResult = await sendEntrepriseVerificationEmail({ email, name, activationUrl });

  return ok(
    {
      activationRequired: true,
      emailSent: mailResult.ok,
      // SMTP non configure en local/non accessible : permet quand meme de
      // tester le parcours sans attendre un email reel.
      directActivationUrl: mailResult.ok ? undefined : activationUrl,
      message: "Compte créé. Vérifiez votre boîte mail pour activer votre compte."
    },
    201
  );
}
