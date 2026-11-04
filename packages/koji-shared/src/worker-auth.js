import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fixObjectText, fixText } from "./text";
import { hashPassword as scryptHash, verifyHashedPassword as scryptVerify } from "./password-hash";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length = 6) {
  let value = "";
  const bytes = randomBytes(length * 2);
  for (let i = 0; value.length < length && i < bytes.length; i += 1) {
    value += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return value;
}

export function makeWorkerLoginId(workers = []) {
  const used = new Set(workers.map((worker) => String(worker.loginId || worker.identifier || "").toUpperCase()));
  let loginId = `OUV-${randomSegment(6)}`;
  while (used.has(loginId)) loginId = `OUV-${randomSegment(6)}`;
  return loginId;
}

export function makeTemporaryPassword() {
  return `KJ-${randomSegment(4)}-${randomSegment(4)}`;
}

// scrypt now (see lib/password-hash.js) — was a single SHA-256 pass, fast
// enough to brute-force at billions of guesses/sec on a GPU, unlike the
// client-portal and signature-access passwords which already used scrypt.
// Same {passwordSalt, passwordHash} shape as before so the existing callers
// (app/api/workers/route.js, app/api/auth/set-password/route.js) don't need
// to change.
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const { hash } = scryptHash(password, salt);
  return { passwordSalt: salt, passwordHash: hash };
}

// Legacy SHA-256 hex digests are 64 chars; scrypt (keylen 64) produces 128
// hex chars — that length difference is enough to tell old hashes from new
// ones without a separate "algorithm" field.
function isLegacySha256Hash(hash) {
  return typeof hash === "string" && hash.length === 64;
}

function verifyLegacySha256(password, salt, hash) {
  const candidateHash = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(candidateHash), Buffer.from(hash));
  } catch {
    return candidateHash === hash;
  }
}

export function verifyWorkerPassword(worker, password) {
  const candidate = String(password || "");
  if (!worker || !candidate) return false;

  if (worker.passwordHash && worker.passwordSalt) {
    if (isLegacySha256Hash(worker.passwordHash)) {
      return verifyLegacySha256(candidate, worker.passwordSalt, worker.passwordHash);
    }
    return scryptVerify(candidate, worker.passwordSalt, worker.passwordHash);
  }

  return candidate === worker.password || candidate === worker.temporaryPassword;
}

// True if this worker's credentials should be re-hashed to scrypt on next
// successful login: legacy SHA-256 hash, or (predating any hashing at all) a
// plaintext password/temporaryPassword field.
export function workerPasswordNeedsRehash(worker) {
  if (!worker) return false;
  if (worker.password || worker.temporaryPassword) return true;
  if (!worker.passwordHash || !worker.passwordSalt) return false;
  return isLegacySha256Hash(worker.passwordHash);
}

export function normalizeWorker(worker = {}) {
  const fixed = fixObjectText(worker) || {};
  const firstName = fixText(fixed.firstName || "").trim();
  const lastName = fixText(fixed.lastName || "").trim();
  const name = fixText(fixed.name || `${firstName} ${lastName}`.trim() || "Ouvrier").trim();
  const loginId = fixText(fixed.loginId || fixed.identifier || "").trim();

  return {
    ...fixed,
    firstName,
    lastName,
    name,
    loginId,
    identifier: loginId || fixed.identifier,
    role: fixText(fixed.role || fixed.profession || "Ouvrier"),
    profession: fixText(fixed.profession || fixed.role || "Ouvrier"),
    type: fixText(fixed.type || "Ouvrier"),
    status: fixText(fixed.status || "Actif"),
    availability: fixText(fixed.availability || "Disponible"),
    portalRole: "worker",
  };
}

export function publicWorker(worker = {}) {
  const normalized = normalizeWorker(worker);
  const {
    password,
    temporaryPassword,
    passwordHash,
    passwordSalt,
    ...safeWorker
  } = normalized;
  return safeWorker;
}
