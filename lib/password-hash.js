import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt is a slow, memory-hard KDF built into Node — deliberately chosen over
// the SHA256+salt pattern already used for worker passwords (fast to brute-
// force) and over adding a new dependency (bcrypt/argon2) just for this.
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyHashedPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  try {
    const candidate = scryptSync(String(password || ""), salt, 64);
    const stored = Buffer.from(hash, "hex");
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}
