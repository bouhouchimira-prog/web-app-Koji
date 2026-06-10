import { promises as fs } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "koji-db.json");
const seedPath = path.join(dataDir, "seed.json");

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    const seed = await fs.readFile(seedPath, "utf8");
    await fs.writeFile(dbPath, seed, "utf8");
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
  return db;
}

export async function writeDb(data) {
  await fs.mkdir(dataDir, { recursive: true });
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

export function scopedItems(items, userId) {
  if (!userId) return items;
  return items.filter((item) => !item.userId || item.userId === userId);
}

export function findScopedIndex(items, id, userId = "") {
  return items.findIndex((item) => item.id === id && (!userId || !item.userId || item.userId === userId));
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
