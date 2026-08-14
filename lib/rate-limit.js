import { readDb, writeDb } from "./db";

// Brute-force protection for the app's three custom login endpoints
// (worker-auth, client-portal-login, signature-login) — none of them are
// backed by Supabase Auth, so nothing was throttling repeated guesses
// against short, sometimes low-entropy credentials (see lib/worker-session.js
// / lib/portal-session.js). Counters live in the same JSON blob as
// everything else (db.loginAttempts) rather than a new table, so no extra
// Supabase migration is needed.
//
// Keyed by scope + identifier only (not IP): simpler, and matches the
// account-lockout pattern CNIL recommends for this kind of credential
// (deliberation n° 2022-100) — a mistyped password from the real owner just
// means a short wait, not a security hole.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const LOCK_MS = 15 * 60 * 1000;

function keyFor(scope, identifier) {
  return `${scope}:${String(identifier || "").trim().toLowerCase()}`;
}

export async function checkRateLimit(scope, identifier) {
  const db = await readDb();
  const entry = db.loginAttempts?.[keyFor(scope, identifier)];
  const now = Date.now();
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

export async function recordFailedAttempt(scope, identifier) {
  const db = await readDb();
  db.loginAttempts = db.loginAttempts || {};
  const key = keyFor(scope, identifier);
  const now = Date.now();
  const entry = db.loginAttempts[key];
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    db.loginAttempts[key] = { count: 1, firstAttemptAt: now, lockedUntil: 0 };
  } else {
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = now + LOCK_MS;
  }
  await writeDb(db);
}

export async function clearRateLimit(scope, identifier) {
  const db = await readDb();
  const key = keyFor(scope, identifier);
  if (db.loginAttempts?.[key]) {
    delete db.loginAttempts[key];
    await writeDb(db);
  }
}

export function rateLimitMessage(retryAfterSeconds) {
  return `Trop de tentatives. Reessayez dans ${Math.ceil(retryAfterSeconds / 60)} minute(s).`;
}
