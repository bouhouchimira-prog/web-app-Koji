import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { buildWorkerPortal } from "../../../lib/worker-portal";

function findWorker(db, searchParams) {
  const workerId = searchParams.get("workerId") || searchParams.get("id") || "";
  const loginId = (searchParams.get("loginId") || searchParams.get("identifier") || "").toLowerCase();
  return (db.workers || []).find((worker) => {
    if (workerId && worker.id === workerId) return true;
    if (loginId && String(worker.loginId || worker.identifier || worker.email || "").toLowerCase() === loginId) return true;
    return false;
  }) || null;
}

export async function GET(request) {
  const db = await readDb();
  const { searchParams } = new URL(request.url);
  const worker = findWorker(db, searchParams);
  if (!worker) return ok({ error: "Ouvrier introuvable." }, 404);
  return ok(buildWorkerPortal(db, worker));
}
