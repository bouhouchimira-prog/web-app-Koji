import { addHistory } from "./db";
import { fixObjectText, fixText } from "./text";
import { publicWorker } from "./worker-auth";

function text(value) {
  return fixText(value || "");
}

function getClientPortalUserId(db, projectId) {
  if (!projectId) return null;
  const quote = (db.quotes || []).find((q) => q.projectId === projectId);
  return quote?.clientPortalUserId || null;
}

function notifyClient(db, clientUserId, task, { type, title, message }) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  const quote = (db.quotes || []).find((q) => q.projectId === task.projectId);
  db.notifications.unshift({
    id: `cn-client-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    userId: clientUserId,
    accountType: "particulier",
    type,
    title: text(title),
    message: text(message),
    taskId: task.id || "",
    taskLabel: text(task.label || ""),
    projectId: task.projectId || "",
    quoteId: quote?.id || task.quoteId || "",
    read: false,
    createdAt: new Date().toISOString()
  });
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
    audience: "worker",
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
    actionUrl: payload.actionUrl || "",
    actionLabel: payload.actionLabel || "",
    meta: payload.meta || {},
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
    const isFirstStart = !task.startedAt;
    if (!running) {
      task.timeEntries.push({ id: `te-${Date.now()}`, workerId, startedAt: now, status: "running" });
    }
    task.status = "En cours";
    task.startedAt = task.startedAt || now;
    if (isFirstStart) {
      const clientUserId = getClientPortalUserId(db, task.projectId);
      if (clientUserId) {
        notifyClient(db, clientUserId, task, {
          type: "task.started",
          title: "Votre chantier a démarré",
          message: `L'ouvrage "${task.label}" a été commencé par votre artisan.`,
        });
      }
    }
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
    task.status = "Terminee (a valider)";
    task.pendingValidation = true;
    task.completedByWorkerId = worker.id;
    task.completedByName = worker.name;
    task.completedByType = worker.type === "Sous-traitant" ? "Sous-traitant" : "Ouvrier";
    task.finishedAt = now;
    const clientUserId = getClientPortalUserId(db, task.projectId);
    if (clientUserId) {
      notifyClient(db, clientUserId, task, {
        type: "task.pending_validation",
        title: "Un ouvrage est terminé — votre validation est requise",
        message: `"${task.label}" a été réalisé. Ouvrez l'ouvrage pour confirmer que tout est conforme.`,
      });
    }
    addCompanyNotification(db, {
      userId: task.userId,
      workerId: worker.id,
      projectId: task.projectId || "",
      taskId: task.id,
      type: "task.completed",
      title: "Ouvrage termine - a valider",
      message: `${worker.name} (${task.completedByType.toLowerCase()}) a marque "${task.label}" comme terminee. Validez pour cloturer l'ouvrage.`,
      actionUrl: task.projectId ? `/chantiers?project=${task.projectId}` : "",
      actionLabel: "Voir le chantier",
      meta: { taskLabel: task.label, completedByName: worker.name, completedByType: task.completedByType, projectId: task.projectId || "" }
    });
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

// ── Attendance / pointage (weekly hours vs. contracted hours) ──────────────

export function isoWeekInfo(dateStr) {
  const date = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  const dayIndex = (date.getDay() + 6) % 7; // Monday=0 .. Sunday=6
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayIndex);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 1);
  while (firstThursday.getDay() !== 4) firstThursday.setDate(firstThursday.getDate() + 1);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));

  const iso = (d) => d.toISOString().slice(0, 10);
  return { key: `${isoYear}-W${String(week).padStart(2, "0")}`, start: iso(monday), end: iso(sunday) };
}

function formatFrShortDate(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${dateStr}T00:00:00`));
}

export function attendanceEntriesForWeek(entries, workerId, weekKey) {
  return (entries || []).filter((entry) => entry.workerId === workerId && isoWeekInfo(entry.date).key === weekKey);
}

export function sumAttendanceMinutes(entries) {
  return (entries || []).reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
}

export function weeklyAttendanceSummary(db, worker, referenceDate) {
  const { key, start, end } = isoWeekInfo(referenceDate || new Date().toISOString().slice(0, 10));
  const entries = attendanceEntriesForWeek(db.attendanceEntries || [], worker.id, key)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const workedMinutes = sumAttendanceMinutes(entries);
  const contractMinutes = Math.round(Number(worker.weeklyContractHours || 35) * 60);
  return {
    weekKey: key,
    start,
    end,
    entries: entries.map((entry) => fixObjectText(entry)),
    workedMinutes,
    workedLabel: formatMinutes(workedMinutes),
    contractMinutes,
    contractLabel: formatMinutes(contractMinutes),
    diffMinutes: workedMinutes - contractMinutes,
  };
}

// Fires (once per worker per ISO week, deduped via worker.attendanceNotifiedWeeks)
// a company notification when a fully-elapsed week's worked hours differ from
// the worker's contracted weekly hours by more than a small tolerance. Only
// evaluates past weeks — the current, still-running week is never flagged.
export function checkWeeklyAttendanceAlert(db, worker, entryDate) {
  const { key, start, end } = isoWeekInfo(entryDate);
  const currentWeekKey = isoWeekInfo(new Date().toISOString().slice(0, 10)).key;
  if (key >= currentWeekKey) return null;

  if (!Array.isArray(worker.attendanceNotifiedWeeks)) worker.attendanceNotifiedWeeks = [];
  if (worker.attendanceNotifiedWeeks.includes(key)) return null;

  const entries = attendanceEntriesForWeek(db.attendanceEntries || [], worker.id, key);
  const workedMinutes = sumAttendanceMinutes(entries);
  const contractMinutes = Math.round(Number(worker.weeklyContractHours || 35) * 60);
  const diffMinutes = workedMinutes - contractMinutes;
  if (Math.abs(diffMinutes) < 15) return null;

  worker.attendanceNotifiedWeeks.push(key);
  const over = diffMinutes > 0;
  const period = `la semaine du ${formatFrShortDate(start)} au ${formatFrShortDate(end)}`;
  const message = over
    ? `${worker.name} a dépassé ses heures contractuelles ${period} (${formatMinutes(workedMinutes)} au lieu de ${formatMinutes(contractMinutes)}).`
    : `${worker.name} a fait moins d'heures que prévu ${period} (${formatMinutes(workedMinutes)} au lieu de ${formatMinutes(contractMinutes)}).`;

  addCompanyNotification(db, {
    userId: worker.userId,
    workerId: worker.id,
    type: over ? "company.attendance_over" : "company.attendance_under",
    title: over ? "Heures dépassées" : "Heures insuffisantes",
    message,
    actionUrl: "/equipe",
    actionLabel: "Voir le planning",
    meta: { weekKey: key, workedMinutes, contractMinutes, diffMinutes },
  });
  addHistory(db, {
    userId: worker.userId,
    type: "worker.attendance_alert",
    label: message,
    entityId: worker.id,
    entityType: "worker",
    meta: { weekKey: key, diffMinutes },
  });

  return { weekKey: key, workedMinutes, contractMinutes, diffMinutes, over };
}

function toMinutesOfDay(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

// Whole-day clock in/out, independent of any task — this is what payroll
// hours are computed from, distinct from the per-task timers above.
export function applyWorkerClockAction(db, { worker, action }) {
  if (!Array.isArray(db.attendanceEntries)) db.attendanceEntries = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const openEntry = db.attendanceEntries.find((entry) => entry.workerId === worker.id && entry.date === todayStr && !entry.endTime);

  if (action === "clockIn") {
    if (openEntry) return { entry: openEntry, alreadyOpen: true };
    const entry = {
      id: `att-${Date.now()}`,
      userId: worker.userId || "",
      workerId: worker.id,
      workerName: text(worker.name),
      projectId: "",
      date: todayStr,
      startTime: nowTime,
      endTime: "",
      durationMinutes: 0,
      source: "worker",
      note: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    db.attendanceEntries.unshift(entry);
    addHistory(db, {
      userId: worker.userId,
      type: "attendance.clock_in",
      label: `${worker.name} a pointé le début de sa journée`,
      entityId: entry.id,
      entityType: "attendance",
      meta: { workerId: worker.id },
    });
    return { entry, alreadyOpen: false };
  }

  if (action === "clockOut") {
    if (!openEntry) return { entry: null, notOpen: true };
    openEntry.endTime = nowTime;
    openEntry.durationMinutes = Math.max(0, toMinutesOfDay(nowTime) - toMinutesOfDay(openEntry.startTime));
    openEntry.updatedAt = now.toISOString();
    addHistory(db, {
      userId: worker.userId,
      type: "attendance.clock_out",
      label: `${worker.name} a pointé la fin de sa journée`,
      entityId: openEntry.id,
      entityType: "attendance",
      meta: { workerId: worker.id, durationMinutes: openEntry.durationMinutes },
    });
    const alert = checkWeeklyAttendanceAlert(db, worker, openEntry.date);
    return { entry: openEntry, alert };
  }

  return null;
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const openEntry = (db.attendanceEntries || []).find((entry) => entry.workerId === safeWorker.id && entry.date === todayStr && !entry.endTime) || null;
  const attendanceWeek = weeklyAttendanceSummary(db, worker, todayStr);

  return {
    worker: safeWorker,
    activeProjects,
    archivedProjects,
    tasks,
    documents,
    claims,
    delays,
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    history,
    attendanceToday: openEntry ? fixObjectText(openEntry) : null,
    attendanceWeek,
  };
}

