import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { getSupabase, getSupabaseForToken } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";
import { setSessionCookie } from "../../../../lib/session-cookies";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

// Signs in against Supabase Auth — the same accounts as the koji-main Flutter
// app and koji-admin. The profile row in the shared `users` table (created by
// the handle_new_user trigger) carries is_pro / business info.
export async function POST(request) {
  const body = await request.json();
  const email = normalizeEmail(body.email || body.identifier || "");
  const password = String(body.password || "");
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  if (!email || !password) return badRequest("Email et mot de passe obligatoires");

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = String(error.message || "");
    if (/email not confirmed/i.test(message)) {
      return badRequest("Compte non active. Verifiez votre e-mail d'activation.", 403);
    }
    if (/invalid login credentials/i.test(message)) {
      return badRequest("Email ou mot de passe incorrect", 401);
    }
    return badRequest(message || "Connexion impossible", 401);
  }

  const session = data.session;
  const authUser = data.user;

  let profile = null;
  try {
    const scoped = getSupabaseForToken(session.access_token);
    const { data: row } = await scoped.from("users").select("*").eq("id", authUser.id).maybeSingle();
    profile = row || null;
  } catch {
    // Profile row is optional — the account itself is what matters.
  }

  // Email non confirme (16 oct) : gate propre a ce site, independant du
  // toggle "Confirm email" de Supabase (voir app/api/auth/signup/route.js).
  // N'affecte que l'emission du cookie de session web — un compte cree ici
  // reste utilisable immediatement depuis l'app mobile Flutter.
  if (accountType === "entreprise" && profile?.email_verified === false) {
    return badRequest("Compte non activé. Vérifiez votre boîte mail pour activer votre compte, ou demandez un nouvel e-mail d'activation.", 403);
  }

  const user = {
    ...buildWebUser({
      id: authUser.id,
      email: authUser.email || email,
      profile,
      accountTypeFallback: accountType
    }),
    createdAt: authUser.created_at || nowIso(),
    lastLoginAt: nowIso()
    // No accessToken/refreshToken here anymore — they go in HttpOnly cookies
    // below instead of a JSON body a script on the page could read.
  };
  if (!user.name || user.name === "Utilisateur") {
    user.name = authUser.user_metadata?.name || user.name;
  }

  // Demarre le compte a rebours d'essai (30 sept) : trialStartedAt n'etait
  // jamais renseigne nulle part (le trigger Supabase handle_new_user, partage
  // avec l'app mobile, ne le fait pas), donc la banniere d'essai/redirection
  // de components/Shell.jsx ne se declenchait jamais. Initialise au premier
  // login observe d'un compte entreprise en essai, pas a l'inscription — un
  // compte jamais reconnecte n'a pas besoin d'un compte a rebours qui tourne.
  if (accountType === "entreprise" && user.plan === "trial" && !user.trialStartedAt) {
    user.trialStartedAt = nowIso();
    try {
      const scoped = getSupabaseForToken(session.access_token);
      await scoped.from("users").update({
        business_info: { ...(profile?.business_info || {}), _trialStartedAt: user.trialStartedAt }
      }).eq("id", authUser.id);
    } catch {
      // Best-effort : la session reste utilisable meme si l'ecriture echoue,
      // le prochain login reessaiera.
    }
  }

  const response = ok({ user });
  setSessionCookie(response, "access", session.access_token);
  setSessionCookie(response, "refresh", session.refresh_token);
  return response;
}
