import { badRequest, ok } from "../../../../lib/http";
import { publicUser, readDb, writeDb } from "../../../../lib/db";

function uidLocal(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function findClientUser(db, request) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get("email"));
  const userId = url.searchParams.get("userId") || "";
  return db.users.find((user) => user.id === userId) || db.users.find((user) => normalizeEmail(user.email) === email) || null;
}

export async function GET(request) {
  const db = await readDb();
  const user = findClientUser(db, request);
  if (!user) return badRequest("Profil client introuvable.", 404);
  return ok({ user: publicUser(user) });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const userId = body.userId || "";
  if (!email && !userId) return badRequest("Email ou identifiant utilisateur requis.");

  const db = await readDb();
  let user = db.users.find((entry) => entry.id === userId) || db.users.find((entry) => normalizeEmail(entry.email) === email);

  if (!user) {
    user = {
      id: uidLocal("client"),
      email,
      passwordHash: null,
      accountType: "particulier",
      isActive: true,
      createdAt: new Date().toISOString(),
      name: body.name || email,
      business: {},
      personal: {},
      professions: [],
    };
    db.users.push(user);
  }

  const personal = body.personal || {};
  user.accountType = "particulier";
  user.personal = { ...user.personal, ...personal };
  const fullName = [user.personal.firstName, user.personal.lastName].filter(Boolean).join(" ").trim();
  if (fullName) user.name = fullName;
  if (email) user.email = email;

  await writeDb(db);
  return ok({ user: publicUser(user) });
}