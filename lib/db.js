import { promises as fs } from "node:fs";
import path from "node:path";
import { hasSupabase, getSupabase } from "./supabase.js";

// Storage backends, in order of preference:
// 1. Supabase (same project as koji-admin / koji-main) \u2014 table `koji_web_state`,
//    created by running supabase_web_setup.sql once in the Supabase SQL editor.
// 2. Postgres (Neon) \u2014 Vercel's Neon integration injects DATABASE_URL/POSTGRES_URL.
// 3. Local JSON file \u2014 fine for local dev, but NOT persistent across requests on
//    Vercel's serverless filesystem (/tmp is per-instance and gets wiped/duplicated).
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const usePostgres = Boolean(databaseUrl);
const useSupabase = hasSupabase;

const isServerless = Boolean(process.env.VERCEL);
const staticDir = path.join(process.cwd(), "data");
const writableDir = isServerless ? "/tmp" : staticDir;
const dbPath = path.join(writableDir, "koji-db.json");
const seedPath = path.join(staticDir, "seed.json");

function normalizeDb(db) {
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
  if (!Array.isArray(db.urgentAlerts)) db.urgentAlerts = [];
  if (!Array.isArray(db.clients)) db.clients = [];
  return db;
}

async function loadSeed() {
  return JSON.parse(await fs.readFile(seedPath, "utf8"));
}

// \u2500\u2500 Supabase backend (shared project with koji-admin / koji-main) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

let supabaseStateTableMissing = false;

function noteMissingStateTable(error) {
  if (!supabaseStateTableMissing) {
    supabaseStateTableMissing = true;
    console.warn(
      `koji_web_state table unavailable in Supabase (${error.message}); using the local JSON file for non-shared data. ` +
        "Run supabase_web_setup.sql in the Supabase SQL editor to persist this data in Supabase too."
    );
  }
}

async function readDbFromSupabase() {
  if (supabaseStateTableMissing) return readDbFromFile();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("koji_web_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    noteMissingStateTable(error);
    return readDbFromFile();
  }
  if (!data) {
    // First run against a fresh table: promote the current local data (which
    // itself falls back to seed.json) so nothing already created is lost.
    const seed = normalizeDb(await readDbFromFile());
    const { error: insertError } = await supabase
      .from("koji_web_state")
      .insert({ id: 1, data: seed });
    if (insertError) {
      noteMissingStateTable(insertError);
      return seed;
    }
    return seed;
  }
  return normalizeDb(data.data);
}

async function writeDbToSupabase(data) {
  if (supabaseStateTableMissing) return writeDbToFile(data);
  const supabase = getSupabase();
  const { error } = await supabase
    .from("koji_web_state")
    .upsert({ id: 1, data, updated_at: new Date().toISOString() });
  if (error) {
    noteMissingStateTable(error);
    return writeDbToFile(data);
  }
  return data;
}

// \u2500\u2500 Postgres backend (persistent across requests/deployments) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

let sqlClient = null;
async function getSql() {
  if (!sqlClient) {
    const { sql } = await import("@vercel/postgres");
    sqlClient = sql;
  }
  return sqlClient;
}

async function ensureTable() {
  const sql = await getSql();
  await sql`CREATE TABLE IF NOT EXISTS koji_state (id INT PRIMARY KEY, data JSONB NOT NULL)`;
}

async function readDbFromPostgres() {
  const sql = await getSql();
  await ensureTable();
  const result = await sql`SELECT data FROM koji_state WHERE id = 1`;
  if (result.rows.length === 0) {
    const seed = normalizeDb(await loadSeed());
    await sql`INSERT INTO koji_state (id, data) VALUES (1, ${JSON.stringify(seed)}::jsonb)`;
    return seed;
  }
  return normalizeDb(result.rows[0].data);
}

async function writeDbToPostgres(data) {
  const sql = await getSql();
  await ensureTable();
  await sql`
    INSERT INTO koji_state (id, data) VALUES (1, ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
  `;
  return data;
}

// \u2500\u2500 Local JSON file backend (dev fallback only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function ensureFileDb() {
  if (isServerless) {
    try {
      await fs.access(dbPath);
    } catch {
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

async function readDbFromFile() {
  await ensureFileDb();
  const raw = await fs.readFile(dbPath, "utf8");
  return normalizeDb(JSON.parse(raw.replace(/^\uFEFF/, "")));
}

async function writeDbToFile(data) {
  await fs.mkdir(writableDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

// \u2500\u2500 Public API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export async function readDb() {
  if (useSupabase) return readDbFromSupabase();
  return usePostgres ? readDbFromPostgres() : readDbFromFile();
}

export async function writeDb(data) {
  if (useSupabase) return writeDbToSupabase(data);
  return usePostgres ? writeDbToPostgres(data) : writeDbToFile(data);
}

export async function resetDb() {
  const seed = normalizeDb(await loadSeed());
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

