import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";

export async function GET() {
  const db = await readDb();
  return ok({ supplies: db.supplies });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const supply = {
    id: `pr-${Date.now()}`,
    name: body.name || "Fourniture",
    category: body.category || "general",
    unit: body.unit || "unite",
    priceHt: Number(body.priceHt || 0),
    stock: Number(body.stock || 0)
  };
  db.supplies.unshift(supply);
  await writeDb(db);
  return ok({ supply }, 201);
}
