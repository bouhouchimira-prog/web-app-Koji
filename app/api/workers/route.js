import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixText } from "../../../lib/text";
import { hashPassword, makeTemporaryPassword, makeWorkerLoginId, publicWorker } from "../../../lib/worker-auth";

function queueCredentialsMessage(db, worker, temporaryPassword) {
  const loginId = worker.loginId || worker.identifier || "";
  const message = `Bonjour ${worker.name}, votre acces Kôji Ouvrier est pret. Identifiant: ${loginId}. Mot de passe provisoire: ${temporaryPassword}`;
  if (worker.email) {
    db.mailOutbox.unshift({
      id: `mail-worker-${Date.now()}`,
      userId: worker.userId || "",
      to: worker.email,
      subject: "Vos acces Kôji Ouvrier",
      body: message,
      type: "worker.credentials",
      createdAt: new Date().toISOString(),
    });
  }
  if (worker.phone) {
    db.smsOutbox.unshift({
      id: `sms-worker-${Date.now()}`,
      userId: worker.userId || "",
      to: worker.phone,
      body: message,
      type: "worker.credentials",
      createdAt: new Date().toISOString(),
    });
  }
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ workers: scopedItems(db.workers, userId).map(publicWorker) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const firstName = fixText(body.firstName || "");
  const lastName = fixText(body.lastName || "");
  const name = fixText(body.name || [firstName, lastName].filter(Boolean).join(" ") || "Nouvel ouvrier");
  const loginId = fixText(body.loginId || makeWorkerLoginId(db.workers));
  const temporaryPassword = body.password || body.temporaryPassword || makeTemporaryPassword();
  const passwordData = hashPassword(temporaryPassword);
  const now = new Date().toISOString();

  const worker = {
    id: `w-${Date.now()}`,
    userId,
    loginId,
    identifier: loginId,
    portalRole: "worker",
    type: fixText(body.type || "Ouvrier"),
    firstName,
    lastName,
    name,
    role: fixText(body.role || body.profession || "Ouvrier"),
    profession: fixText(body.profession || body.role || "Ouvrier"),
    email: fixText(body.email || ""),
    phone: fixText(body.phone || ""),
    address: fixText(body.address || ""),
    socialSecurityNumber: body.socialSecurityNumber || "",
    idCardUrl: body.idCardUrl || "",
    hourlyRate: Number(body.hourlyRate || 0),
    hireDate: body.hireDate || "",
    notes: fixText(body.notes || ""),
    availability: fixText(body.availability || "Disponible"),
    status: fixText(body.status || "Disponible"),
    favorite: Boolean(body.favorite),
    imageUrl: body.imageUrl || "",
    photoDataUrl: body.photoDataUrl || "",
    hours: Number(body.hours || 0),
    passwordHash: passwordData.passwordHash,
    passwordSalt: passwordData.passwordSalt,
    passwordSetupRequired: true,
    credentialsIssuedAt: now,
    createdAt: now,
  };

  db.workers.unshift(worker);
  queueCredentialsMessage(db, worker, temporaryPassword);
  addHistory(db, {
    userId,
    type: "worker.created",
    label: `Ouvrier ajoute: ${worker.name}`,
    entityId: worker.id,
    entityType: "worker",
    meta: { loginId: worker.loginId },
  });
  await writeDb(db);
  return ok({ worker: publicWorker(worker), credentials: { loginId, temporaryPassword } }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.workers, body.id, userId);
  if (index === -1) return ok({ error: "Ouvrier introuvable." }, 404);

  const worker = db.workers[index];
  if (body.action === "delete") {
    db.workers.splice(index, 1);
    addHistory(db, {
      userId: worker.userId || userId,
      type: "worker.deleted",
      label: `Ouvrier supprime: ${worker.name}`,
      entityId: worker.id,
      entityType: "worker",
    });
    await writeDb(db);
    return ok({ worker: { ...publicWorker(worker), deleted: true } });
  }

  if (body.action === "resetCredentials") {
    const loginId = worker.loginId || worker.identifier || makeWorkerLoginId(db.workers);
    const temporaryPassword = makeTemporaryPassword();
    const passwordData = hashPassword(temporaryPassword);
    worker.loginId = loginId;
    worker.identifier = loginId;
    worker.passwordHash = passwordData.passwordHash;
    worker.passwordSalt = passwordData.passwordSalt;
    worker.passwordSetupRequired = true;
    worker.credentialsIssuedAt = new Date().toISOString();
    queueCredentialsMessage(db, worker, temporaryPassword);
    addHistory(db, {
      userId: worker.userId || userId,
      type: "worker.credentials_reset",
      label: `Identifiants ouvrier regeneres: ${worker.name}`,
      entityId: worker.id,
      entityType: "worker",
      meta: { loginId },
    });
    await writeDb(db);
    return ok({ worker: publicWorker(worker), credentials: { loginId, temporaryPassword } });
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
      else worker[key] = fixText(body[key]);
    }
  }
  if (!worker.loginId) worker.loginId = makeWorkerLoginId(db.workers);
  worker.identifier = worker.loginId;
  worker.portalRole = "worker";
  if (!worker.name || Object.prototype.hasOwnProperty.call(body, "firstName") || Object.prototype.hasOwnProperty.call(body, "lastName")) {
    worker.name = [worker.firstName, worker.lastName].filter(Boolean).join(" ") || worker.name || "Nouvel ouvrier";
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
    label: `Ouvrier mis a jour: ${worker.name}`,
    entityId: worker.id,
    entityType: "worker",
  });
  await writeDb(db);
  return ok({ worker: publicWorker(worker) });
}
