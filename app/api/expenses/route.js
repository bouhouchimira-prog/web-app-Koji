import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserIdFromRequest, readDb, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function normalizeExpense(expense) {
  return {
    ...fixObjectText(expense),
    amount: toAmount(expense.amount)
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const quoteId = url.searchParams.get("quoteId") || "";

  let expenses = scopedItems(db.expenses, userId);
  if (projectId) expenses = expenses.filter((expense) => expense.projectId === projectId);
  if (quoteId) expenses = expenses.filter((expense) => expense.quoteId === quoteId);

  return ok({ expenses: expenses.map(normalizeExpense) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const now = new Date().toISOString();
  const amount = toAmount(body.amount);

  if (!body.projectId) return badRequest("Chantier obligatoire.", 400);
  if (amount <= 0) return badRequest("Le montant doit etre superieur a zero.", 400);

  const project = db.projects.find((item) => item.id === body.projectId);
  const expense = {
    id: `exp-${Date.now()}`,
    userId,
    projectId: body.projectId || "",
    quoteId: body.quoteId || project?.quoteId || "",
    label: fixText(body.label || body.title || "Depense chantier"),
    category: fixText(body.category || "Autres frais"),
    amount,
    source: fixText(body.source || "manuel"),
    location: fixText(body.location || ""),
    notes: fixText(body.notes || ""),
    projectTitle: fixText(project?.title || body.projectTitle || ""),
    createdAt: now,
    createdDate: now.slice(0, 10),
    createdTime: now.slice(11, 16),
    updatedAt: now
  };

  db.expenses.unshift(expense);
  addHistory(db, {
    userId,
    type: "expense.created",
    label: `Depense ajoutee: ${expense.label}`,
    entityId: expense.id,
    entityType: "expense",
    meta: { projectId: expense.projectId, amount: expense.amount, category: expense.category }
  });

  await writeDb(db);
  return ok({ expense: normalizeExpense(expense) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const index = findScopedIndex(db.expenses, body.id, userId);
  if (index === -1) return badRequest("Depense introuvable.", 404);

  const expense = db.expenses[index];
  if (body.action === "delete") {
    db.expenses.splice(index, 1);
    addHistory(db, {
      userId: expense.userId || userId,
      type: "expense.deleted",
      label: `Depense supprimee: ${expense.label}`,
      entityId: expense.id,
      entityType: "expense",
      meta: { projectId: expense.projectId }
    });
    await writeDb(db);
    return ok({ expense: { ...normalizeExpense(expense), deleted: true } });
  }

  for (const key of ["label", "title", "category", "amount", "source", "location", "notes"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === "amount") expense[key] = toAmount(body[key]);
      else if (key === "title") expense.label = fixText(body[key]);
      else expense[key] = fixObjectText(body[key]);
    }
  }

  expense.updatedAt = new Date().toISOString();
  db.expenses[index] = expense;
  addHistory(db, {
    userId: expense.userId || userId,
    type: "expense.updated",
    label: `Depense mise a jour: ${expense.label}`,
    entityId: expense.id,
    entityType: "expense",
    meta: { projectId: expense.projectId }
  });

  await writeDb(db);
  return ok({ expense: normalizeExpense(expense) });
}
