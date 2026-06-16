import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

function normalizeEvent(event, db) {
  const workerIds = Array.isArray(event.workerIds) ? event.workerIds : [];
  const workers = db.workers
    .filter((worker) => workerIds.includes(worker.id))
    .map((worker) => ({
      id: worker.id,
      name: worker.name,
      profession: worker.profession || worker.role || "",
      type: worker.type || "Ouvrier"
    }));

  return {
    ...fixObjectText(event),
    allDay: Boolean(event.allDay),
    progress: Number(event.progress || 0),
    workerIds,
    workers,
    tasks: Array.isArray(event.tasks) ? fixObjectText(event.tasks) : []
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const day = url.searchParams.get("day") || "";
  const month = url.searchParams.get("month") || "";

  let events = scopedItems(db.calendarEvents, userId);
  if (projectId) events = events.filter((event) => event.projectId === projectId);
  if (day) events = events.filter((event) => String(event.startAt || "").slice(0, 10) === day);
  if (month) events = events.filter((event) => String(event.startAt || "").slice(0, 7) === month);

  events = events
    .map((event) => normalizeEvent(event, db))
    .sort((a, b) => String(a.startAt || "").localeCompare(String(b.startAt || "")));

  return ok({ calendarEvents: events });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const project = body.projectId ? db.projects.find((item) => item.id === body.projectId) : null;
  const now = new Date().toISOString();
  const startAt = body.startAt || body.startDate || now;
  const endAt = body.endAt || body.endDate || startAt;
  const event = {
    id: `cal-${Date.now()}`,
    userId,
    title: fixText(body.title || project?.title || "Rendez-vous chantier"),
    eventType: fixText(body.eventType || body.type || "Chantier"),
    clientName: fixText(body.clientName || project?.client || ""),
    clientId: body.clientId || "",
    projectId: body.projectId || "",
    projectTitle: fixText(body.projectTitle || project?.title || ""),
    quoteId: body.quoteId || "",
    address: fixText(body.address || project?.address || ""),
    startAt,
    endAt,
    allDay: Boolean(body.allDay),
    status: fixText(body.status || "En attente"),
    progress: Number(body.progress || 0),
    notes: fixText(body.notes || ""),
    workerIds: Array.isArray(body.workerIds) ? body.workerIds : [],
    tasks: Array.isArray(body.tasks) ? fixObjectText(body.tasks) : [],
    createdAt: now,
    updatedAt: now
  };

  db.calendarEvents.unshift(event);
  addHistory(db, {
    userId,
    type: "calendar.created",
    label: `Evenement ajoute: ${event.title}`,
    entityId: event.id,
    entityType: "calendarEvent"
  });
  await writeDb(db);
  return ok({ calendarEvent: normalizeEvent(event, db) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.calendarEvents, body.id, userId);
  if (index === -1) return ok({ error: "Evenement introuvable." }, 404);

  const event = db.calendarEvents[index];
  if (body.action === "delete") {
    db.calendarEvents.splice(index, 1);
    addHistory(db, {
      userId: event.userId || userId,
      type: "calendar.deleted",
      label: `Evenement supprime: ${event.title}`,
      entityId: event.id,
      entityType: "calendarEvent"
    });
    await writeDb(db);
    return ok({ calendarEvent: { ...event, deleted: true } });
  }

  const allowed = [
    "title",
    "eventType",
    "clientName",
    "clientId",
    "projectId",
    "projectTitle",
    "quoteId",
    "address",
    "startAt",
    "endAt",
    "allDay",
    "status",
    "progress",
    "notes",
    "workerIds",
    "tasks"
  ];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === "progress") event[key] = Number(body[key] || 0);
      else if (key === "allDay") event[key] = Boolean(body[key]);
      else if (key === "workerIds") event[key] = Array.isArray(body[key]) ? body[key] : [];
      else if (key === "tasks") event[key] = Array.isArray(body[key]) ? fixObjectText(body[key]) : [];
      else event[key] = fixText(body[key]);
    }
  }

  if (body.action === "done") {
    event.status = "Termine";
    event.progress = 100;
  }

  event.updatedAt = new Date().toISOString();
  db.calendarEvents[index] = event;
  addHistory(db, {
    userId: event.userId || userId,
    type: "calendar.updated",
    label: `Evenement mis a jour: ${event.title}`,
    entityId: event.id,
    entityType: "calendarEvent"
  });
  await writeDb(db);
  return ok({ calendarEvent: normalizeEvent(event, db) });
}
