import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { getSupabase, getSupabaseForToken } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";

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

  const user = {
    ...buildWebUser({
      id: authUser.id,
      email: authUser.email || email,
      profile,
      accountTypeFallback: accountType
    }),
    createdAt: authUser.created_at || nowIso(),
    lastLoginAt: nowIso(),
    // Consumed by lib/client-api.js to authenticate API calls under RLS.
    accessToken: session.access_token,
    refreshToken: session.refresh_token
  };
  if (!user.name || user.name === "Utilisateur") {
    user.name = authUser.user_metadata?.name || user.name;
  }

  return ok({ user, token: session.access_token });
}
