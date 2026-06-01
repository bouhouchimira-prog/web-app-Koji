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
  const db = JSON.parse(await fs.readFile(dbPath, "utf8"));
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.projects)) db.projects = [];
  if (!Array.isArray(db.quotes)) db.quotes = [];
  if (!Array.isArray(db.tasks)) db.tasks = [];
  if (!Array.isArray(db.supplies)) db.supplies = [];
  if (!Array.isArray(db.workers)) db.workers = [];
  if (!Array.isArray(db.mailOutbox)) db.mailOutbox = [];
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
