import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { addWorkerNotification } from "../../../lib/worker-portal";
import { fixObjectText, fixText } from "../../../lib/text";

const AUDIENCES = new Set(["client", "workers", "both"]);

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();
  const userId = body.userId || "";
  const taskId = body.taskId || "";
  const message = fixText(body.message || "");
  const audience = AUDIENCES.has(body.audience) ? body.audience : "both";

  if (!message.trim()) return badRequest("Le message ne peut pas etre vide.");

  const task = (db.tasks || []).find((t) => t.id === taskId);
  if (!task) return badRequest("Tache introuvable.", 404);

  if (!Array.isArray(db.projectDocuments)) db.projectDocuments = [];

  const companyUser = db.users.find((u) => u.id === userId);
  const senderName = fixText(companyUser?.business?.raisonSociale || companyUser?.name || "L'entreprise");
  const projectId = task.projectId || "";

  const note = {
    id: `note-${Date.now()}`,
    userId,
    senderName,
    projectId,
    taskId,
    taskLabel: fixText(task.label || ""),
    type: "Note",
    title: fixText(message.slice(0, 60) || "Note"),
    notes: message,
    audience,
    source: "company",
    createdAt: now
  };
  db.projectDocuments.unshift(note);

  const notifMessage = `Note sur "${task.label}" : ${message.slice(0, 120)}`;

  if (audience === "client" || audience === "both") {
    const linkedQuote = (db.quotes || []).find((q) => q.projectId === projectId);
    if (linkedQuote?.clientPortalUserId) {
      if (!Array.isArray(db.notifications)) db.notifications = [];
      db.notifications.unshift({
        id: `notif-note-${Date.now()}`,
        userId: linkedQuote.clientPortalUserId,
        accountType: "particulier",
        type: "company.note",
        title: "Nouvelle note de l'entreprise",
        message: notifMessage,
        taskId,
        taskLabel: fixText(task.label || ""),
        projectId,
        quoteId: linkedQuote.id || "",
        read: false,
        createdAt: now
      });
    }
  }

  if (audience === "workers" || audience === "both") {
    const requestedWorkerIds = Array.isArray(body.workerIds) ? body.workerIds : (task.workerIds || []);
    const selectedWorkers = (db.workers || []).filter((w) => (task.workerIds || []).includes(w.id) && requestedWorkerIds.includes(w.id));
    selectedWorkers.forEach((worker) => {
      addWorkerNotification(db, {
        userId,
        workerId: worker.id,
        projectId,
        taskId,
        type: "company.note",
        title: "Nouvelle note de l'entreprise",
        message: notifMessage
      });
    });
  }

  addHistory(db, {
    userId,
    type: "task.company_note",
    label: `Note entreprise sur "${task.label}" (${audience})`,
    entityId: note.id,
    entityType: "task-note",
    meta: { taskId, projectId, audience, message: message.slice(0, 80) }
  });

  await writeDb(db);
  return ok({ document: fixObjectText(note) }, 201);
}

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId") || "";
  const docs = (db.projectDocuments || []).filter((d) => d.source === "company" && !d.replyToId && (taskId ? d.taskId === taskId : false));
  return ok({ documents: fixObjectText(docs) });
}
