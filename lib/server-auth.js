import { getSupabaseForToken } from "./supabase";

// Shared-table routes authenticate with the Supabase access token issued at
// login (same accounts as the koji-main Flutter app). The token travels in the
// Authorization header (see lib/client-api.js) or, for POST/PATCH bodies sent
// by older components, in an accessToken field.
export function getAccessToken(request, body = null) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
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

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
}
