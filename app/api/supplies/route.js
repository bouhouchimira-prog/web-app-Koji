import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { importSupplyFromUrl } from "../../../lib/supply-import";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ supplies: scopedItems(db.supplies, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const imported = body.importUrl || body.sourceUrl ? await importSupplyFromUrl(body.importUrl || body.sourceUrl) : {};
  const supplier = body.supplierId ? db.suppliers.find((item) => item.id === body.supplierId) : null;
  const purchasePriceHt = Number(body.purchasePriceHt ?? body.priceHt ?? imported.purchasePriceHt ?? imported.priceHt ?? 0);
  const salePriceHt = Number(body.salePriceHt ?? body.priceHt ?? imported.salePriceHt ?? imported.priceHt ?? purchasePriceHt);
  const supply = {
    id: `pr-${Date.now()}`,
    userId,
    name: body.name || imported.name || "Fourniture",
    category: body.category || imported.category || "general",
    unit: body.unit || imported.unit || "unite",
    purchasePriceHt,
    salePriceHt,
    priceHt: salePriceHt,
    stock: Number(body.stock || body.quantity || imported.quantity || 0),
    quantity: Number(body.quantity || body.stock || imported.quantity || 0),
    packaging: body.packaging || imported.packaging || "",
    supplierId: body.supplierId || "",
    supplierName: body.supplierName || supplier?.name || imported.supplierName || "",
    subcategory: body.subcategory || "",
    barcode: body.barcode || "",
    imageUrl: body.imageUrl || imported.imageUrl || "",
    sourceUrl: body.sourceUrl || body.importUrl || imported.sourceUrl || "",
    createdAt: new Date().toISOString()
  };
  db.supplies.unshift(supply);
  addHistory(db, {
    userId,
    type: "supply.created",
    label: `Fourniture ajoutée : ${supply.name}`,
    entityId: supply.id,
    entityType: "supply"
  });
  await writeDb(db);
  return ok({ supply }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
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
    "subcategory",
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
