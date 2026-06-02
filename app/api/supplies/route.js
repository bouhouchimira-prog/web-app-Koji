import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserIdFromRequest, readDb, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  return ok({ supplies: scopedItems(db.supplies, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const supplier = body.supplierId ? db.suppliers.find((item) => item.id === body.supplierId) : null;
  const purchasePriceHt = Number(body.purchasePriceHt ?? body.priceHt ?? 0);
  const salePriceHt = Number(body.salePriceHt ?? body.priceHt ?? purchasePriceHt);
  const supply = {
    id: `pr-${Date.now()}`,
    userId,
    name: body.name || "Fourniture",
    category: body.category || "general",
    unit: body.unit || "unite",
    purchasePriceHt,
    salePriceHt,
    priceHt: salePriceHt,
    stock: Number(body.stock ?? body.quantity ?? 0),
    quantity: Number(body.quantity ?? body.stock ?? 0),
    packaging: body.packaging || "",
    supplierId: body.supplierId || "",
    supplierName: body.supplierName || supplier?.name || "",
    barcode: body.barcode || "",
    imageUrl: body.imageUrl || "",
    sourceUrl: body.sourceUrl || "",
    createdAt: new Date().toISOString()
  };
  db.supplies.unshift(supply);
  addHistory(db, {
    userId,
    type: "supply.created",
    label: `Fourniture ajoutee: ${supply.name}`,
    entityId: supply.id,
    entityType: "supply"
  });
  await writeDb(db);
  return ok({ supply }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const index = findScopedIndex(db.supplies, body.id, userId);
  if (index === -1) return ok({ error: "Fourniture introuvable." }, 404);

  const supply = db.supplies[index];
  if (body.action === "delete") {
    db.supplies.splice(index, 1);
    addHistory(db, {
      userId: supply.userId || userId,
      type: "supply.deleted",
      label: `Fourniture supprimee: ${supply.name}`,
      entityId: supply.id,
      entityType: "supply"
    });
    await writeDb(db);
    return ok({ supply: { ...supply, deleted: true } });
  }
  const allowed = [
    "name",
    "category",
    "unit",
    "priceHt",
    "purchasePriceHt",
    "salePriceHt",
    "stock",
    "quantity",
    "packaging",
    "supplierId",
    "supplierName",
    "barcode",
    "imageUrl",
    "sourceUrl"
  ];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      supply[key] = ["priceHt", "purchasePriceHt", "salePriceHt", "stock", "quantity"].includes(key) ? Number(body[key] || 0) : body[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "supplierId") && body.supplierId) {
    const supplier = db.suppliers.find((item) => item.id === body.supplierId);
    if (supplier) supply.supplierName = supplier.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "salePriceHt")) supply.priceHt = Number(body.salePriceHt || 0);
  if (Object.prototype.hasOwnProperty.call(body, "priceHt") && !Object.prototype.hasOwnProperty.call(body, "salePriceHt")) supply.salePriceHt = Number(body.priceHt || 0);
  supply.updatedAt = new Date().toISOString();
  db.supplies[index] = supply;
  addHistory(db, {
    userId: supply.userId || userId,
    type: "supply.updated",
    label: `Fourniture mise a jour: ${supply.name}`,
    entityId: supply.id,
    entityType: "supply"
  });
  await writeDb(db);
  return ok({ supply });
}
