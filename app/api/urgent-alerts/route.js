import { ok, badRequest } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { getVerifiedWorkerId } from "../../../lib/worker-session";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { fixObjectText, fixText } from "../../../lib/text";

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

const VALID_TYPES = ["degat", "fuite", "urgence", "incendie", "autre"];
const TYPE_LABELS = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

export async function GET(request) {
  const db = await readDb();
  // The company's real, verified id — deliberately NOT getUserScope/resolveUserId
  // (which strip admin ids to ""): alerts are always scoped by a real company id.
  const userId = await getVerifiedUserId(request);
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

  if (!message) return badRequest("Le message est requis.");

  // Verifie l'identite reelle de l'expediteur avant de creer l'alerte — sans
  // ca, n'importe qui pouvait injecter une fausse alerte (type "incendie",
  // nom invente) dans le fil d'une entreprise en devinant/connaissant un
  // taskId (ids previsibles, t-${Date.now()}).
  const workerId = source === "worker" ? getVerifiedWorkerId(request, body) : "";
  const portalUserId = source === "client" ? getVerifiedPortalUserId(request, body) : "";
  if (source === "worker" && !workerId) return badRequest("Session expiree. Reconnectez-vous.", 401);
  if (source === "client" && !portalUserId) return badRequest("Session expiree. Reconnectez-vous.", 401);

  const senderWorker = workerId ? (db.workers || []).find((w) => w.id === workerId) : null;
  const senderName = fixText(
    (source === "worker" ? senderWorker?.name : null) || body.senderName || (source === "client" ? "Client" : "Ouvrier")
  );

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

  // L'identite verifiee ci-dessus doit reellement appartenir a CETTE
  // entreprise — sinon un ouvrier ou client verifie mais externe pouvait
  // quand meme cibler une entreprise qui n'est pas la sienne.
  if (source === "worker" && senderWorker?.userId !== companyUserId) {
    return badRequest("Accès interdit.", 403);
  }
  if (source === "client") {
    const task = taskIds.length ? (db.tasks || []).find((t) => taskIds.includes(t.id)) : null;
    const resolvedProjectId = task?.projectId || projectId;
    const clientUser = (db.users || []).find((u) => u.id === portalUserId);
    const email = normalizeEmail(clientUser?.email);
    const supabase = getSupabaseAdmin();
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("*")
      .or(`id.eq.${quoteId || "00000000-0000-0000-0000-000000000000"},chantier_id.eq.${resolvedProjectId || "00000000-0000-0000-0000-000000000000"}`);
    let chantier = null;
    if (resolvedProjectId) {
      const { data: chantierRow } = await supabase.from("chantiers").select("*").eq("id", resolvedProjectId).maybeSingle();
      if (chantierRow) chantier = { clientEmail: chantierRow.client_email || "", clientPhone: "" };
    }
    const linkedQuote = (quoteRows || [])
      .map((row) => mapQuote(row))
      .find((q) => quoteBelongsToClient(q, chantier, clientUser, email));
    if (!linkedQuote) return badRequest("Accès interdit.", 403);
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
  const userId = await getVerifiedUserId(request, body);
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
