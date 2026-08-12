import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, readDb, writeDb } from "../../../lib/db";
import { publicWorker } from "../../../lib/worker-auth";
import { addCompanyNotification, addWorkerNotification, applyTaskTimeAction, applyWorkerClockAction, buildWorkerPortal, taskBelongsToWorker } from "../../../lib/worker-portal";
import { fixObjectText, fixText } from "../../../lib/text";
import { getVerifiedWorkerId } from "../../../lib/worker-session";

function findWorkerTask(db, body, worker) {
  const task = (db.tasks || []).find((item) => item.id === body.taskId);
  if (!task || !taskBelongsToWorker(task, worker)) return null;
  return task;
}

export async function POST(request) {
  const body = await request.json();

  // Used to trust body.workerId/loginId with no proof of identity — anyone
  // could act (clock in/out, add photos, file claims) as any worker just by
  // naming their id. Now requires the signed token issued at worker-auth login.
  const workerId = getVerifiedWorkerId(request, body);
  if (!workerId) return ok({ error: "Session expiree, merci de vous reconnecter." }, 401);

  const db = await readDb();
  const worker = (db.workers || []).find((entry) => entry.id === workerId);
  if (!worker) return ok({ error: "Ouvrier introuvable." }, 404);

  const action = body.action || "";

  if (["start", "pause", "resume", "finish"].includes(action)) {
    // worker.userId comes from the worker record itself (looked up server-side
    // above), never from the request body — a client-supplied userId here would
    // let anyone scope this lookup to any company just by naming its id.
    const index = findScopedIndex(db.tasks || [], body.taskId, worker.userId || "");
    const task = index === -1 ? findWorkerTask(db, body, worker) : db.tasks[index];
    if (!task || !taskBelongsToWorker(task, worker)) return ok({ error: "Tache introuvable pour cet ouvrier." }, 404);
    applyTaskTimeAction(db, { task, worker: publicWorker(worker), action });
    if (index !== -1) db.tasks[index] = task;
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "clockIn" || action === "clockOut") {
    applyWorkerClockAction(db, { worker, action });
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "photo" || action === "document") {
    const task = findWorkerTask(db, body, worker);
    if (!task) return ok({ error: "Tache introuvable pour cet ouvrier." }, 404);
    if (!Array.isArray(db.projectDocuments)) db.projectDocuments = [];
    const doc = {
      id: `wd-${Date.now()}`,
      userId: task.userId || worker.userId || "",
      workerId: worker.id,
      projectId: task.projectId || "",
      taskId: task.id,
      type: action === "photo" ? "photo" : "document",
      name: fixText(body.name || (action === "photo" ? "Photo chantier" : "Document chantier")),
      mimeType: body.mimeType || "",
      dataUrl: body.dataUrl || "",
      url: body.url || "",
      createdAt: new Date().toISOString(),
    };
    db.projectDocuments.unshift(doc);
    addHistory(db, {
      userId: doc.userId,
      type: `worker.${action}`,
      label: `${action === "photo" ? "Photo" : "Document"} ajoute par ${worker.name}`,
      entityId: doc.id,
      entityType: "worker-document",
      meta: { workerId: worker.id, projectId: task.projectId || "", taskId: task.id },
    });
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "claim") {
    const task = findWorkerTask(db, body, worker);
    if (!task) return ok({ error: "Tache introuvable pour cet ouvrier." }, 404);
    if (!Array.isArray(db.workerClaims)) db.workerClaims = [];
    const claim = {
      id: `wc-${Date.now()}`,
      userId: task.userId || worker.userId || "",
      workerId: worker.id,
      projectId: task.projectId || "",
      taskId: task.id,
      category: fixText(body.category || "Probleme chantier"),
      message: fixText(body.message || body.comment || ""),
      status: "Envoyee",
      createdAt: new Date().toISOString(),
    };
    db.workerClaims.unshift(claim);
    addCompanyNotification(db, {
      userId: claim.userId,
      workerId: worker.id,
      projectId: claim.projectId,
      taskId: claim.taskId,
      type: "company.worker_claim",
      title: "Reclamation ouvrier",
      message: `${worker.name}: ${claim.category}${claim.message ? ` - ${claim.message}` : ""}`,
    });
    addHistory(db, {
      userId: claim.userId,
      type: "worker.claim",
      label: `Reclamation: ${claim.category}`,
      entityId: claim.id,
      entityType: "worker-claim",
      meta: { workerId: worker.id, projectId: claim.projectId, taskId: claim.taskId },
    });
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "delay") {
    const task = findWorkerTask(db, body, worker);
    if (!task) return ok({ error: "Tache introuvable pour cet ouvrier." }, 404);
    if (!Array.isArray(db.workerDelayReports)) db.workerDelayReports = [];
    const delay = {
      id: `wr-${Date.now()}`,
      userId: task.userId || worker.userId || "",
      workerId: worker.id,
      projectId: task.projectId || "",
      taskId: task.id,
      reason: fixText(body.reason || "Retard chantier"),
      estimatedDelay: fixText(body.estimatedDelay || ""),
      comment: fixText(body.comment || ""),
      status: "Envoye",
      createdAt: new Date().toISOString(),
    };
    db.workerDelayReports.unshift(delay);
    addCompanyNotification(db, {
      userId: delay.userId,
      workerId: worker.id,
      projectId: delay.projectId,
      taskId: delay.taskId,
      type: "company.worker_delay",
      title: "Retard signale",
      message: `${worker.name}: ${delay.reason}${delay.estimatedDelay ? ` (${delay.estimatedDelay})` : ""}`,
    });
    addHistory(db, {
      userId: delay.userId,
      type: "worker.delay",
      label: `Retard signale: ${delay.reason}`,
      entityId: delay.id,
      entityType: "worker-delay",
      meta: { workerId: worker.id, projectId: delay.projectId, taskId: delay.taskId },
    });
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "read-notification") {
    const notification = (db.notifications || []).find((item) => item.id === body.notificationId && item.workerId === worker.id);
    if (notification) notification.read = true;
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  if (action === "bulk-read-notifications") {
    (db.notifications || []).forEach((notification) => {
      if (notification.workerId === worker.id) notification.read = true;
    });
    await writeDb(db);
    return ok(buildWorkerPortal(db, worker));
  }

  return ok({ error: "Action ouvrier inconnue." }, 400);
}
