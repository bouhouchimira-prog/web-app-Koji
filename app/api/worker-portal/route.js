import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { buildWorkerPortal } from "../../../lib/worker-portal";
import { getVerifiedWorkerId } from "../../../lib/worker-session";

// Used to trust a plain ?workerId= or ?loginId= with no proof of identity —
// anyone who knew (or guessed) a worker's loginId could read their whole
// portal (tasks, hours, pay rate). Now requires the signed token issued at
// worker-auth login instead.
export async function GET(request) {
  const workerId = getVerifiedWorkerId(request);
  if (!workerId) return ok({ error: "Session expiree, merci de vous reconnecter." }, 401);

  const db = await readDb();
  const worker = (db.workers || []).find((entry) => entry.id === workerId);
  if (!worker) return ok({ error: "Ouvrier introuvable." }, 404);
  if (worker.active === false) return ok({ error: "Acces desactive. Contactez votre entreprise." }, 403);
  return ok(buildWorkerPortal(db, worker));
}
