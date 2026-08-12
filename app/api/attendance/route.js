import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { fixObjectText, fixText } from "../../../lib/text";
import { checkWeeklyAttendanceAlert, weeklyAttendanceSummary } from "../../../lib/worker-portal";

const ENTRY_TYPES = new Set(["heures", "jour", "forfait", "ouvrage", "passage", "deplacement"]);

function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationFromTimes(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start);
}

function normalizeEntry(entry) {
  return fixObjectText(entry);
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") || "";
  const week = url.searchParams.get("week") || ""; // any date within the target week

  let entries = scopedItems(db.attendanceEntries, userId);
  if (workerId) entries = entries.filter((entry) => entry.workerId === workerId);
  entries = entries.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

  let summary = null;
  if (workerId) {
    const worker = (db.workers || []).find((item) => item.id === workerId);
    if (worker) summary = weeklyAttendanceSummary(db, worker, week || undefined);
  }

  return ok({ entries: entries.map(normalizeEntry), summary });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const now = new Date().toISOString();

  const worker = (db.workers || []).find((item) => item.id === body.workerId);
  if (!worker) return badRequest("Ouvrier introuvable.", 404);
  if (!body.date) return badRequest("Date obligatoire.", 400);

  const type = ENTRY_TYPES.has(body.type) ? body.type : "heures";
  let durationMinutes = 0;
  let amount = 0;

  if (type === "heures") {
    if (!body.startTime || !body.endTime) return badRequest("Heure de debut et de fin obligatoires.", 400);
    durationMinutes = durationFromTimes(body.startTime, body.endTime);
    if (durationMinutes <= 0) return badRequest("L'heure de fin doit etre apres l'heure de debut.", 400);
    amount = Math.round((durationMinutes / 60) * Number(worker.hourlyRate || 0) * 100) / 100;
  } else {
    amount = Number(body.amount || 0);
    if (amount <= 0) return badRequest("Le montant doit etre superieur a zero.", 400);
    if (type === "jour") durationMinutes = Math.round((Number(worker.weeklyContractHours || 35) * 60) / 5);
  }

  const entry = {
    id: `att-${Date.now()}`,
    userId,
    workerId: worker.id,
    workerName: fixText(worker.name || ""),
    projectId: body.projectId || "",
    type,
    date: body.date,
    startTime: type === "heures" ? body.startTime : "",
    endTime: type === "heures" ? body.endTime : "",
    durationMinutes,
    amount,
    label: fixText(body.label || ""),
    source: "company",
    note: fixText(body.note || ""),
    createdAt: now,
    updatedAt: now,
  };

  db.attendanceEntries.unshift(entry);
  addHistory(db, {
    userId,
    type: "attendance.created",
    label: `Pointage ajoute: ${entry.workerName} (${entry.date})`,
    entityId: entry.id,
    entityType: "attendance",
    meta: { workerId: worker.id, date: entry.date, durationMinutes },
  });

  const alert = checkWeeklyAttendanceAlert(db, worker, entry.date);
  await writeDb(db);
  return ok({ entry: normalizeEntry(entry), alert }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.attendanceEntries, body.id, userId);
  if (index === -1) return badRequest("Pointage introuvable.", 404);

  const entry = db.attendanceEntries[index];
  if (body.action === "delete") {
    db.attendanceEntries.splice(index, 1);
    addHistory(db, {
      userId: entry.userId || userId,
      type: "attendance.deleted",
      label: `Pointage supprime: ${entry.workerName} (${entry.date})`,
      entityId: entry.id,
      entityType: "attendance",
    });
    await writeDb(db);
    return ok({ entry: { ...normalizeEntry(entry), deleted: true } });
  }

  for (const key of ["date", "startTime", "endTime", "note", "projectId", "type", "label"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) entry[key] = fixObjectText(body[key]);
  }
  if (Object.prototype.hasOwnProperty.call(body, "amount")) entry.amount = Number(body.amount || 0);
  if (Object.prototype.hasOwnProperty.call(body, "startTime") || Object.prototype.hasOwnProperty.call(body, "endTime")) {
    entry.durationMinutes = durationFromTimes(entry.startTime, entry.endTime);
  }
  entry.updatedAt = new Date().toISOString();
  db.attendanceEntries[index] = entry;

  addHistory(db, {
    userId: entry.userId || userId,
    type: "attendance.updated",
    label: `Pointage mis a jour: ${entry.workerName} (${entry.date})`,
    entityId: entry.id,
    entityType: "attendance",
  });

  const worker = (db.workers || []).find((item) => item.id === entry.workerId);
  const alert = worker ? checkWeeklyAttendanceAlert(db, worker, entry.date) : null;
  await writeDb(db);
  return ok({ entry: normalizeEntry(entry), alert });
}
