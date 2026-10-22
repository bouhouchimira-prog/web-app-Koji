import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
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

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const now = new Date().toISOString();

  const taskId = body.taskId || "";
  const replyToId = body.replyToId || "";
  const message = fixText(body.message || "");
  const fileName = fixText(body.fileName || "");
  const fileUrl = body.fileUrl || "";

  if (!message && !fileUrl) return badRequest("Le message ne peut pas être vide.");
  if (!userId) return badRequest("Session expiree. Reconnectez-vous.", 401);

  const task = (db.tasks || []).find((t) => t.id === taskId);
  if (!task) return badRequest("Tache introuvable.", 404);
  if (task.userId && task.userId !== userId) return badRequest("Tache introuvable.", 404);

  if (!Array.isArray(db.projectDocuments)) db.projectDocuments = [];

  const companyUser = db.users.find((u) => u.id === userId);
  const senderName = fixText(companyUser?.business?.raisonSociale || companyUser?.name || "L'entreprise");

  const reply = {
    id: `reply-${Date.now()}`,
    userId,
    senderName,
    projectId: task.projectId || "",
    taskId,
    replyToId,
    type: "Réponse entreprise",
    title: fixText(body.title || message.slice(0, 60) || "Réponse"),
    notes: message,
    fileName,
    url: fileUrl,
    source: "company",
    createdAt: now
  };

  db.projectDocuments.unshift(reply);

  // Notify the client if they have a client portal account linked to this project
  const linkedQuote = (db.quotes || []).find((q) => q.projectId === task.projectId);
  if (linkedQuote?.clientPortalUserId) {
    if (!Array.isArray(db.notifications)) db.notifications = [];
    db.notifications.unshift({
      id: `notif-reply-${Date.now()}`,
      userId: linkedQuote.clientPortalUserId,
      accountType: "particulier",
      type: "company.reply",
      title: "L'entreprise vous a répondu",
      message: `Réponse sur "${task.label}" : ${message.slice(0, 120)}`,
      taskId,
      taskLabel: fixText(task.label || ""),
      projectId: task.projectId || "",
      quoteId: linkedQuote.id || "",
      read: false,
      createdAt: now
    });
  }

  addHistory(db, {
    userId,
    type: "task.company_reply",
    label: `Réponse entreprise sur "${task.label}"`,
    entityId: reply.id,
    entityType: "task-reply",
    meta: { taskId, projectId: task.projectId || "", replyToId, message: message.slice(0, 80) }
  });

  await writeDb(db);
  return ok({ reply: fixObjectText(reply) }, 201);
}

export async function GET(request) {
  const db = await readDb();
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId") || "";
  const projectId = url.searchParams.get("projectId") || "";
  if (!taskId && !projectId) return ok({ documents: [] });

  // Called from the client-portal chantier page — verify the portal session
  // and that this particular task/project actually belongs to that client
  // (same ownership check as app/api/client/task-notes/route.js) before
  // returning the thread, otherwise a guessed taskId leaks another
  // company's internal/client notes (task ids are predictable timestamps).
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expiree. Reconnectez-vous.", 401);
  const user = db.users.find((u) => u.id === portalUserId);
  if (!user) return badRequest("Client introuvable.", 403);
  const email = normalizeEmail(user.email);

  const task = taskId ? (db.tasks || []).find((t) => t.id === taskId) : null;
  const resolvedProjectId = task?.projectId || projectId;

  const supabase = getSupabaseAdmin();
  const { data: quoteRows } = await supabase
    .from("quotes")
    .select("*")
    .or(`id.eq.${task?.quoteId || "00000000-0000-0000-0000-000000000000"},chantier_id.eq.${resolvedProjectId || "00000000-0000-0000-0000-000000000000"}`);
  let chantier = null;
  if (resolvedProjectId) {
    const { data: chantierRow } = await supabase.from("chantiers").select("*").eq("id", resolvedProjectId).maybeSingle();
    if (chantierRow) chantier = { clientEmail: chantierRow.client_email || "", clientPhone: "" };
  }
  const linkedQuote = (quoteRows || [])
    .map((row) => mapQuote(row))
    .find((q) => quoteBelongsToClient(q, chantier, user, email));
  if (!linkedQuote) return badRequest("Acces interdit.", 403);

  const docs = (db.projectDocuments || []).filter(
    (d) => ["client", "company"].includes(d.source) &&
      (taskId ? d.taskId === taskId : d.projectId === projectId)
  );

  return ok({ documents: fixObjectText(docs) });
}
