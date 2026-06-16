import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fixObjectText, fixText } from "./text";

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

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const passwordHash = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return { passwordSalt: salt, passwordHash };
}

export function verifyUserPassword(user, password) {
  const candidate = String(password || "");
  if (!user || !candidate) return false;
  if (user.passwordHash && user.passwordSalt) {
    const candidateHash = hashPassword(candidate, user.passwordSalt).passwordHash;
    try {
      return timingSafeEqual(Buffer.from(candidateHash), Buffer.from(user.passwordHash));
    } catch {
      return candidateHash === user.passwordHash;
    }
  }
  return candidate === user.password;
}

export function verifyWorkerPassword(worker, password) {
  const candidate = String(password || "");
  if (!worker || !candidate) return false;

  if (worker.passwordHash && worker.passwordSalt) {
    const candidateHash = hashPassword(candidate, worker.passwordSalt).passwordHash;
    try {
      return timingSafeEqual(Buffer.from(candidateHash), Buffer.from(worker.passwordHash));
    } catch {
      return candidateHash === worker.passwordHash;
    }
  }

  return candidate === worker.password || candidate === worker.temporaryPassword;
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
