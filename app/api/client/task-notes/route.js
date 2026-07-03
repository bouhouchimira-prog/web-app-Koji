import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { addCompanyNotification, addWorkerNotification } from "../../../../lib/worker-portal";
import { fixObjectText, fixText } from "../../../../lib/text";

function normalizeEmail(v = "") { return String(v || "").trim().toLowerCase(); }
function normalizePhone(v = "") { return String(v || "").replace(/\D/g, ""); }

function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();
  const userId = body.userId || "";
  const taskId = body.taskId || "";

  if (!body.notes?.trim() && !body.url && !body.title?.trim()) {
    return badRequest("Ajoutez un message, un titre ou un fichier.");
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) return badRequest("Client introuvable.", 403);

  const email = normalizeEmail(user.email);
  const task = (db.tasks || []).find((t) => t.id === taskId);
  if (!task) return badRequest("Tache introuvable.", 404);

  const projectsById = new Map((db.projects || []).map((p) => [p.id, p]));
  const linkedQuote = (db.quotes || []).find(
    (q) => (q.id === task.quoteId || q.projectId === task.projectId) &&
      quoteBelongsToClient(q, projectsById.get(q.projectId), user, email)
  );
  if (!linkedQuote) return badRequest("Acces interdit.", 403);

  if (!Array.isArray(db.projectDocuments)) db.projectDocuments = [];

  const clientName = fixText(user.name || user.email || "Client");
  const noteTitle = fixText(body.title || body.notes?.slice(0, 60) || body.type || "Message client");

  const doc = {
    id: `cdoc-${Date.now()}`,
    userId: task.userId || "",
    clientUserId: userId,
    clientName,
    projectId: task.projectId || "",
    quoteId: linkedQuote.id,
    taskId,
    taskLabel: fixText(task.label || ""),
    type: fixText(body.type || "Note"),
    title: noteTitle,
    fileName: fixText(body.fileName || ""),
    url: body.url || "",
    notes: fixText(body.notes || ""),
    source: "client",
    createdAt: now
  };

  db.projectDocuments.unshift(doc);

  // Notify the company (entreprise)
  const projectId = task.projectId || "";
  const notifMessage = `${clientName} — ${doc.type} sur "${task.label}": ${doc.notes || doc.title}`;
  addCompanyNotification(db, {
    userId: task.userId || "",
    projectId,
    taskId,
    type: "client.note",
    title: `Message client : ${doc.type}`,
    message: notifMessage,
    actionUrl: projectId ? `/chantiers?project=${projectId}` : "",
    actionLabel: "Voir le chantier",
    meta: {
      clientName,
      taskLabel: task.label || "",
      noteType: doc.type,
      noteTitle: doc.title,
      noteText: doc.notes,
      hasFile: Boolean(doc.url),
      projectId,
      taskId
    }
  });

  // Also notify assigned workers
  if (Array.isArray(task.workerIds) && task.workerIds.length) {
    const assignedWorkers = (db.workers || []).filter((w) => task.workerIds.includes(w.id));
    for (const worker of assignedWorkers) {
      addWorkerNotification(db, {
        userId: task.userId || "",
        workerId: worker.id,
        projectId,
        taskId,
        type: "client.note",
        title: `Message du client : ${doc.type}`,
        message: notifMessage
      });
    }
  }

  addHistory(db, {
    userId: task.userId || "",
    type: "task.client_note",
    label: `Message client (${doc.type}) sur "${task.label}"`,
    entityId: doc.id,
    entityType: "client-document",
    meta: { clientUserId: userId, clientName, taskId, projectId, noteType: doc.type }
  });

  await writeDb(db);
  return ok({ document: fixObjectText(doc) }, 201);
}

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId") || "";
  const projectId = url.searchParams.get("projectId") || "";
  const docs = (db.projectDocuments || []).filter(
    (d) => d.source === "client" && (taskId ? d.taskId === taskId : d.projectId === projectId)
  );
  return ok({ documents: fixObjectText(docs) });
}
