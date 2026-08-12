import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { fixObjectText, fixText } from "../../../lib/text";

function normalizeDocument(document) {
  return {
    ...fixObjectText(document),
    amount: Number(document.amount || 0)
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const quoteId = url.searchParams.get("quoteId") || "";

  let documents = scopedItems(db.projectDocuments, userId);
  if (projectId) documents = documents.filter((document) => document.projectId === projectId);
  if (quoteId) documents = documents.filter((document) => document.quoteId === quoteId);

  return ok({ projectDocuments: documents.map(normalizeDocument) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const now = new Date().toISOString();
  const project = body.projectId ? db.projects.find((item) => item.id === body.projectId) : null;

  const document = {
    id: `doc-${Date.now()}`,
    userId,
    projectId: body.projectId || "",
    quoteId: body.quoteId || "",
    invoiceId: body.invoiceId || "",
    type: fixText(body.type || "Document"),
    title: fixText(body.title || body.fileName || "Document chantier"),
    fileName: fixText(body.fileName || ""),
    source: fixText(body.source || "manuel"),
    url: body.url || "",
    amount: Number(body.amount || 0),
    category: fixText(body.category || ""),
    notes: fixText(body.notes || ""),
    location: fixText(body.location || ""),
    projectTitle: fixText(project?.title || body.projectTitle || ""),
    createdAt: now,
    createdDate: now.slice(0, 10),
    createdTime: now.slice(11, 16)
  };

  db.projectDocuments.unshift(document);
  addHistory(db, {
    userId,
    type: "project.document.created",
    label: `Document ajoute: ${document.title}`,
    entityId: document.id,
    entityType: "projectDocument",
    meta: { projectId: document.projectId, type: document.type }
  });
  await writeDb(db);
  return ok({ projectDocument: normalizeDocument(document) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.projectDocuments, body.id, userId);
  if (index === -1) return ok({ error: "Document introuvable." }, 404);

  const document = db.projectDocuments[index];
  if (body.action === "delete") {
    db.projectDocuments.splice(index, 1);
    addHistory(db, {
      userId: document.userId || userId,
      type: "project.document.deleted",
      label: `Document supprime: ${document.title}`,
      entityId: document.id,
      entityType: "projectDocument"
    });
    await writeDb(db);
    return ok({ projectDocument: { ...normalizeDocument(document), deleted: true } });
  }

  for (const key of ["type", "title", "fileName", "source", "url", "amount", "category", "notes", "location"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      document[key] = key === "amount" ? Number(body[key] || 0) : fixObjectText(body[key]);
    }
  }
  document.updatedAt = new Date().toISOString();
  db.projectDocuments[index] = document;
  addHistory(db, {
    userId: document.userId || userId,
    type: "project.document.updated",
    label: `Document mis a jour: ${document.title}`,
    entityId: document.id,
    entityType: "projectDocument"
  });
  await writeDb(db);
  return ok({ projectDocument: normalizeDocument(document) });
}
