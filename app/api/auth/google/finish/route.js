import { badRequest, ok } from "../../../../../lib/http";
import { nowIso } from "../../../../../lib/auth";
import { getSupabaseForToken } from "../../../../../lib/supabase";
import { buildWebUser } from "../../../../../lib/user-profile";
import { setSessionCookie } from "../../../../../lib/session-cookies";

// Termine une connexion Google cote entreprise (Koji Pro) : le navigateur a
// deja obtenu une session Supabase via le redirect Google (voir
// app/auth/google/callback/page.jsx) — cette route verifie ce token aupres
// de Supabase (jamais fait confiance a ce que le client affirme) puis pose
// les memes cookies HttpOnly que /api/auth/login pour une connexion
// email/mot de passe classique. Le profil `users` (business_info, etc.) est
// cree automatiquement par le trigger Supabase existant des la premiere
// connexion, comme pour un compte email/mot de passe.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = String(body.accessToken || "");
  const refreshToken = String(body.refreshToken || "");
  if (!accessToken || !refreshToken) return badRequest("Session Google invalide.");

  const scoped = getSupabaseForToken(accessToken);
  const { data: authData, error: authError } = await scoped.auth.getUser();
  if (authError || !authData?.user) return badRequest("Session Google invalide.", 401);

  const authUser = authData.user;
  let profile = null;
  try {
    const { data: row } = await scoped.from("users").select("*").eq("id", authUser.id).maybeSingle();
    profile = row || null;
  } catch {
    // Profile row is optional — the account itself is what matters.
  }

  const user = {
    ...buildWebUser({
      id: authUser.id,
      email: authUser.email || "",
      profile,
      accountTypeFallback: "entreprise"
    }),
    createdAt: authUser.created_at || nowIso(),
    lastLoginAt: nowIso()
  };
  if (!user.name || user.name === "Utilisateur") {
    user.name = authUser.user_metadata?.name || authUser.user_metadata?.full_name || user.name;
  }

  const response = ok({ user });
  setSessionCookie(response, "access", accessToken);
  setSessionCookie(response, "refresh", refreshToken);
  return response;
}
