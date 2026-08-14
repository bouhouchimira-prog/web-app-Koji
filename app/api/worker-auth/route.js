import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { hashPassword, publicWorker, verifyWorkerPassword, workerPasswordNeedsRehash } from "../../../lib/worker-auth";
import { issueWorkerToken } from "../../../lib/worker-session";
import { setSessionCookie } from "../../../lib/session-cookies";
import { checkRateLimit, clearRateLimit, rateLimitMessage, recordFailedAttempt } from "../../../lib/rate-limit";

const SCOPE = "worker-auth";

function findWorker(db, identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  return (db.workers || []).find((worker) => {
    return [worker.loginId, worker.identifier, worker.email, worker.phone]
      .filter(Boolean)
      .map((item) => String(item).trim().toLowerCase())
      .includes(value);
  }) || null;
}

export async function POST(request) {
  const body = await request.json();
  const identifier = body.identifier || body.loginId || body.email || body.phone;

  const limit = await checkRateLimit(SCOPE, identifier);
  if (!limit.allowed) return ok({ error: rateLimitMessage(limit.retryAfterSeconds) }, 429);

  const db = await readDb();
  const worker = findWorker(db, identifier);

  if (!worker || !verifyWorkerPassword(worker, body.password)) {
    await recordFailedAttempt(SCOPE, identifier);
    return ok({ error: "Identifiant ou mot de passe incorrect." }, 401);
  }

  if (worker.active === false) {
    return ok({ error: "Acces desactive. Contactez votre entreprise." }, 403);
  }

  await clearRateLimit(SCOPE, identifier);

  if (workerPasswordNeedsRehash(worker)) {
    const { passwordHash, passwordSalt } = hashPassword(body.password);
    worker.passwordHash = passwordHash;
    worker.passwordSalt = passwordSalt;
    delete worker.password;
    delete worker.temporaryPassword;
  }

  worker.lastLoginAt = new Date().toISOString();
  await writeDb(db);

  // No workerToken in the body anymore — it goes in an HttpOnly cookie below.
  const response = ok({ worker: publicWorker(worker) });
  setSessionCookie(response, "worker", issueWorkerToken(worker.id));
  return response;
}
