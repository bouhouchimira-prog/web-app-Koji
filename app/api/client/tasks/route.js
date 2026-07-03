import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixObjectText } from "../../../../lib/text";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();

  const userId = body.userId || "";
  const taskId = body.taskId || "";
  const action = body.action || "validate";

  const user = db.users.find((item) => item.id === userId);
  if (!user) return badRequest("Client introuvable.", 403);

  const email = normalizeEmail(user.email);
  const task = (db.tasks || []).find((item) => item.id === taskId);
  if (!task) return badRequest("Tache introuvable.", 404);

  const projectsById = new Map((db.projects || []).map((p) => [p.id, p]));
  const linkedQuote = (db.quotes || []).find(
    (q) => (q.id === task.quoteId || q.projectId === task.projectId) &&
      quoteBelongsToClient(q, projectsById.get(q.projectId), user, email)
  );
  if (!linkedQuote) return badRequest("Acces interdit a cette tache.", 403);

  if (action === "client-validate") {
    task.clientValidatedAt = now;
    task.clientValidationStatus = "Valide";
    task.status = "Valide par client";
    task.updatedAt = now;
    addHistory(db, {
      userId: task.userId || "",
      type: "task.client_validated",
      label: `Tache validee par le client : ${task.label}`,
      entityId: task.id,
      entityType: "task",
      meta: { clientUserId: userId, projectId: task.projectId || "" }
    });
    const taskIndex = db.tasks.findIndex((item) => item.id === taskId);
    if (taskIndex !== -1) db.tasks[taskIndex] = task;
    await writeDb(db);
    return ok({ task: fixObjectText(task) });
  }

  return badRequest("Action inconnue.", 400);
}
