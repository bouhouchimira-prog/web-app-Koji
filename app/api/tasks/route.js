import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { fixObjectText, fixText } from "../../../lib/text";
import { addWorkerNotification } from "../../../lib/worker-portal";

function normalizeTask(task) {
  return {
    ...fixObjectText(task),
    quantity: Number(task.quantity || 0),
    durationHours: Number(task.durationHours || 0)
  };
}

function notifyAssignedWorkers(db, task, workers) {
  workers.forEach((worker) => {
    addWorkerNotification(db, {
      userId: task.userId,
      workerId: worker.id,
      projectId: task.projectId || "",
      taskId: task.id,
      type: "worker.assignment",
      title: "Nouvelle affectation",
      message: `${task.project || "Chantier"} - ${task.label}`,
    });
  });
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  return ok({ tasks: scopedItems(db.tasks, userId).map(normalizeTask) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const task = {
    id: `t-${Date.now()}`,
    userId,
    label: fixText(body.label || "Nouvelle tache"),
    project: fixText(body.project || "Chantier"),
    projectId: body.projectId || "",
    room: fixText(body.room || "Piece"),
    dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
    startDate: body.startDate || body.dueDate || "",
    endDate: body.endDate || "",
    startTime: body.startTime || "",
    endTime: body.endTime || "",
    location: fixText(body.location || ""),
    durationHours: Number(body.durationHours || 1),
    estimatedHours: Number(body.estimatedHours || body.durationHours || 1),
    assignedTo: fixText(body.assignedTo || "Equipe"),
    workerIds: Array.isArray(body.workerIds) ? body.workerIds : [],
    participantType: body.participantType || "Ouvriers",
    quoteId: body.quoteId || "",
    quoteItemId: body.quoteItemId || "",
    code: fixText(body.code || ""),
    unit: fixText(body.unit || ""),
    quantity: Number(body.quantity || 0),
    supplyNeeds: Array.isArray(body.supplyNeeds) ? fixObjectText(body.supplyNeeds) : [],
    subWorks: Array.isArray(body.subWorks) ? fixObjectText(body.subWorks) : [],
    status: body.status || "À faire",
    done: false,
    createdAt: new Date().toISOString()
  };
  db.tasks.unshift(task);
  const assignedWorkers = db.workers.filter((worker) => task.workerIds.includes(worker.id));
  if (assignedWorkers.length) {
    task.assignedTo = fixText(assignedWorkers.map((worker) => worker.name).join(", "));
    task.notifiedAt = new Date().toISOString();
    notifyAssignedWorkers(db, task, assignedWorkers);
  }
  addHistory(db, {
    userId,
    type: "task.created",
    label: `Tache ajoutee: ${task.label}`,
    entityId: task.id,
    entityType: "task"
  });
  await writeDb(db);
  return ok({ task: normalizeTask(task) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.tasks, body.id, userId);
  if (index === -1) return ok({ error: "Tache introuvable." }, 404);

  const task = db.tasks[index];
  if (body.action === "delete") {
    db.tasks.splice(index, 1);
    addHistory(db, {
      userId: task.userId || userId,
      type: "task.deleted",
      label: `Tache supprimee: ${task.label}`,
      entityId: task.id,
      entityType: "task"
    });
    await writeDb(db);
    return ok({ task: { ...task, deleted: true } });
  }
  if (body.action === "toggle") {
    task.done = !task.done;
    task.status = task.done ? "Terminee" : "À faire";
    task.pendingValidation = false;
    if (task.done) {
      task.validatedAt = new Date().toISOString();
      task.validatedBy = "patron";
    }
  } else if (body.action === "validate") {
    task.done = true;
    task.pendingValidation = false;
    task.status = "Terminee";
    task.validatedAt = new Date().toISOString();
    task.validatedBy = "patron";
  } else if (body.action === "assign") {
    const workerIds = Array.isArray(body.workerIds) ? body.workerIds : [];
    const workers = db.workers.filter((worker) => workerIds.includes(worker.id));
    const previousWorkerIds = new Set(Array.isArray(task.workerIds) ? task.workerIds : []);
    task.workerIds = workerIds;
    task.assignedTo = fixText(workers.map((worker) => worker.name).join(", ") || task.assignedTo || "Equipe");
    task.participantType = fixText(body.participantType || task.participantType || "Ouvriers");
    if (Object.prototype.hasOwnProperty.call(body, "startDate")) task.startDate = body.startDate;
    if (Object.prototype.hasOwnProperty.call(body, "endDate")) task.endDate = body.endDate;
    if (Object.prototype.hasOwnProperty.call(body, "dueDate")) task.dueDate = body.dueDate;
    if (Object.prototype.hasOwnProperty.call(body, "startTime")) task.startTime = body.startTime;
    if (Object.prototype.hasOwnProperty.call(body, "endTime")) task.endTime = body.endTime;
    if (Object.prototype.hasOwnProperty.call(body, "location")) task.location = fixText(body.location);
    if (Object.prototype.hasOwnProperty.call(body, "supplyNeeds")) task.supplyNeeds = Array.isArray(body.supplyNeeds) ? fixObjectText(body.supplyNeeds) : [];
    if (Object.prototype.hasOwnProperty.call(body, "subWorks")) task.subWorks = Array.isArray(body.subWorks) ? fixObjectText(body.subWorks) : [];
    task.status = "Planifiee";
    task.notifiedAt = new Date().toISOString();
    notifyAssignedWorkers(db, task, workers.filter((worker) => !previousWorkerIds.has(worker.id)));
  } else {
    const allowed = ["label", "project", "projectId", "room", "dueDate", "startDate", "endDate", "startTime", "endTime", "location", "durationHours", "estimatedHours", "assignedTo", "workerIds", "participantType", "status", "done", "pendingValidation", "quoteId", "quoteItemId", "code", "unit", "quantity", "supplyNeeds", "subWorks"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        task[key] = key === "durationHours" || key === "estimatedHours" || key === "quantity" ? Number(body[key] || 0) : key === "done" || key === "pendingValidation" ? Boolean(body[key]) : fixObjectText(body[key]);
      }
    }
  }
  task.updatedAt = new Date().toISOString();
  db.tasks[index] = task;
  addHistory(db, {
    userId: task.userId || userId,
    type: body.action === "assign" ? "task.assigned" : task.done ? "task.done" : "task.updated",
    label: body.action === "assign" ? `Tache affectee: ${task.label}` : task.done ? `Tache terminee: ${task.label}` : `Tache mise a jour: ${task.label}`,
    entityId: task.id,
    entityType: "task"
  });
  await writeDb(db);
  return ok({ task: normalizeTask(task) });
}
