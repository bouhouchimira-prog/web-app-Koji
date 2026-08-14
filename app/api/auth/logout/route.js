import { ok } from "../../../../lib/http";
import { clearSessionCookie } from "../../../../lib/session-cookies";

// Shared by all three session types (company, particulier portal, worker):
// client-side JS can't delete an HttpOnly cookie itself, so logging out
// needs a server round trip. Clearing all three unconditionally is harmless
// — at most it clears cookies that were never set.
export async function POST() {
  const response = ok({ ok: true });
  clearSessionCookie(response, "access");
  clearSessionCookie(response, "refresh");
  clearSessionCookie(response, "portal");
  clearSessionCookie(response, "worker");
  return response;
}
