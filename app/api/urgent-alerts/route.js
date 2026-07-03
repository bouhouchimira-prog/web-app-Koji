import { ok, badRequest } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

const VALID_TYPES = ["degat", "fuite", "urgence", "incendie", "autre"];
const TYPE_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

// Use the raw userId from the URL — NOT getUserScope, which strips admin IDs to "".
// Alerts are always scoped by the company user's real ID.
function getRawUserId(request) {
  return new URL(request.url).searchParams.get("userId") || "";
}

export async function GET(request) {
  const db = await readDb();
  const userId = getRawUserId(request);
  if (!userId) return ok({ alerts: [] });
  const alerts = (db.urgentAlerts || [])
    .filter((a) => a.userId === userId && a.status !== "resolved")
    .map((a) => fixObjectText(a));
  return ok({ alerts });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const now = new Date().toISOString();

  const projectId = String(body.projectId || "");
  const quoteId   = String(body.quoteId   || "");
  const rawTaskIds = Array.isArray(body.taskIds) ? body.taskIds : (body.taskId ? [body.taskId] : []);
  const taskIds = rawTaskIds.map(String).filter(Boolean);
  const source    = body.source === "client" ? "client" : "worker";
  const alertType = VALID_TYPES.includes(body.type) ? body.type : "urgence";
  const message   = fixText(body.message || "");
  const senderName = fixText(body.senderName || (source === "client" ? "Client" : "Ouvrier"));

  if (!message) return badRequest("Le message est requis.");

  // Resolve company userId — try every available reference, most specific first.
  let companyUserId = "";

  // 1. Direct quote lookup — most reliable (client always sends quoteId = URL param)
  if (!companyUserId && quoteId) {
    const quote = (db.quotes || []).find((q) => q.id === quoteId);
    companyUserId = quote?.userId || "";
  }

  // 2. Project lookup
  if (!companyUserId && projectId) {
    const project = (db.projects || []).find((p) => p.id === projectId);
    companyUserId = project?.userId || "";
  }

  // 3. Any quote linked to that project
  if (!companyUserId && projectId) {
    const linkedQuote = (db.quotes || []).find((q) => q.projectId === projectId);
    companyUserId = linkedQuote?.userId || "";
  }

  // 4. Task lookup
  if (!companyUserId && taskIds.length) {
    const task = (db.tasks || []).find((t) => taskIds.includes(t.id));
    companyUserId = task?.userId || "";
  }

  if (!companyUserId) {
    return badRequest("Impossible d'identifier le compte entreprise destinataire de cette alerte.");
  }

  // Resolve human-readable project title
  const project = (db.projects || []).find((p) => p.id === projectId);
  const quote    = !project && quoteId ? (db.quotes || []).find((q) => q.id === quoteId) : null;
  const projectTitle = fixText(
    project?.title || project?.name ||
    quote?.project || quote?.projectName ||
    body.projectTitle || "Chantier"
  );

  // Resolve task labels from DB (more accurate than what client sends)
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
    quoteId,
    taskIds,
    taskLabels,
    status: "active",
    createdAt: now
  };

  db.urgentAlerts.unshift(alert);

  // Company notification (appears in bell + notifications page)
  db.notifications.unshift({
    id: `notif-ua-${Date.now()}`,
    userId: companyUserId,
    type: "urgent.alert",
    title: `🚨 ${TYPE_LABELS[alertType]} — ${projectTitle}`,
    message: `${senderName} (${source === "client" ? "client" : "ouvrier"}) : ${message.slice(0, 120)}`,
    alertId: alert.id,
    projectId,
    actionUrl: projectId ? `/chantiers?project=${projectId}` : "/chantiers",
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
    meta: { source, senderName, projectId, quoteId, taskIds }
  });

  await writeDb(db);
  return ok({ alert: fixObjectText(alert) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = String(body.userId || "");
  const now = new Date().toISOString();

  if (!userId || !Array.isArray(db.urgentAlerts)) return ok({ error: "Alerte introuvable." }, 404);

  // Match by both id and company userId (raw, not scoped)
  const index = db.urgentAlerts.findIndex((a) => a.id === body.id && a.userId === userId);
  if (index === -1) return ok({ error: "Alerte introuvable." }, 404);

  if (body.action === "resolve") {
    db.urgentAlerts[index].status = "resolved";
    db.urgentAlerts[index].resolvedAt = now;
  }

  await writeDb(db);
  return ok({ alert: fixObjectText(db.urgentAlerts[index]) });
}
