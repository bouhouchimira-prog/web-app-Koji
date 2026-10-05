import { promises as fs } from "node:fs";
import path from "node:path";
import { hasSupabaseAdmin, getSupabaseAdmin } from "./supabase.js";

// Stockage dedie aux comptes particuliers (4 oct, demande d'Amira) — sorti
// du gros bloc partage koji_web_state (1,27 Mo mesures) pour que les
// routes qui ne touchent QUE les comptes (connexion Google, activation,
// profil) n'aient plus a transporter tout le reste de l'application a
// chaque appel. Meme principe de stockage que lib/db.js (Supabase en
// priorite, repli fichier local), delibermement isole dans son propre
// module pour ne RIEN changer au comportement des autres endroits qui
// lisent db.users via readDb()/writeDb() — lib/db.js fusionne/separe ce
// module en coulisses, voir son readDb()/writeDb() exportes.
const useSupabase = hasSupabaseAdmin;
const isServerless = Boolean(process.env.VERCEL);
const staticDir = path.join(process.cwd(), "data");
const writableDir = isServerless ? "/tmp" : staticDir;
const usersFilePath = path.join(writableDir, "particulier-users.json");

let supabaseTableMissing = false;
function noteMissingTable(error) {
  if (!supabaseTableMissing) {
    supabaseTableMissing = true;
    console.warn(
      `particulier_users_state table unavailable in Supabase (${error.message}); using the local JSON file. ` +
        "Run supabase_web_setup.sql (section particulier_users_state) in the Supabase SQL editor."
    );
  }
}

async function readUsersFromFile() {
  try {
    const raw = await fs.readFile(usersFilePath, "utf8");
    const parsed = JSON.parse(raw.replace(/^﻿/, ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsersToFile(users) {
  await fs.mkdir(writableDir, { recursive: true });
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf8");
  return users;
}

// Version "sure" (avec indicateur de disponibilite) — utilisee par
// lib/db.js pour decider si users peut sans risque etre retire du gros
// bloc partage. Tant que particulier_users_state n'existe pas encore (table
// pas encore creee, ou migration pas encore jouee), available est false : le
// gros bloc garde users comme avant, aucune perte de donnees possible.
async function readUsersSafe() {
  if (!useSupabase) return { users: await readUsersFromFile(), available: false };
  if (supabaseTableMissing) return { users: await readUsersFromFile(), available: false };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("particulier_users_state")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    noteMissingTable(error);
    return { users: await readUsersFromFile(), available: false };
  }
  return { users: data && Array.isArray(data.data) ? data.data : [], available: true };
}

async function writeUsersSafe(users) {
  const list = Array.isArray(users) ? users : [];
  if (!useSupabase) return { available: false, users: await writeUsersToFile(list) };
  if (supabaseTableMissing) return { available: false, users: await writeUsersToFile(list) };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("particulier_users_state")
    .upsert({ id: 1, data: list, updated_at: new Date().toISOString() });
  if (error) {
    noteMissingTable(error);
    return { available: false, users: await writeUsersToFile(list) };
  }
  return { available: true, users: list };
}

// API "simple" utilisee directement par les routes vraiment isolees
// (connexion Google particulier, activation, profil) pour sauter
// completement le gros bloc partage.
export async function readUsers() {
  const { users } = await readUsersSafe();
  return users;
}

export async function writeUsers(users) {
  const result = await writeUsersSafe(users);
  return result.users;
}

// API "sure" reservee a lib/db.js (readDb/writeDb) — voir readUsersSafe/
// writeUsersSafe ci-dessus, jamais utilisee en dehors de la fusion/
// separation transparente avec le gros bloc.
export { readUsersSafe, writeUsersSafe };
