import { ok } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ categories: scopedItems(db.categories, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
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
  const userId = resolveUserId(body.userId || "", db);
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
