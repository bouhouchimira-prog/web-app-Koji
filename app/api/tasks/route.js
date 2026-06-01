import { ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";

export async function GET() {
  const db = await readDb();
  return ok({ tasks: db.tasks });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const task = {
    id: `t-${Date.now()}`,
    label: body.label || "Nouvelle tache",
    project: body.project || "Chantier",
    room: body.room || "Piece",
    dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
    durationHours: Number(body.durationHours || 1),
    assignedTo: body.assignedTo || "Equipe",
    done: false
  };
  db.tasks.unshift(task);
  await writeDb(db);
  return ok({ task }, 201);
}
