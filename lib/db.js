import { promises as fs } from "node:fs";
import path from "node:path";

// On Vercel (serverless), the project directory is read-only. Use /tmp for writes.
const isServerless = Boolean(process.env.VERCEL);
const staticDir = path.join(process.cwd(), "data");
const writableDir = isServerless ? "/tmp" : staticDir;
const dbPath = path.join(writableDir, "koji-db.json");
const seedPath = path.join(staticDir, "seed.json");

async function ensureDb() {
  if (isServerless) {
    try {
      await fs.access(dbPath);
    } catch {
      // Cold start: copy existing DB (with all users) from static dir to /tmp
      try {
        const existing = await fs.readFile(path.join(staticDir, "koji-db.json"), "utf8");
        await fs.writeFile(dbPath, existing, "utf8");
      } catch {
        const seed = await fs.readFile(seedPath, "utf8");
        await fs.writeFile(dbPath, seed, "utf8");
      }
    }
  } else {
    await fs.mkdir(writableDir, { recursive: true });
    try {
      await fs.access(dbPath);
    } catch {
      const seed = await fs.readFile(seedPath, "utf8");
      await fs.writeFile(dbPath, seed, "utf8");
    }
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  const db = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.projects)) db.projects = [];
  if (!Array.isArray(db.quotes)) db.quotes = [];
  if (!Array.isArray(db.invoices)) db.invoices = [];
  if (!Array.isArray(db.calendarEvents)) db.calendarEvents = [];
  if (!Array.isArray(db.tasks)) db.tasks = [];
  if (!Array.isArray(db.supplies)) db.supplies = [];
  if (!Array.isArray(db.suppliers)) db.suppliers = [];
  if (!Array.isArray(db.workers)) db.workers = [];
  if (!Array.isArray(db.signatureSettings)) db.signatureSettings = [];
  if (!Array.isArray(db.ouvrages)) db.ouvrages = [];
  if (!Array.isArray(db.deletedOuvrages)) db.deletedOuvrages = [];
  if (!Array.isArray(db.mailOutbox)) db.mailOutbox = [];
  if (!Array.isArray(db.smsOutbox)) db.smsOutbox = [];
  if (!Array.isArray(db.history)) db.history = [];
  if (!Array.isArray(db.projectDocuments)) db.projectDocuments = [];
  if (!Array.isArray(db.projectArchives)) db.projectArchives = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.expenses)) db.expenses = [];
  if (!Array.isArray(db.categories)) db.categories = [];
  if (!Array.isArray(db.workerClaims)) db.workerClaims = [];
  if (!Array.isArray(db.workerDelayReports)) db.workerDelayReports = [];
  if (!Array.isArray(db.workerTimeEvents)) db.workerTimeEvents = [];
  if (!Array.isArray(db.marketplaceInterests)) db.marketplaceInterests = [];
  return db;
}

export async function writeDb(data) {
  await fs.mkdir(writableDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export async function resetDb() {
  const seed = JSON.parse(await fs.readFile(seedPath, "utf8"));
  await writeDb(seed);
  return seed;
}

export function publicUser(user) {
  if (!user) return null;
  const {
    password,
    passwordHash,
    passwordSalt,
    activationToken,
    activationExpiresAt,
    resetPasswordToken,
    resetPasswordExpiresAt,
    ...safe
  } = user;
  return safe;
}

export function getUserIdFromRequest(request) {
  return new URL(request.url).searchParams.get("userId") || "";
}

// Returns "" (all items) when the requesting user is admin, otherwise returns the userId for strict scoping.
export function getUserScope(request, db) {
  const userId = new URL(request.url).searchParams.get("userId") || "";
  if (!userId) return "";
  const user = db.users.find((u) => u.id === userId);
  return user?.isAdmin ? "" : userId;
}

// Same as getUserScope but for POST/PATCH handlers where userId comes from the body.
export function resolveUserId(rawUserId, db) {
  if (!rawUserId) return "";
  const user = db.users.find((u) => u.id === rawUserId);
  return user?.isAdmin ? "" : rawUserId;
}

// Strict: items without userId are only returned when userId is "" (admin/unauthenticated).
export function scopedItems(items, userId) {
  if (!userId) return items;
  return items.filter((item) => item.userId === userId);
}

export function findScopedIndex(items, id, userId = "") {
  if (!userId) return items.findIndex((item) => item.id === id);
  return items.findIndex((item) => item.id === id && item.userId === userId);
}

export function makeToken(prefix = "tok") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addHistory(db, { userId = "", type, label, entityId = "", entityType = "", meta = {} }) {
  db.history.unshift({
    id: `h-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId,
    type,
    label,
    entityId,
    entityType,
    meta,
    createdAt: new Date().toISOString()
  });
}

