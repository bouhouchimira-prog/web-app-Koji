import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";

// Quotes/chantiers now live in Supabase; invoices stay local for now (not yet
// shared with the mobile app), so this fetches the two via the service_role
// key just to validate/read them, same shape as the old local-JSON lookup.
function mapChantierLite(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.reference || "Chantier",
    client: row.client_email ? row.client_email.split("@")[0] : "Client",
    clientEmail: row.client_email || "",
    budgetHt: 0
  };
}

const ACTIVE_INVOICE_STATUSES = new Set(["Brouillon", "Emise", "Payee"]);

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function quoteTotal(quote, project) {
  return toAmount(quote?.totalTtc || quote?.totalHt || project?.budgetHt || 0);
}

function normalizeInvoice(invoice) {
  return {
    ...fixObjectText(invoice),
    amountTtc: toAmount(invoice.amountTtc),
    totalQuoteTtc: toAmount(invoice.totalQuoteTtc),
    alreadyInvoicedBefore: toAmount(invoice.alreadyInvoicedBefore),
    remainingAfter: toAmount(invoice.remainingAfter),
    percent: toAmount(invoice.percent)
  };
}

function activeInvoicesFor(db, quoteId, projectId, userId) {
  return scopedItems(db.invoices, userId).filter((invoice) => {
    const sameQuote = quoteId && invoice.quoteId === quoteId;
    const sameProject = projectId && invoice.projectId === projectId;
    return (sameQuote || sameProject) && ACTIVE_INVOICE_STATUSES.has(invoice.status);
  });
}

function buildBillingSummary(db, quote, project, userId) {
  const totalQuoteTtc = quoteTotal(quote, project);
  const invoices = activeInvoicesFor(db, quote?.id, project?.id, userId);
  const alreadyInvoiced = toAmount(invoices.reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0));
  const remaining = toAmount(Math.max(0, totalQuoteTtc - alreadyInvoiced));
  return {
    totalQuoteTtc,
    alreadyInvoiced,
    remaining,
    status: totalQuoteTtc <= 0
      ? "A definir"
      : remaining <= 0.01
        ? "Soldee"
        : alreadyInvoiced > 0
          ? "Partielle"
          : "A facturer"
  };
}

function amountFromMode(body, summary) {
  const mode = body.amountMode || "fixed";
  if (mode === "remaining") return summary.remaining;
  if (mode === "percent") return summary.totalQuoteTtc * (Number(body.percent || 0) / 100);
  if (mode === "deposit") return summary.totalQuoteTtc * (Number(body.depositPercent || body.percent || 30) / 100);
  return Number(body.fixedAmount || body.amountTtc || 0);
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  return ok({ invoices: scopedItems(db.invoices, userId).map(normalizeInvoice) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const now = new Date().toISOString();

  // Invoices can also be created directly from an intervention report (no
  // signed devis involved) — that's a simpler, self-contained path that
  // never touches the Supabase quotes/chantiers lookup below.
  if (body.interventionId) {
    const interventionIndex = findScopedIndex(db.interventions, body.interventionId, userId);
    if (interventionIndex === -1) return badRequest("Intervention introuvable.", 404);
    const intervention = db.interventions[interventionIndex];

    const amountTtc = toAmount(body.amountTtc);
    if (amountTtc <= 0) return badRequest("Le montant de la facture doit être supérieur à zéro.", 400);

    const invoice = {
      id: `fac-${Date.now()}`,
      userId: intervention.userId || userId,
      invoiceNumber: `FAC-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(4, "0")}`,
      projectId: intervention.projectId || "",
      quoteId: "",
      quoteNumber: "",
      interventionId: intervention.id,
      projectTitle: fixText(intervention.site || "Intervention"),
      client: fixText(intervention.client || "Client"),
      clientEmail: "",
      type: fixText(body.type || "Facture d'intervention"),
      amountMode: "fixed",
      percent: 0,
      amountTtc,
      totalQuoteTtc: amountTtc,
      alreadyInvoicedBefore: 0,
      remainingAfter: 0,
      status: body.status || "Brouillon",
      dueDate: body.dueDate || now.slice(0, 10),
      issuedAt: "",
      paidAt: "",
      notes: fixText(body.notes || ""),
      createdAt: now,
      updatedAt: now
    };

    db.invoices.unshift(invoice);
    intervention.status = "facturee";
    intervention.invoiceId = invoice.id;
    intervention.updatedAt = now;
    db.interventions[interventionIndex] = intervention;

    addHistory(db, {
      userId: invoice.userId,
      type: "invoice.created",
      label: `Facture d'intervention creee: ${invoice.invoiceNumber}`,
      entityId: invoice.id,
      entityType: "invoice",
      meta: { interventionId: intervention.id, amountTtc }
    });

    await writeDb(db);
    return ok({ invoice: normalizeInvoice(invoice) }, 201);
  }

  // "Transformer ce devis en facture" (DevisEditor): a direct 1-to-1 copy —
  // same total, same number as the quote, no draft/signed requirement, no
  // percent/deposit math. Re-transforming the same quote updates its existing
  // invoice instead of creating a duplicate each time the button is clicked.
  if (body.transformQuote && body.quoteId) {
    const supabase = getSupabaseAdmin();
    const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", body.quoteId).maybeSingle();
    if (!quoteRow) return badRequest("Devis introuvable.", 404);
    const quote = mapQuote(quoteRow);
    let project = null;
    if (quote.projectId) {
      const { data: projectRow } = await supabase.from("chantiers").select("*").eq("id", quote.projectId).maybeSingle();
      if (projectRow) project = mapChantierLite(projectRow);
    }
    const amountTtc = toAmount(quote.totalTtc || quote.totalHt || 0);

    const existingIndex = db.invoices.findIndex((inv) => inv.quoteId === quote.id && inv.sourceType === "quote-transform");
    const previous = existingIndex === -1 ? null : db.invoices[existingIndex];
    const invoice = {
      id: previous?.id || `fac-${Date.now()}`,
      userId: quote.userId || userId,
      invoiceNumber: quote.quoteNumber,
      projectId: quote.projectId || "",
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      projectTitle: fixText(project?.title || quote.project || "Chantier"),
      client: fixText(project?.client || quote.client || "Client"),
      clientEmail: project?.clientEmail || quote.clientEmail || "",
      type: "Facture (devis transforme)",
      amountMode: "fixed",
      percent: 0,
      amountTtc,
      totalQuoteTtc: amountTtc,
      alreadyInvoicedBefore: 0,
      remainingAfter: 0,
      status: previous?.status || "Brouillon",
      dueDate: previous?.dueDate || now.slice(0, 10),
      issuedAt: previous?.issuedAt || "",
      paidAt: previous?.paidAt || "",
      notes: previous?.notes || "",
      sourceType: "quote-transform",
      createdAt: previous?.createdAt || now,
      updatedAt: now
    };

    if (existingIndex === -1) db.invoices.unshift(invoice);
    else db.invoices[existingIndex] = invoice;

    addHistory(db, {
      userId: invoice.userId,
      type: "invoice.created",
      label: `Devis transforme en facture: ${invoice.invoiceNumber}`,
      entityId: invoice.id,
      entityType: "invoice",
      meta: { quoteId: quote.id, amountTtc }
    });

    await writeDb(db);
    return ok({ invoice: normalizeInvoice(invoice) }, 201);
  }

  const supabase = getSupabaseAdmin();
  const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", body.quoteId).maybeSingle();
  const { data: projectRow } = await supabase.from("chantiers").select("*").eq("id", body.projectId).maybeSingle();
  const quote = quoteRow ? mapQuote(quoteRow) : null;
  const project = projectRow ? mapChantierLite(projectRow) : null;

  if (!quote) return badRequest("Devis signe introuvable.", 404);
  if (!project) return badRequest("Chantier introuvable.", 404);
  if (quote.status !== "Signe" && quote.signatureStatus !== "Signe") {
    return badRequest("La facture doit partir d'un devis signe.");
  }

  const before = buildBillingSummary(db, quote, project, userId);
  const amountTtc = toAmount(amountFromMode(body, before));

  if (before.remaining <= 0.01) return badRequest("Ce devis est déjà entièrement facturé.");
  if (amountTtc <= 0) return badRequest("Le montant de la facture doit être supérieur à zéro.");
  if (amountTtc > before.remaining + 0.01) return badRequest("Le montant dépasse le solde restant à facturer.");

  const invoice = {
    id: `fac-${Date.now()}`,
    userId: quote.userId || project.userId || userId,
    invoiceNumber: `FAC-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(4, "0")}`,
    projectId: project.id,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    projectTitle: fixText(project.title || quote.project || "Chantier"),
    client: fixText(project.client || quote.client || "Client"),
    clientEmail: project.clientEmail || quote.clientEmail || "",
    type: fixText(body.type || "Facture intermediaire"),
    amountMode: body.amountMode || "fixed",
    percent: toAmount(body.amountMode === "fixed" ? 0 : body.amountMode === "deposit" ? Number(body.depositPercent || body.percent || 30) : Number(body.percent || 0)),
    amountTtc,
    totalQuoteTtc: before.totalQuoteTtc,
    alreadyInvoicedBefore: before.alreadyInvoiced,
    remainingAfter: toAmount(Math.max(0, before.remaining - amountTtc)),
    status: body.status || "Brouillon",
    dueDate: body.dueDate || now.slice(0, 10),
    issuedAt: "",
    paidAt: "",
    notes: fixText(body.notes || ""),
    createdAt: now,
    updatedAt: now
  };

  db.invoices.unshift(invoice);
  const after = buildBillingSummary(db, quote, project, userId);

  addHistory(db, {
    userId: invoice.userId,
    type: "invoice.created",
    label: `Facture creee: ${invoice.invoiceNumber}`,
    entityId: invoice.id,
    entityType: "invoice",
    meta: { projectId: project.id, quoteId: quote.id, amountTtc }
  });

  await writeDb(db);
  return ok({ invoice: normalizeInvoice(invoice), summary: after }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.invoices, body.id, userId);
  if (index === -1) return badRequest("Facture introuvable.", 404);

  const now = new Date().toISOString();
  const invoice = db.invoices[index];
  const action = body.action || "update";

  if (action === "delete") {
    db.invoices.splice(index, 1);
  } else if (action === "issue") {
    invoice.status = "Emise";
    invoice.issuedAt = now;
  } else if (action === "pay") {
    invoice.status = "Payee";
    invoice.paidAt = now;
  } else if (action === "cancel") {
    invoice.status = "Annulee";
    invoice.cancelledAt = now;
  } else {
    for (const key of ["type", "dueDate", "notes", "status"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) invoice[key] = fixObjectText(body[key]);
    }
  }

  invoice.updatedAt = now;
  if (action !== "delete") db.invoices[index] = invoice;

  const supabase = getSupabaseAdmin();
  const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", invoice.quoteId).maybeSingle();
  const { data: projectRow } = await supabase.from("chantiers").select("*").eq("id", invoice.projectId).maybeSingle();
  const quote = quoteRow ? mapQuote(quoteRow) : null;
  const project = projectRow ? mapChantierLite(projectRow) : null;
  const summary = buildBillingSummary(db, quote, project, userId);

  addHistory(db, {
    userId: invoice.userId || userId,
    type: action === "delete" ? "invoice.deleted" : `invoice.${action}`,
    label: action === "delete" ? `Facture supprimee: ${invoice.invoiceNumber}` : `Facture mise a jour: ${invoice.invoiceNumber}`,
    entityId: invoice.id,
    entityType: "invoice"
  });

  await writeDb(db);
  return ok({ invoice: normalizeInvoice({ ...invoice, deleted: action === "delete" }), summary });
}
