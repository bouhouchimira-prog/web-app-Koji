import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { issuePortalToken } from "../../../../lib/portal-session";
import { hashPassword, verifyHashedPassword } from "../../../../lib/password-hash";

export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();

  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const db = await readDb();
  const user = db.users.find((u) =>
    u.accountType === "particulier" &&
    (
      (u.portalIdentifier || "").toLowerCase() === identifier.toLowerCase() ||
      (u.email || "").toLowerCase() === identifier.toLowerCase()
    )
  );

  if (!user) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  const hasHash = Boolean(user.passwordHash && user.passwordSalt);
  const validHash = hasHash && verifyHashedPassword(password, user.passwordSalt, user.passwordHash);
  // Legacy plaintext accounts (predating password hashing): accept once, then
  // migrate to a hash and drop the plaintext field so it stops existing.
  const validLegacyPlaintext = !hasHash && user.password === password;
  if (!validHash && !validLegacyPlaintext) return badRequest("Identifiant ou mot de passe incorrect.", 401);

  if (validLegacyPlaintext) {
    const { salt, hash } = hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    delete user.password;
    await writeDb(db);
  }

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      accountType: user.accountType,
      portalIdentifier: user.portalIdentifier,
      clientAccess: user.clientAccess || {},
      portalToken: issuePortalToken(user.id)
    }
  });
}
