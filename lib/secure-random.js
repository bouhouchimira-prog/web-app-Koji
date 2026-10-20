import { randomInt } from "node:crypto";

// Secrets a user actually logs in with (temporary passwords, portal/signature
// identifiers) must come from a CSPRNG, not Math.random() — Math.random() is
// not specified to be cryptographically secure and shouldn't generate
// anything an attacker could gain from predicting (18 oct, security audit
// follow-up). node:crypto's randomInt is already used for worker credentials
// (lib/worker-auth.js) and password hashing (lib/password-hash.js); this just
// extends the same CSPRNG to the two other secret-generating spots
// (app/api/quotes/route.js, lib/client-portal-access.js) that were still
// using Math.random().
export function randomChars(length, alphabet) {
  let value = "";
  for (let i = 0; i < length; i += 1) value += alphabet[randomInt(alphabet.length)];
  return value;
}

const PASSWORD_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Shared by app/api/quotes/route.js (signature-access password) and
// lib/client-portal-access.js (client-portal password) — same "Koji-XXXX-
// XXXX" shape both already produced independently with Math.random().
export function makeTemporaryPassword() {
  return `Koji-${randomChars(4, PASSWORD_ALPHABET)}-${randomChars(4, PASSWORD_ALPHABET)}`;
}
