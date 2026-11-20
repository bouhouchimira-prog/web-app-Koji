import { getSupabase, getSupabaseForToken } from "./supabase.js";
import { readSessionCookie } from "./session-cookies.js";
import { banni } from "./moderation.js";

// Shared-table routes authenticate with the Supabase access token issued at
// login (same accounts as the koji-main Flutter app). The token now travels
// in an HttpOnly cookie (see lib/session-cookies.js), checked first; the
// Authorization header / body / query fallbacks remain only for any caller
// that hasn't been migrated off them, and are ignored if empty.
export function getAccessToken(request, body = null) {
  const cookie = readSessionCookie(request, "access");
  if (cookie) return cookie;
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (body && typeof body.accessToken === "string" && body.accessToken) return body.accessToken;
  return new URL(request.url).searchParams.get("accessToken") || "";
}

// The JWT is decoded without verification only to learn the user id for
// response shaping — every actual query is authorized by Supabase itself via
// RLS, which verifies the token signature server-side.
function decodeUserId(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.sub || "";
  } catch {
    return "";
  }
}

export function getAuth(request, body = null) {
  const token = getAccessToken(request, body);
  if (!token) return null;
  const userId = decodeUserId(token);
  if (!userId) return null;
  return { token, userId, supabase: getSupabaseForToken(token) };
}

// Verifies the access token with Supabase Auth before using its identity for
// anything sensitive. The optional verifier keeps the security rule directly
// testable without a network call or real credentials.
export async function verifyAccessToken(token, verify = null) {
  if (!token) return null;
  try {
    const { data, error } = verify
      ? await verify(token)
      : await getSupabase().auth.getUser(token);
    if (error || !data?.user?.id) return null;
    // Compte suspendu par l'équipe (back-office, page Signalements) :
    // refusé partout, même avec un jeton encore valide.
    if (banni(data.user)) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Same shape as getAuth(), but the user id is guaranteed by Supabase Auth,
// never by a locally decoded JWT. Use this for service-role access, shared
// JSON storage, external side effects (Stripe, e-mail, AI) and admin checks.
export async function getVerifiedAuth(request, body = null) {
  const token = getAccessToken(request, body);
  if (!token) return null;
  const user = await verifyAccessToken(token);
  if (!user) return null;
  return { token, userId: user.id, user, supabase: getSupabaseForToken(token) };
}

// For routes backed by the local/koji_web_state JSON store (not native
// Supabase tables with RLS): returns the real, authenticated user id, or ""
// when the token is missing/invalid. Callers must treat "" as "no scoping
// available", never as "admin" or "everyone's data".
export async function getVerifiedUserId(request, body = null) {
  const auth = await getVerifiedAuth(request, body);
  return auth?.userId || "";
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}
