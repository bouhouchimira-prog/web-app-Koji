import { badRequest, ok } from "../../../../lib/http";
import { getSupabase } from "../../../../lib/supabase";

// Creates the account in Supabase Auth — shared with the koji-main Flutter app
// and koji-admin. The handle_new_user DB trigger creates the `users` profile
// row from the is_pro metadata, exactly like a signup from the mobile app.
export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0] || "Utilisateur";
  const accountType = body.accountType || "entreprise";

  if (!email || !password) return badRequest("Email et mot de passe obligatoires");
  if (password.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caractères");

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

  const activationRequired = !data.session;
  return ok(
    {
      activationRequired,
      emailSent: activationRequired,
      message: activationRequired
        ? "Compte créé. Vérifiez votre boîte mail pour activer votre compte."
        : "Compte créé. Vous pouvez vous connecter."
    },
    201
  );
}
