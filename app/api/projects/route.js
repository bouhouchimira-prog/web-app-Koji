import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";

export async function GET() {
  const db = await readDb();
  return ok({ projects: db.projects });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const project = {
    id: `p-${Date.now()}`,
    reference: `KOJI-2026-${String(db.projects.length + 22).padStart(3, "0")}`,
    title: body.title || "Nouveau chantier",
    client: body.client || "Client",
    address: body.address || "",
    status: "A planifier",
    progress: 0,
    budgetHt: Number(body.budgetHt || 0),
    dueDate: body.dueDate || new Date().toISOString().slice(0, 10)
  };
  db.projects.unshift(project);
  await writeDb(db);
  return ok({ project }, 201);
}
