import { ok, badRequest } from "../../../lib/http";
import { addHistory, getUserScope, resolveUserId, readDb, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

const VALID_TYPES = ["degat", "fuite", "urgence", "incendie", "autre"];
const TYPE_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  if (!userId || !Array.isArray(db.urgentAlerts)) return ok({ alerts: [] });
  const alerts = db.urgentAlerts
    .filter((a) => a.userId === userId && a.status !== "resolved")
    .map((a) => fixObjectText(a));
  return ok({ alerts });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();

  const projectId = String(body.projectId || "");
  const rawTaskIds = Array.isArray(body.taskIds) ? body.taskIds : (body.taskId ? [body.taskId] : []);
  const taskIds = rawTaskIds.map(String).filter(Boolean);
  const source = body.source === "client" ? "client" : "worker";
  const alertType = VALID_TYPES.includes(body.type) ? body.type : "urgence";
  const message = fixText(body.message || "");
  const senderName = fixText(body.senderName || (source === "client" ? "Client" : "Ouvrier"));

  if (!message) return badRequest("Le message est requis.");
  if (!projectId && !taskIds.length) return badRequest("Chantier ou ouvrage requis.");

  // Resolve the company userId from the project or tasks
  let companyUserId = "";
  if (projectId) {
    const project = (db.projects || []).find((p) => p.id === projectId);
    companyUserId = project?.userId || "";
  }
  if (!companyUserId && taskIds.length) {
    const task = (db.tasks || []).find((t) => taskIds.includes(t.id));
    companyUserId = task?.userId || "";
  }
  if (!companyUserId) return badRequest("Chantier introuvable ou non lié à un compte entreprise.");

  const project = (db.projects || []).find((p) => p.id === projectId);
  const projectTitle = fixText(project?.title || project?.name || body.projectTitle || "Chantier");

  const taskLabels = taskIds.map((tid) => {
    const task = (db.tasks || []).find((t) => t.id === tid);
    return fixText(task?.label || task?.title || task?.name || "Ouvrage");
  });

  if (!Array.isArray(db.urgentAlerts)) db.urgentAlerts = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];

  const alert = {
    id: `ua-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    userId: companyUserId,
    source,
    senderName,
    type: alertType,
    message,
    projectId,
    projectTitle,
    quoteId: fixText(body.quoteId || ""),
    taskIds,
    taskLabels,
    status: "active",
    createdAt: now
  };

  db.urgentAlerts.unshift(alert);

  db.notifications.unshift({
    id: `notif-ua-${Date.now()}`,
    userId: companyUserId,
    type: "urgent.alert",
    title: `🚨 ${TYPE_LABELS[alertType]} — ${projectTitle}`,
    message: `${senderName} (${source === "client" ? "client" : "ouvrier"}) : ${message.slice(0, 120)}`,
    alertId: alert.id,
    projectId,
    actionUrl: `/chantiers?project=${projectId}`,
    actionLabel: "Voir le chantier",
    read: false,
    createdAt: now
  });

  addHistory(db, {
    userId: companyUserId,
    type: "urgent.alert",
    label: `Alerte urgente: ${TYPE_LABELS[alertType]} — ${projectTitle}`,
    entityId: alert.id,
    entityType: "urgent-alert",
    meta: { source, senderName, projectId, taskIds }
  });

  await writeDb(db);
  return ok({ alert: fixObjectText(alert) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const now = new Date().toISOString();

  if (!Array.isArray(db.urgentAlerts)) return ok({ error: "Alerte introuvable." }, 404);
  const index = db.urgentAlerts.findIndex((a) => a.id === body.id && a.userId === userId);
  if (index === -1) return ok({ error: "Alerte introuvable." }, 404);

  if (body.action === "resolve") {
    db.urgentAlerts[index].status = "resolved";
    db.urgentAlerts[index].resolvedAt = now;
  }

  await writeDb(db);
  return ok({ alert: fixObjectText(db.urgentAlerts[index]) });
}
