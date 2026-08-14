import { badRequest, ok } from "../../../../lib/http";
import { getSupabase } from "../../../../lib/supabase";
import { readSessionCookie, setSessionCookie } from "../../../../lib/session-cookies";

// Exchanges the refresh token cookie for a fresh Supabase session; the client
// calls this automatically when an access token expires (lib/client-api.js).
// The refresh token itself is read from an HttpOnly cookie scoped to
// /api/auth, never from the request body — it no longer needs to be
// readable by client-side JS at all.
export async function POST(request) {
  const refreshToken = readSessionCookie(request, "refresh") || String((await request.json().catch(() => ({}))).refreshToken || "").trim();
  if (!refreshToken) return badRequest("Refresh token manquant", 401);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return badRequest("Session expirée. Reconnectez-vous.", 401);
  }
  const response = ok({ ok: true });
  setSessionCookie(response, "access", data.session.access_token);
  setSessionCookie(response, "refresh", data.session.refresh_token);
  return response;
}
