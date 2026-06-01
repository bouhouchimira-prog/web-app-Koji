import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";

export async function GET() {
  const db = await readDb();
  return ok({ quotes: db.quotes });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const quote = {
    id: `q-${Date.now()}`,
    quoteNumber: `DEV-${1048 + db.quotes.length}`,
    client: body.client || "Client",
    project: body.project || "Chantier",
    status: "Brouillon",
    rooms: body.rooms || [],
    totalHt: Number(body.totalHt || 0),
    totalTtc: Number(body.totalTtc || 0),
    createdAt: new Date().toISOString().slice(0, 10)
  };
  db.quotes.unshift(quote);
  await writeDb(db);
  return ok({ quote }, 201);
}
