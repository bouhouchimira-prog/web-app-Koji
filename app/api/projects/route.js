import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserIdFromRequest, readDb, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  return ok({ projects: scopedItems(db.projects, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const project = {
    id: `p-${Date.now()}`,
    userId,
    reference: `KOJI-2026-${String(db.projects.length + 22).padStart(3, "0")}`,
    title: body.title || "Nouveau chantier",
    client: body.client || "Client",
    clientEmail: body.clientEmail || "",
    address: body.address || "",
    status: body.status || "Devis a preparer",
    progress: 0,
    budgetHt: Number(body.budgetHt || 0),
    dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
    startDate: body.startDate || "",
    endDate: body.endDate || "",
    createdAt: new Date().toISOString()
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
  const userId = body.userId || "";
  const index = findScopedIndex(db.projects, body.id, userId);
  if (index === -1) return ok({ error: "Chantier introuvable." }, 404);

  const project = db.projects[index];
  if (body.action === "archive") {
    project.status = "Archive";
    project.archivedAt = new Date().toISOString();
  } else if (body.action === "restore") {
    project.status = body.status || "A planifier";
    project.archivedAt = "";
    project.restoredAt = new Date().toISOString();
  } else if (body.action === "delete") {
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
    const allowed = ["title", "client", "clientEmail", "address", "status", "progress", "budgetHt", "dueDate", "quoteId", "startDate", "endDate"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        project[key] = key === "progress" || key === "budgetHt" ? Number(body[key] || 0) : body[key];
      }
    }
  }

  project.updatedAt = new Date().toISOString();
  db.projects[index] = project;
  addHistory(db, {
    userId: project.userId || userId,
    type: body.action === "archive" ? "project.archived" : body.action === "restore" ? "project.restored" : "project.updated",
    label: body.action === "archive" ? `Chantier archive: ${project.title}` : body.action === "restore" ? `Chantier restaure: ${project.title}` : `Chantier mis a jour: ${project.title}`,
    entityId: project.id,
    entityType: "project"
  });
  await writeDb(db);
  return ok({ project });
}
