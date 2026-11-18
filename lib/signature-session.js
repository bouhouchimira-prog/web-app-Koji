import { createHmac, timingSafeEqual } from "node:crypto";
import { readSessionCookie } from "./session-cookies";

// Short-lived, quote-bound session issued only after the signature identifier
// and password have been verified by /api/auth/signature-login. The public
// signatureToken in the URL locates the quote; it is not an authorization by
// itself anymore.
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueSignatureToken(signatureToken, ttlMs = DEFAULT_TTL_MS) {
  if (!SECRET || !signatureToken || !Number.isFinite(Number(ttlMs)) || Number(ttlMs) <= 0) return "";
  const expiresAt = Date.now() + Number(ttlMs);
  const payload = `${signatureToken}.${expiresAt}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifySignatureToken(token, expectedSignatureToken) {
  if (!SECRET || !token || !expectedSignatureToken) return "";
  try {
    const decoded = Buffer.from(String(token), "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return "";
    const [signatureToken, expiresAtRaw, signature] = parts;
    if (signatureToken !== expectedSignatureToken) return "";
    const expected = sign(`${signatureToken}.${expiresAtRaw}`);
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) return "";
    if (!Number.isFinite(Number(expiresAtRaw)) || Date.now() > Number(expiresAtRaw)) return "";
    return signatureToken;
  } catch {
    return "";
  }
}

export function getVerifiedSignatureToken(request, expectedSignatureToken) {
  return verifySignatureToken(readSessionCookie(request, "signature"), expectedSignatureToken);
}

export function signatureAccessExpired(quote, now = Date.now()) {
  const access = quote?.signatureClientAccess || {};
  if (access.status && access.status !== "active") return true;
  const expiresAt = new Date(access.expiresAt || "").getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}
