import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ suppliers: scopedItems(db.suppliers, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const now = new Date().toISOString();
  const supplier = {
    id: `fs-${Date.now()}`,
    userId,
    name: body.name || "Nouveau fournisseur",
    email: body.email || "",
    phone: body.phone || "",
    address: body.address || "",
    website: body.website || "",
    notes: body.notes || "",
    createdAt: now,
    updatedAt: now
  };

  db.suppliers.unshift(supplier);
  addHistory(db, {
    userId,
    type: "supplier.created",
    label: `Fournisseur ajoute: ${supplier.name}`,
    entityId: supplier.id,
    entityType: "supplier"
  });
  await writeDb(db);
  return ok({ supplier }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.suppliers, body.id, userId);
  if (index === -1) return ok({ error: "Fournisseur introuvable." }, 404);

  const supplier = db.suppliers[index];
  if (body.action === "delete") {
    db.suppliers.splice(index, 1);
    addHistory(db, {
      userId: supplier.userId || userId,
      type: "supplier.deleted",
      label: `Fournisseur supprime: ${supplier.name}`,
      entityId: supplier.id,
      entityType: "supplier"
    });
    await writeDb(db);
    return ok({ supplier: { ...supplier, deleted: true } });
  }

  ["name", "email", "phone", "address", "website", "notes"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) supplier[key] = body[key];
  });
  supplier.updatedAt = new Date().toISOString();
  db.suppliers[index] = supplier;
  addHistory(db, {
    userId: supplier.userId || userId,
    type: "supplier.updated",
    label: `Fournisseur mis a jour: ${supplier.name}`,
    entityId: supplier.id,
    entityType: "supplier"
  });
  await writeDb(db);
  return ok({ supplier });
}
