import { createHmac, timingSafeEqual } from "node:crypto";

// The particulier client portal has no Supabase Auth account of its own (see
// app/api/auth/client-portal-login), so unlike the pro/company side there was
// no token at all to verify — routes just trusted a userId or email the
// browser sent. This issues a signed, expiring token at login (HMAC'd with
// the service role key, already a private secret set everywhere the app
// runs) so those routes can verify who's actually asking instead of trusting
// whatever id the request claims.
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches signature-access link lifetime

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issuePortalToken(userId, ttlMs = DEFAULT_TTL_MS) {
  if (!SECRET || !userId) return "";
  const expiresAt = Date.now() + ttlMs;
  const payload = `${userId}.${expiresAt}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifyPortalToken(token) {
  if (!SECRET || !token) return "";
  try {
    const decoded = Buffer.from(String(token), "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return "";
    const [userId, expiresAtRaw, signature] = parts;
    const expected = sign(`${userId}.${expiresAtRaw}`);
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) return "";
    if (!Number.isFinite(Number(expiresAtRaw)) || Date.now() > Number(expiresAtRaw)) return "";
    return userId;
  } catch {
    return "";
  }
}

// Reads the token the same two ways getAccessToken does for the pro side:
// Authorization header first, then a body field (for POST/PATCH callers).
export function getPortalToken(request, body = null) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  if (body && typeof body.portalToken === "string" && body.portalToken) return body.portalToken;
  return new URL(request.url).searchParams.get("portalToken") || "";
}

export function getVerifiedPortalUserId(request, body = null) {
  return verifyPortalToken(getPortalToken(request, body));
}
