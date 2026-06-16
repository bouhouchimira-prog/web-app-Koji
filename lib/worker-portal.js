import { addHistory } from "./db";
import { fixObjectText, fixText } from "./text";
import { publicWorker } from "./worker-auth";

function text(value) {
  return fixText(value || "");
}

function lower(value) {
  return text(value).toLowerCase();
}

export function formatMinutes(minutes = 0) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function isFinishedStatus(status) {
  return ["termine", "terminee", "terminé", "terminée", "archive", "archivé", "signee", "signée"].includes(lower(status));
}

export function taskBelongsToWorker(task = {}, worker = {}) {
  const workerIds = Array.isArray(task.workerIds) ? task.workerIds.map(String) : [];
  if (workerIds.includes(String(worker.id))) return true;

  const assignedTo = lower(task.assignedTo);
  const workerName = lower(worker.name);
  const loginId = lower(worker.loginId || worker.identifier);
  const email = lower(worker.email);
  return Boolean(
    (workerName && assignedTo.includes(workerName)) ||
    (loginId && assignedTo.includes(loginId)) ||
    (email && assignedTo.includes(email))
  );
}

export function getTaskConsumedMinutes(task = {}) {
  const entries = Array.isArray(task.timeEntries) ? task.timeEntries : [];
  if (!entries.length) return Math.max(0, Math.round(Number(task.consumedMinutes) || 0));

  const now = Date.now();
  return entries.reduce((sum, entry) => {
    if (Number(entry.durationMinutes)) return sum + Number(entry.durationMinutes);
    if (entry.startedAt && entry.status === "running") {
      return sum + Math.max(0, Math.round((now - new Date(entry.startedAt).getTime()) / 60000));
    }
    return sum;
  }, 0);
}

export function projectFromTask(db, task = {}) {
  const projects = Array.isArray(db.projects) ? db.projects : [];
  return projects.find((project) => project.id === task.projectId || project.title === task.project || project.reference === task.project) || null;
}

function plannedMinutes(task = {}) {
  return Math.max(0, Math.round(Number(task.durationHours || task.estimatedHours || task.hours || 0) * 60));
}

function progressFromTasks(tasks = []) {
  if (!tasks.length) return 0;
  const done = tasks.filter((task) => task.done || isFinishedStatus(task.status)).length;
  return Math.round((done / tasks.length) * 100);
}

function groupByProject(db, tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    const project = projectFromTask(db, task) || {
      id: task.projectId || `project-${task.project || "sans-projet"}`,
      title: task.project || "Chantier sans nom",
      address: task.location || "Adresse à compléter",
      status: task.status || "À faire",
    };
    const key = project.id || project.title;
    if (!map.has(key)) map.set(key, { ...fixObjectText(project), tasks: [] });
    map.get(key).tasks.push(fixObjectText(task));
  });
  return [...map.values()].map((project) => ({
    ...project,
    progress: progressFromTasks(project.tasks),
    startDate: project.startDate || project.dateStart || project.createdAt || "",
    plannedEndDate: project.plannedEndDate || project.endDate || project.dueDate || "",
    companyName: project.companyName || project.company || project.businessName || "Entreprise Koji",
    status: project.status || "En cours",
  }));
}

export function addWorkerNotification(db, payload = {}) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  const notification = {
    id: `wn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: payload.userId || "worker",
    workerId: payload.workerId,
    projectId: payload.projectId || "",
    taskId: payload.taskId || "",
    type: payload.type || "worker",
    title: text(payload.title || "Notification"),
    message: text(payload.message || ""),
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(notification);
  return notification;
}

export function addCompanyNotification(db, payload = {}) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  const notification = {
    id: `cn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: payload.userId,
    workerId: payload.workerId || "",
    projectId: payload.projectId || "",
    taskId: payload.taskId || "",
    type: payload.type || "company.worker",
    title: text(payload.title || "Alerte ouvrier"),
    message: text(payload.message || ""),
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(notification);
  return notification;
}

function activeRunningEntry(task, workerId) {
  return (task.timeEntries || []).findLast?.((entry) => entry.workerId === workerId && entry.status === "running") ||
    [...(task.timeEntries || [])].reverse().find((entry) => entry.workerId === workerId && entry.status === "running");
}

function closeEntry(entry, now) {
  if (!entry || entry.durationMinutes) return entry;
  entry.endedAt = now;
  entry.durationMinutes = Math.max(0, Math.round((new Date(now).getTime() - new Date(entry.startedAt).getTime()) / 60000));
  entry.status = "closed";
  return entry;
}

export function applyTaskTimeAction(db, { task, worker, action }) {
  if (!Array.isArray(task.timeEntries)) task.timeEntries = [];
  if (!Array.isArray(db.workerTimeEvents)) db.workerTimeEvents = [];
  const now = new Date().toISOString();
  const workerId = worker.id;
  const running = activeRunningEntry(task, workerId);

  if (action === "start") {
    if (!running) {
      task.timeEntries.push({ id: `te-${Date.now()}`, workerId, startedAt: now, status: "running" });
    }
    task.status = "En cours";
    task.startedAt = task.startedAt || now;
  }

  if (action === "pause") {
    closeEntry(running, now);
    task.status = "En pause";
  }

  if (action === "resume") {
    if (!running) task.timeEntries.push({ id: `te-${Date.now()}`, workerId, startedAt: now, status: "running" });
    task.status = "En cours";
  }

  if (action === "finish") {
    closeEntry(running, now);
    task.status = "Terminee";
    task.done = true;
    task.finishedAt = now;
  }

  task.consumedMinutes = getTaskConsumedMinutes(task);
  task.consumedLabel = formatMinutes(task.consumedMinutes);
  task.updatedAt = now;

  const event = {
    id: `wte-${Date.now()}`,
    userId: task.userId,
    workerId,
    projectId: task.projectId || "",
    taskId: task.id,
    action,
    consumedMinutes: task.consumedMinutes,
    createdAt: now,
  };
  db.workerTimeEvents.unshift(event);
  addHistory(db, { userId: task.userId, type: "worker.time", label: `Pointage ouvrier: ${action}`, entityId: task.id, entityType: "task", meta: { workerId, projectId: task.projectId || "" } });

  const estimated = plannedMinutes(task);
  const overrunMinutes = estimated > 0 ? task.consumedMinutes - estimated : 0;
  if (overrunMinutes > 0 && !task.workerOverrunNotifiedAt) {
    const message = `Le temps prevu pour cet ouvrage est depasse de ${formatMinutes(overrunMinutes)}.`;
    task.workerOverrunNotifiedAt = now;
    addWorkerNotification(db, {
      userId: task.userId,
      workerId,
      projectId: task.projectId,
      taskId: task.id,
      type: "worker.time_overrun",
      title: "Temps depasse",
      message,
    });
    addCompanyNotification(db, {
      userId: task.userId,
      workerId,
      projectId: task.projectId,
      taskId: task.id,
      type: "company.time_overrun",
      title: "Depassement de temps",
      message: `${worker.name}: ${message}`,
    });
    addHistory(db, { userId: task.userId, type: "worker.time_overrun", label: message, entityId: task.id, entityType: "task", meta: { workerId, overrunMinutes } });
  }

  return { task, event };
}

export function buildWorkerPortal(db, worker) {
  const safeWorker = publicWorker(worker);
  const tasks = (Array.isArray(db.tasks) ? db.tasks : [])
    .filter((task) => taskBelongsToWorker(task, safeWorker))
    .map((task) => ({
      ...fixObjectText(task),
      consumedMinutes: getTaskConsumedMinutes(task),
      consumedLabel: formatMinutes(getTaskConsumedMinutes(task)),
      plannedMinutes: plannedMinutes(task),
      plannedLabel: formatMinutes(plannedMinutes(task)),
    }));

  const projects = groupByProject(db, tasks);
  const activeProjects = projects.filter((project) => !isFinishedStatus(project.status));
  const archivedProjects = projects.filter((project) => isFinishedStatus(project.status));
  const taskIds = new Set(tasks.map((task) => task.id));
  const projectIds = new Set(projects.map((project) => project.id));

  const documents = (db.projectDocuments || []).filter((doc) => doc.workerId === safeWorker.id || taskIds.has(doc.taskId));
  const claims = (db.workerClaims || []).filter((claim) => claim.workerId === safeWorker.id);
  const delays = (db.workerDelayReports || []).filter((delay) => delay.workerId === safeWorker.id);
  const notifications = (db.notifications || []).filter((notification) => notification.workerId === safeWorker.id);
  const history = (db.history || []).filter((entry) => {
    const meta = entry.meta || {};
    return meta.workerId === safeWorker.id || taskIds.has(entry.entityId) || projectIds.has(meta.projectId);
  });

  return {
    worker: safeWorker,
    activeProjects,
    archivedProjects,
    tasks,
    documents,
    claims,
    delays,
    notifications,
    history,
  };
}

