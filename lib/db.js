import { promises as fs } from "node:fs";
import path from "node:path";
import { hasSupabaseAdmin, getSupabaseAdmin } from "./supabase.js";
import { getVerifiedUserId } from "./server-auth.js";
import { readUsersSafe, writeUsersSafe } from "./particulier-users.js";

// Storage backends, in order of preference:
// 1. Supabase (same project as koji-admin / koji-main) \u2014 table `koji_web_state`,
//    created by running supabase_web_setup.sql once in the Supabase SQL editor.
// 2. Postgres (Neon) \u2014 Vercel's Neon integration injects DATABASE_URL/POSTGRES_URL.
// 3. Local JSON file \u2014 fine for local dev, but NOT persistent across requests on
//    Vercel's serverless filesystem (/tmp is per-instance and gets wiped/duplicated).
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const usePostgres = Boolean(databaseUrl);
const useSupabase = hasSupabaseAdmin;

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
  if (!Array.isArray(db.avenants)) db.avenants = [];
  if (!Array.isArray(db.companySites)) db.companySites = [];
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
  if (!Array.isArray(db.attendanceEntries)) db.attendanceEntries = [];
  if (!Array.isArray(db.interventions)) db.interventions = [];
  if (!Array.isArray(db.contacts)) db.contacts = [];
  if (!Array.isArray(db.chantierContacts)) db.chantierContacts = [];
  if (!Array.isArray(db.technicalReports)) db.technicalReports = [];
  if (!Array.isArray(db.accountDeletionRequests)) db.accountDeletionRequests = [];
  if (!Array.isArray(db.chantierOffres)) db.chantierOffres = [];
  if (!Array.isArray(db.chantierOffreMessages)) db.chantierOffreMessages = [];
  if (!Array.isArray(db.chantierPositionnements)) db.chantierPositionnements = [];
  if (!Array.isArray(db.chantierPaiements)) db.chantierPaiements = [];
  if (!Array.isArray(db.estimationAccuracy)) db.estimationAccuracy = [];
  if (!Array.isArray(db.radarChatIncidents)) db.radarChatIncidents = [];
  if (!Array.isArray(db.iaDevisOutcomes)) db.iaDevisOutcomes = [];
  if (!Array.isArray(db.chantierVisites)) db.chantierVisites = [];
  if (!Array.isArray(db.kojiAssistantMessages)) db.kojiAssistantMessages = [];
  // Consignes permanentes donnees par un compte admin directement dans un
  // des 3 chats IA (17 oct, demande d'Amira) — voir lib/ai-assistant-
  // instructions.js. Un champ par assistant, jamais partage (role trop
  // different entre les 3 pour qu'une meme consigne ait du sens partout).
  if (!db.aiAssistantInstructions || typeof db.aiAssistantInstructions !== "object" || Array.isArray(db.aiAssistantInstructions)) {
    db.aiAssistantInstructions = { radar: "", devisChat: "", kojiAssistant: "" };
  }
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
  // Server-only service_role client — koji_web_state has no per-row owner
  // column to scope by (it's one shared JSON blob), so RLS can't provide
  // company-level isolation here the way it does for quotes/chantiers. Access
  // control instead lives entirely in the API routes above this (see
  // getVerifiedUserId / scopedItems), and RLS on this table is locked down to
  // deny the anon/authenticated roles entirely (see the Supabase dashboard).
  const supabase = getSupabaseAdmin();
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
  const supabase = getSupabaseAdmin();
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
  if (useSupabase) {
    // users vit desormais dans sa propre table (particulier-users.js, 4
    // oct) — recupere en parallele du gros bloc, puis fusionne pour que
    // tous les appelants existants continuent de voir db.users exactement
    // comme avant. Tant que la nouvelle table n'est pas encore disponible
    // (pas encore creee / migration pas encore jouee), on garde le users
    // deja present dans le gros bloc plutot que de l'ecraser par un
    // resultat vide — jamais de perte de donnees pendant la transition.
    const [db, usersResult] = await Promise.all([readDbFromSupabase(), readUsersSafe()]);
    if (usersResult.available) db.users = usersResult.users;
    return db;
  }
  return usePostgres ? readDbFromPostgres() : readDbFromFile();
}

export async function writeDb(data) {
  if (useSupabase) {
    // Meme garde-fou qu'en lecture : users n'est retire du gros bloc QUE
    // si l'ecriture vers la nouvelle table a reellement reussi — sinon il
    // reste dans le bloc principal comme avant (aucune perte possible).
    const { users, ...rest } = data;
    const usersResult = await writeUsersSafe(users);
    await writeDbToSupabase(usersResult.available ? rest : data);
    return data;
  }
  return usePostgres ? writeDbToPostgres(data) : writeDbToFile(data);
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

// Distinct sentinel for "verified admin, sees everything" — deliberately not
// "" or any other falsy value, so a request with NO valid session (also
// falsy) can never be confused with one. Before this existed, both cases
// collapsed to "", and scopedItems/findScopedIndex treated "" as "no scoping
// — return everything," which meant an entirely unauthenticated request (no
// token at all) got the same unrestricted access as a verified admin.
export const ADMIN_SCOPE = "__koji_admin_scope__";

// Both scoping helpers verify the request's Supabase access token against
// Supabase Auth itself (see getVerifiedUserId) rather than trusting a userId
// the browser sends — a client-supplied value used to let anyone read or
// write any other company's data (or, for the 3 admin accounts, everyone's
// data at once) just by passing that id.
function applyAdminBypass(verifiedUserId, db) {
  if (!verifiedUserId) return "";
  const user = db.users.find((u) => u.id === verifiedUserId);
  return user?.isAdmin ? ADMIN_SCOPE : verifiedUserId;
}

export async function getUserScope(request, db) {
  const verifiedUserId = await getVerifiedUserId(request);
  return applyAdminBypass(verifiedUserId, db);
}

// Same as getUserScope but for POST/PATCH handlers, where the token can also
// travel in the JSON body (see getAccessToken) — pass the already-parsed body.
export async function resolveUserId(request, body, db) {
  const verifiedUserId = await getVerifiedUserId(request, body);
  return applyAdminBypass(verifiedUserId, db);
}

// "" (or any other falsy userId — no valid session) now returns nothing, not
// everything. Only the ADMIN_SCOPE sentinel bypasses scoping entirely.
export function scopedItems(items, userId) {
  if (userId === ADMIN_SCOPE) return items;
  if (!userId) return [];
  return items.filter((item) => item.userId === userId);
}

export function findScopedIndex(items, id, userId = "") {
  if (userId === ADMIN_SCOPE) return items.findIndex((item) => item.id === id);
  if (!userId) return -1;
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

