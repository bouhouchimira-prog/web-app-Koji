import { badRequest, ok } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  return ok({ categories: scopedItems(db.categories, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const now = new Date().toISOString();
  const category = {
    id: `cat-${Date.now()}`,
    userId,
    name: (body.name || "Catégorie").trim(),
    subcategories: Array.isArray(body.subcategories) ? body.subcategories.filter(Boolean) : [],
    createdAt: now,
    updatedAt: now
  };
  db.categories.unshift(category);
  await writeDb(db);
  return ok({ category }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.categories, body.id, userId);
  if (index === -1) return ok({ error: "Catégorie introuvable." }, 404);

  const category = db.categories[index];

  if (body.action === "delete") {
    db.categories.splice(index, 1);
    await writeDb(db);
    return ok({ category: { ...category, deleted: true } });
  }

  if (body.name !== undefined) category.name = String(body.name).trim();
  if (Array.isArray(body.subcategories)) category.subcategories = body.subcategories.filter(Boolean);
  category.updatedAt = new Date().toISOString();
  db.categories[index] = category;
  await writeDb(db);
  return ok({ category });
}
