import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";

function normalizeIntervention(item) {
  return fixObjectText(item);
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const items = scopedItems(db.interventions, userId)
    .slice()
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));
  return ok({ interventions: items.map(normalizeIntervention) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const now = new Date().toISOString();

  if (!String(body.client || "").trim()) return badRequest("Client obligatoire.", 400);

  const intervention = {
    id: `int-${Date.now()}`,
    userId,
    reference: `INT-${new Date().getFullYear()}-${String(db.interventions.length + 1).padStart(4, "0")}`,
    client: fixText(body.client || ""),
    site: fixText(body.site || ""),
    date: body.date || now.slice(0, 10),
    entreprise: fixText(body.entreprise || ""),
    equipement: fixText(body.equipement || ""),
    constat: fixText(body.constat || ""),
    analyse: fixText(body.analyse || ""),
    preconisations: fixText(body.preconisations || ""),
    signature: fixText(body.signature || ""),
    signatureImageDataUrl: body.signatureImageDataUrl || "",
    companyName: fixText(body.companyName || ""),
    companyAddressLine1: fixText(body.companyAddressLine1 || ""),
    companyPostalCode: fixText(body.companyPostalCode || ""),
    companyCity: fixText(body.companyCity || ""),
    companyEmail: fixText(body.companyEmail || ""),
    companyPhone: fixText(body.companyPhone || ""),
    companySiret: fixText(body.companySiret || ""),
    companyLogoDataUrl: body.companyLogoDataUrl || "",
    projectId: body.projectId || "",
    status: "nouvelle",
    invoiceId: "",
    completedAt: "",
    taskId: "",
    createdAt: now,
    updatedAt: now
  };

  db.interventions.unshift(intervention);
  addHistory(db, {
    userId,
    type: "intervention.created",
    label: `Rapport d'intervention cree: ${intervention.client}`,
    entityId: intervention.id,
    entityType: "intervention",
    meta: { client: intervention.client, site: intervention.site, date: intervention.date }
  });

  await writeDb(db);
  return ok({ intervention: normalizeIntervention(intervention) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.interventions, body.id, userId);
  if (index === -1) return badRequest("Intervention introuvable.", 404);

  const item = db.interventions[index];
  if (body.action === "delete") {
    db.interventions.splice(index, 1);
    addHistory(db, {
      userId: item.userId || userId,
      type: "intervention.deleted",
      label: `Rapport d'intervention supprime: ${item.client}`,
      entityId: item.id,
      entityType: "intervention"
    });
    await writeDb(db);
    return ok({ intervention: { ...normalizeIntervention(item), deleted: true } });
  }

  for (const key of [
    "client", "site", "date", "entreprise", "equipement", "constat", "analyse", "preconisations", "signature", "signatureImageDataUrl",
    "companyName", "companyAddressLine1", "companyPostalCode", "companyCity", "companyEmail", "companyPhone", "companySiret", "companyLogoDataUrl",
    "projectId", "status", "invoiceId", "completedAt", "taskId"
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) item[key] = fixObjectText(body[key]);
  }
  item.updatedAt = new Date().toISOString();
  db.interventions[index] = item;

  addHistory(db, {
    userId: item.userId || userId,
    type: "intervention.updated",
    label: `Rapport d'intervention mis a jour: ${item.client}`,
    entityId: item.id,
    entityType: "intervention"
  });

  await writeDb(db);
  return ok({ intervention: normalizeIntervention(item) });
}
