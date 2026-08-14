import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { publicWorker, verifyWorkerPassword } from "../../../lib/worker-auth";
import { issueWorkerToken } from "../../../lib/worker-session";
import { setSessionCookie } from "../../../lib/session-cookies";

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
  const db = await readDb();
  const worker = findWorker(db, body.identifier || body.loginId || body.email || body.phone);

  if (!worker || !verifyWorkerPassword(worker, body.password)) {
    return ok({ error: "Identifiant ou mot de passe incorrect." }, 401);
  }

  if (worker.active === false) {
    return ok({ error: "Acces desactive. Contactez votre entreprise." }, 403);
  }

  worker.lastLoginAt = new Date().toISOString();
  await writeDb(db);

  // No workerToken in the body anymore — it goes in an HttpOnly cookie below.
  const response = ok({ worker: publicWorker(worker) });
  setSessionCookie(response, "worker", issueWorkerToken(worker.id));
  return response;
}
