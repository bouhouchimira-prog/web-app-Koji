import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function defaultBudgetItems(budgetHt = 0) {
  const global = toAmount(budgetHt);
  return [
    { id: "labor", label: "Main d'oeuvre", estimated: global, real: 0 },
    { id: "supplies", label: "Fournitures", estimated: 0, real: 0 },
    { id: "global", label: "Budget global", estimated: global, real: 0 }
  ];
}

function normalizeBudgetItems(items, budgetHt = 0) {
  const source = Array.isArray(items) && items.length > 0 ? items : defaultBudgetItems(budgetHt);
  return source.map((item, index) => ({
    id: item.id || `budget-${index}`,
    label: fixText(item.label || "Budget"),
    estimated: toAmount(item.estimated),
    real: toAmount(item.real),
    updatedAt: item.updatedAt || ""
  }));
}

function isArchiveStatus(status = "") {
  const value = String(status).toLowerCase();
  return value.includes("archive") || value.includes("termine");
}

function expensesForProject(db, projectId, userId) {
  const documents = scopedItems(db.projectDocuments, userId)
    .filter((document) => document.projectId === projectId && Number(document.amount || 0) > 0)
    .map((document) => ({
      id: document.id,
      label: document.title,
      category: document.category || document.type || "Documents",
      amount: toAmount(document.amount),
      source: "document"
    }));

  const explicitExpenses = scopedItems(db.expenses, userId)
    .filter((expense) => expense.projectId === projectId)
    .map((expense) => ({
      id: expense.id,
      label: expense.label || expense.title || "Depense",
      category: expense.category || "Autres frais",
      amount: toAmount(expense.amount),
      source: "expense"
    }));

  return [...documents, ...explicitExpenses];
}

function summarizeExpenses(expenses) {
  const byCategory = {};
  expenses.forEach((expense) => {
    const key = expense.category || "Autres frais";
    byCategory[key] = toAmount((byCategory[key] || 0) + Number(expense.amount || 0));
  });
  return {
    total: toAmount(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)),
    byCategory
  };
}

function buildProjectArchive(db, project, userId) {
  const projectQuotes = scopedItems(db.quotes, userId).filter((quote) => quote.projectId === project.id || quote.project === project.title);
  const projectInvoices = scopedItems(db.invoices, userId).filter((invoice) => invoice.projectId === project.id);
  const projectTasks = scopedItems(db.tasks, userId).filter((task) => task.projectId === project.id || task.project === project.title);
  const projectEvents = scopedItems(db.calendarEvents, userId).filter((event) => event.projectId === project.id || event.projectTitle === project.title);
  const projectDocuments = scopedItems(db.projectDocuments, userId).filter((document) => document.projectId === project.id);
  const projectHistory = scopedItems(db.history, userId).filter((entry) => {
    return entry.entityId === project.id
      || entry.meta?.projectId === project.id
      || projectTasks.some((task) => task.id === entry.entityId)
      || projectEvents.some((event) => event.id === entry.entityId)
      || projectQuotes.some((quote) => quote.id === entry.entityId)
      || projectInvoices.some((invoice) => invoice.id === entry.entityId)
      || projectDocuments.some((document) => document.id === entry.entityId);
  });
  const expenses = expensesForProject(db, project.id, userId);
  const expenseSummary = summarizeExpenses(expenses);
  const signedQuote = projectQuotes.find((quote) => quote.status === "Signe" || quote.signatureStatus === "Signe") || projectQuotes[0];
  const signedQuoteTotal = toAmount(signedQuote?.totalTtc || signedQuote?.totalHt || project.budgetHt || 0);
  const billedTotal = toAmount(projectInvoices.filter((invoice) => invoice.status !== "Annulee").reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0));
  const paidTotal = toAmount(projectInvoices.filter((invoice) => invoice.status === "Payee").reduce((sum, invoice) => sum + Number(invoice.amountTtc || 0), 0));
  const remainingToPay = toAmount(Math.max(0, billedTotal - paidTotal));
  const gain = toAmount(signedQuoteTotal - expenseSummary.total);
  const now = new Date().toISOString();

  return {
    id: project.archiveId || `arch-${project.id}`,
    userId: project.userId || userId,
    projectId: project.id,
    projectTitle: project.title,
    client: project.client,
    status: project.status,
    archivedAt: project.archivedAt || now,
    createdAt: project.createdAt || now,
    summary: {
      signedQuoteTotal,
      expensesTotal: expenseSummary.total,
      expensesByCategory: expenseSummary.byCategory,
      billedTotal,
      paidTotal,
      remainingToPay,
      gain
    },
    tasks: projectTasks,
    appointments: projectEvents,
    quotes: projectQuotes,
    invoices: projectInvoices,
    documents: projectDocuments,
    expenses,
    history: projectHistory,
    updatedAt: now
  };
}

function upsertArchive(db, archive) {
  const index = db.projectArchives.findIndex((item) => item.id === archive.id || item.projectId === archive.projectId);
  if (index === -1) db.projectArchives.unshift(archive);
  else db.projectArchives[index] = archive;
}

function createBudgetAlerts(db, project, userId) {
  (project.budgetItems || []).forEach((item) => {
    if (Number(item.real || 0) <= Number(item.estimated || 0)) return;
    db.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      userId: project.userId || userId,
      type: "budget.alert",
      title: "Depassement de budget",
      message: `${project.title}: ${item.label} depasse le budget prevu.`,
      projectId: project.id,
      createdAt: new Date().toISOString(),
      read: false
    });
  });
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ projects: scopedItems(db.projects, userId).map((project) => ({
    ...fixObjectText(project),
    budgetItems: normalizeBudgetItems(project.budgetItems, project.budgetHt)
  })) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const now = new Date().toISOString();
  const project = {
    id: `p-${Date.now()}`,
    userId,
    reference: `KOJI-2026-${String(db.projects.length + 22).padStart(3, "0")}`,
    title: fixText(body.title || "Nouveau chantier"),
    client: fixText(body.client || "Client"),
    clientEmail: body.clientEmail || "",
    address: fixText(body.address || ""),
    status: fixText(body.status || "Devis a preparer"),
    progress: 0,
    budgetHt: toAmount(body.budgetHt),
    budgetItems: normalizeBudgetItems(body.budgetItems, body.budgetHt),
    notes: fixText(body.notes || ""),
    dueDate: body.dueDate || now.slice(0, 10),
    startDate: body.startDate || "",
    endDate: body.endDate || "",
    createdAt: now,
    createdDate: now.slice(0, 10),
    createdTime: now.slice(11, 16)
  };
  db.projects.unshift(project);
  addHistory(db, {
    userId,
    type: "project.created",
    label: `Chantier cree: ${project.title}`,
    entityId: project.id,
    entityType: "project"
  });
  await writeDb(db);
  return ok({ project }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.projects, body.id, userId);
  if (index === -1) return ok({ error: "Chantier introuvable." }, 404);

  const project = db.projects[index];
  const now = new Date().toISOString();
  const action = body.action || "update";

  if (action === "archive") {
    project.status = "Archive";
    project.archivedAt = now;
  } else if (action === "finish") {
    project.status = "Termine";
    project.finishedAt = now;
  } else if (action === "restore") {
    project.status = fixText(body.status || "A planifier");
    project.archivedAt = "";
    project.restoredAt = now;
  } else if (action === "delete") {
    db.projects.splice(index, 1);
    addHistory(db, {
      userId: project.userId || userId,
      type: "project.deleted",
      label: `Chantier supprime: ${project.title}`,
      entityId: project.id,
      entityType: "project"
    });
    await writeDb(db);
    return ok({ project: { ...project, deleted: true } });
  } else {
    const allowed = [
      "title",
      "client",
      "clientEmail",
      "address",
      "status",
      "progress",
      "budgetHt",
      "budgetItems",
      "dueDate",
      "quoteId",
      "startDate",
      "endDate",
      "notes"
    ];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (key === "progress" || key === "budgetHt") project[key] = toAmount(body[key]);
        else if (key === "budgetItems") project[key] = normalizeBudgetItems(body[key], project.budgetHt);
        else project[key] = fixObjectText(body[key]);
      }
    }
  }

  if (!Array.isArray(project.budgetItems)) project.budgetItems = normalizeBudgetItems(project.budgetItems, project.budgetHt);
  if (body.budgetItems) createBudgetAlerts(db, project, userId);
  project.updatedAt = now;

  if (isArchiveStatus(project.status)) {
    project.archivedAt = project.archivedAt || now;
    const archive = buildProjectArchive(db, project, project.userId || userId);
    project.archiveId = archive.id;
    project.archiveSummary = archive.summary;
    upsertArchive(db, archive);
  }

  db.projects[index] = project;
  addHistory(db, {
    userId: project.userId || userId,
    type: action === "archive" ? "project.archived" : action === "restore" ? "project.restored" : action === "finish" ? "project.finished" : "project.updated",
    label: action === "archive" ? `Chantier archive: ${project.title}` : action === "restore" ? `Chantier restaure: ${project.title}` : action === "finish" ? `Chantier termine: ${project.title}` : `Chantier mis a jour: ${project.title}`,
    entityId: project.id,
    entityType: "project"
  });
  await writeDb(db);
  return ok({ project: { ...project, budgetItems: normalizeBudgetItems(project.budgetItems, project.budgetHt) } });
}
