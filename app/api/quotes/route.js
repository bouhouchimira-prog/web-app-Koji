import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserIdFromRequest, makeToken, readDb, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

function normalizeQuote(quote) {
  return {
    ...fixObjectText(quote),
    totalHt: Number(quote.totalHt || 0),
    totalTtc: Number(quote.totalTtc || 0)
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  return ok({ quotes: scopedItems(db.quotes, userId).map(normalizeQuote) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const now = new Date().toISOString();
  const quote = {
    id: `q-${Date.now()}`,
    userId,
    quoteNumber: `DEV-${1048 + db.quotes.length}`,
    client: fixText(body.client || "Client"),
    clientEmail: body.clientEmail || "",
    project: fixText(body.project || "Chantier"),
    projectId: body.projectId || "",
    projectReference: body.projectReference || "",
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms: fixObjectText(body.rooms || []),
    items: fixObjectText(body.items || []),
    totalHt: Number(body.totalHt || 0),
    totalTtc: Number(body.totalTtc || 0),
    createdAt: now.slice(0, 10),
    createdAtIso: now,
    updatedAt: now
  };
  db.quotes.unshift(quote);
  const projectIndex = quote.projectId ? db.projects.findIndex((project) => project.id === quote.projectId) : -1;
  if (projectIndex !== -1) {
    db.projects[projectIndex].quoteId = quote.id;
    db.projects[projectIndex].budgetHt = quote.totalHt;
    db.projects[projectIndex].status = "Devis genere";
    db.projects[projectIndex].updatedAt = now;
  }
  addHistory(db, {
    userId,
    type: "quote.created",
    label: `Devis enregistre: ${quote.quoteNumber}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { totalTtc: quote.totalTtc }
  });
  await writeDb(db);
  return ok({ quote: normalizeQuote(quote) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const index = findScopedIndex(db.quotes, body.id, userId);

  if (index === -1) {
    return ok({ error: "Devis introuvable." }, 404);
  }

  const now = new Date().toISOString();
  const quote = db.quotes[index];
  const action = body.action || "update";

  if (action === "ready") {
    quote.status = "Pret a envoyer";
    quote.readyAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.ready",
      label: `Devis pret a envoyer: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "send") {
    if (!quote.signatureToken) {
      quote.signatureToken = makeToken("sig");
    }
    const origin = new URL(request.url).origin;
    quote.signatureUrl = `${origin}/signature/${quote.signatureToken}`;
    quote.status = "Envoye";
    quote.signatureStatus = "En attente";
    quote.clientEmail = body.clientEmail || quote.clientEmail || "";
    quote.sentAt = now;
    const projectIndex = quote.projectId ? db.projects.findIndex((project) => project.id === quote.projectId) : -1;
    if (projectIndex !== -1) {
      db.projects[projectIndex].status = "En attente signature";
      db.projects[projectIndex].quoteId = quote.id;
      db.projects[projectIndex].updatedAt = now;
    }
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.sent",
      label: `Lien de signature cree: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote",
      meta: { signatureUrl: quote.signatureUrl }
    });
  }

  if (action === "archive") {
    quote.status = "Archive";
    quote.archivedAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.archived",
      label: `Devis archive: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "restore") {
    quote.status = body.status || (quote.signatureStatus === "Signe" ? "Signe" : "Brouillon");
    quote.archivedAt = "";
    quote.restoredAt = now;
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.restored",
      label: `Devis restaure: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  if (action === "delete") {
    db.quotes.splice(index, 1);
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.deleted",
      label: `Devis supprime: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
    await writeDb(db);
    return ok({ quote: { ...quote, deleted: true } });
  }

  if (action === "update") {
    const allowed = ["client", "clientEmail", "project", "projectId", "projectReference", "rooms", "items", "totalHt", "totalTtc", "status"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) quote[key] = fixObjectText(body[key]);
    }
    addHistory(db, {
      userId: quote.userId || userId,
      type: "quote.updated",
      label: `Devis mis a jour: ${quote.quoteNumber}`,
      entityId: quote.id,
      entityType: "quote"
    });
  }

  quote.updatedAt = now;
  db.quotes[index] = quote;
  await writeDb(db);
  return ok({ quote: normalizeQuote(quote) });
}
