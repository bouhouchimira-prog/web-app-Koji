import { ok } from "../../../../lib/http";
import { clearSessionCookie, readSessionCookie } from "../../../../lib/session-cookies";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Shared by all three session types (company, particulier portal, worker):
// client-side JS can't delete an HttpOnly cookie itself, so logging out
// needs a server round trip. Clearing all three unconditionally is harmless
// — at most it clears cookies that were never set.
//
// Revoking the Supabase session (16 oct) — clearing the cookie alone only
// stops THIS browser from using the token; the refresh token itself stayed
// valid at Supabase until it expired (30 days) if it had ever left the
// cookie (old localStorage sessions, devtools...). Best-effort: logout still
// succeeds even if this call fails (expired token, Supabase down...).
export async function POST(request) {
  const accessToken = readSessionCookie(request, "access");
  if (accessToken) {
    try {
      await getSupabaseAdmin().auth.admin.signOut(accessToken, "local");
    } catch {
      // Non-fatal — cookies are cleared below regardless.
    }
  }

  const response = ok({ ok: true });
  clearSessionCookie(response, "access");
  clearSessionCookie(response, "refresh");
  clearSessionCookie(response, "portal");
  clearSessionCookie(response, "worker");
  return response;
}
