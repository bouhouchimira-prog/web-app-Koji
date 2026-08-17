import { ok, badRequest } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { issuePortalToken } from "../../../../lib/portal-session";
import { hashPassword as hashClientPassword, verifyHashedPassword } from "../../../../lib/password-hash";
import { hashPassword as hashWorkerPassword, publicWorker, verifyWorkerPassword, workerPasswordNeedsRehash } from "../../../../lib/worker-auth";
import { issueWorkerToken } from "../../../../lib/worker-session";
import { setSessionCookie } from "../../../../lib/session-cookies";
import { checkRateLimit, clearRateLimit, rateLimitMessage, recordFailedAttempt } from "../../../../lib/rate-limit";

const SCOPE = "particulier-login";
const GENERIC_ERROR = "Identifiant ou mot de passe incorrect.";

function findClientUser(db, identifier) {
  const value = identifier.toLowerCase();
  return db.users.find((u) =>
    u.accountType === "particulier" &&
    ((u.portalIdentifier || "").toLowerCase() === value || (u.email || "").toLowerCase() === value)
  ) || null;
}

function findWorker(db, identifier) {
  const value = identifier.toLowerCase();
  return (db.workers || []).find((worker) =>
    [worker.loginId, worker.identifier, worker.email, worker.phone]
      .filter(Boolean)
      .map((item) => String(item).trim().toLowerCase())
      .includes(value)
  ) || null;
}

// Single entry point for the merged "Particulier" login tab: tries a client
// portal account first, then a worker account, so the person never has to
// say up front which kind of account they hold. Reuses the exact lookup and
// password-verification logic of client-portal-login / worker-auth (kept as
// standalone routes too) rather than re-implementing it, to avoid the two
// diverging over time.
export async function POST(request) {
  const body = await request.json();
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "").trim();
  if (!identifier || !password) return badRequest("Identifiant et mot de passe obligatoires.");

  const limit = await checkRateLimit(SCOPE, identifier);
  if (!limit.allowed) return ok({ error: rateLimitMessage(limit.retryAfterSeconds) }, 429);

  const db = await readDb();
  const value = identifier.toLowerCase();

  const clientUser = findClientUser(db, value);
  if (clientUser) {
    const hasHash = Boolean(clientUser.passwordHash && clientUser.passwordSalt);
    const validHash = hasHash && verifyHashedPassword(password, clientUser.passwordSalt, clientUser.passwordHash);
    const validLegacyPlaintext = !hasHash && clientUser.password === password;
    if (!validHash && !validLegacyPlaintext) {
      await recordFailedAttempt(SCOPE, identifier);
      return badRequest(GENERIC_ERROR, 401);
    }
    await clearRateLimit(SCOPE, identifier);

    if (validLegacyPlaintext) {
      const { salt, hash } = hashClientPassword(password);
      clientUser.passwordHash = hash;
      clientUser.passwordSalt = salt;
      delete clientUser.password;
      await writeDb(db);
    }

    const response = ok({
      kind: "client",
      account: {
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        accountType: clientUser.accountType,
        portalIdentifier: clientUser.portalIdentifier,
        clientAccess: clientUser.clientAccess || {}
      }
    });
    setSessionCookie(response, "portal", issuePortalToken(clientUser.id));
    return response;
  }

  const worker = findWorker(db, value);
  if (worker && verifyWorkerPassword(worker, password)) {
    if (worker.active === false) {
      return ok({ error: "Acces desactive. Contactez votre entreprise." }, 403);
    }
    await clearRateLimit(SCOPE, identifier);

    if (workerPasswordNeedsRehash(worker)) {
      const { passwordHash, passwordSalt } = hashWorkerPassword(password);
      worker.passwordHash = passwordHash;
      worker.passwordSalt = passwordSalt;
      delete worker.password;
      delete worker.temporaryPassword;
    }
    worker.lastLoginAt = new Date().toISOString();
    await writeDb(db);

    const response = ok({ kind: "worker", account: publicWorker(worker) });
    setSessionCookie(response, "worker", issueWorkerToken(worker.id));
    return response;
  }

  await recordFailedAttempt(SCOPE, identifier);
  return badRequest(GENERIC_ERROR, 401);
}
