import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserIdFromRequest, readDb, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserIdFromRequest(request);
  return ok({ workers: scopedItems(db.workers, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const firstName = body.firstName || "";
  const lastName = body.lastName || "";
  const name = body.name || [firstName, lastName].filter(Boolean).join(" ") || "Nouveau contact";
  const worker = {
    id: `w-${Date.now()}`,
    userId,
    type: body.type || "Ouvrier",
    firstName,
    lastName,
    name,
    role: body.role || body.profession || "Equipe",
    profession: body.profession || body.role || "Equipe",
    email: body.email || "",
    phone: body.phone || "",
    address: body.address || "",
    socialSecurityNumber: body.socialSecurityNumber || "",
    idCardUrl: body.idCardUrl || "",
    hourlyRate: Number(body.hourlyRate || 0),
    hireDate: body.hireDate || "",
    notes: body.notes || "",
    availability: body.availability || "Disponible",
    status: body.status || "Disponible",
    favorite: Boolean(body.favorite),
    imageUrl: body.imageUrl || "",
    photoDataUrl: body.photoDataUrl || "",
    hours: Number(body.hours || 0),
    createdAt: new Date().toISOString()
  };

  db.workers.unshift(worker);
  addHistory(db, {
    userId,
    type: "worker.created",
    label: `Contact ajoute: ${worker.name}`,
    entityId: worker.id,
    entityType: "worker"
  });
  await writeDb(db);
  return ok({ worker }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const index = findScopedIndex(db.workers, body.id, userId);
  if (index === -1) return ok({ error: "Contact introuvable." }, 404);

  const worker = db.workers[index];
  if (body.action === "delete") {
    db.workers.splice(index, 1);
    addHistory(db, {
      userId: worker.userId || userId,
      type: "worker.deleted",
      label: `Contact supprime: ${worker.name}`,
      entityId: worker.id,
      entityType: "worker"
    });
    await writeDb(db);
    return ok({ worker: { ...worker, deleted: true } });
  }

  const allowed = [
    "type",
    "firstName",
    "lastName",
    "name",
    "role",
    "profession",
    "email",
    "phone",
    "address",
    "socialSecurityNumber",
    "idCardUrl",
    "hourlyRate",
    "hireDate",
    "notes",
    "availability",
    "status",
    "favorite",
    "imageUrl",
    "photoDataUrl",
    "hours"
  ];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === "hours" || key === "hourlyRate") worker[key] = Number(body[key] || 0);
      else if (key === "favorite") worker[key] = Boolean(body[key]);
      else worker[key] = body[key];
    }
  }
  if (!worker.name || Object.prototype.hasOwnProperty.call(body, "firstName") || Object.prototype.hasOwnProperty.call(body, "lastName")) {
    worker.name = [worker.firstName, worker.lastName].filter(Boolean).join(" ") || worker.name || "Nouveau contact";
  }
  if (worker.profession && !worker.role) worker.role = worker.profession;
  if (worker.role && !worker.profession) worker.profession = worker.role;
  if (worker.status && !worker.availability) worker.availability = worker.status;
  if (worker.availability && !worker.status) worker.status = worker.availability;
  worker.updatedAt = new Date().toISOString();
  db.workers[index] = worker;
  addHistory(db, {
    userId: worker.userId || userId,
    type: "worker.updated",
    label: `Contact mis a jour: ${worker.name}`,
    entityId: worker.id,
    entityType: "worker"
  });
  await writeDb(db);
  return ok({ worker });
}
