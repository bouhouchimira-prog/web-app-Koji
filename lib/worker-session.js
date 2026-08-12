import { createHmac, timingSafeEqual } from "node:crypto";

// The worker portal had no session token at all: worker-portal and
// worker-actions trusted a plain workerId/loginId sent by the browser, and
// worker-auth verified the password at login but issued nothing afterward
// for those routes to check. Anyone who knew (or guessed) a worker's loginId
// could read or act on their portal without ever passing the password check.
// This mirrors lib/portal-session.js: a signed, expiring token issued at
// login, HMAC'd with the service role key (already a private secret set
// everywhere the app runs).
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches the portal-session default

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueWorkerToken(workerId, ttlMs = DEFAULT_TTL_MS) {
  if (!SECRET || !workerId) return "";
  const expiresAt = Date.now() + ttlMs;
  const payload = `${workerId}.${expiresAt}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifyWorkerToken(token) {
  if (!SECRET || !token) return "";
  try {
    const decoded = Buffer.from(String(token), "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return "";
    const [workerId, expiresAtRaw, signature] = parts;
    const expected = sign(`${workerId}.${expiresAtRaw}`);
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) return "";
    if (!Number.isFinite(Number(expiresAtRaw)) || Date.now() > Number(expiresAtRaw)) return "";
    return workerId;
  } catch {
    return "";
  }
}

// Reads the token the same two ways getAccessToken/getPortalToken do:
// Authorization header first, then a body field (for POST callers).
export function getWorkerToken(request, body = null) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  if (body && typeof body.workerToken === "string" && body.workerToken) return body.workerToken;
  return new URL(request.url).searchParams.get("workerToken") || "";
}

export function getVerifiedWorkerId(request, body = null) {
  return verifyWorkerToken(getWorkerToken(request, body));
}
