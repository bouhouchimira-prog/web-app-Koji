import { badRequest, ok } from "../../../../lib/http";
import { getSupabase } from "../../../../lib/supabase";

// Exchanges the stored refresh token for a fresh Supabase session; the client
// calls this automatically when an access token expires (lib/client-api.js).
export async function POST(request) {
  const body = await request.json();
  const refreshToken = String(body.refreshToken || "").trim();
  if (!refreshToken) return badRequest("Refresh token manquant", 401);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return badRequest("Session expirée. Reconnectez-vous.", 401);
  }
  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });
}
