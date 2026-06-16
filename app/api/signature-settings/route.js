import { ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ signatureSettings: scopedItems(db.signatureSettings, userId) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = body.userId || "";
  const existingIndex = db.signatureSettings.findIndex((item) => item.userId === userId);
  const now = new Date().toISOString();
  const setting = {
    id: existingIndex === -1 ? `sgn-${Date.now()}` : db.signatureSettings[existingIndex].id,
    userId,
    signatureDataUrl: body.signatureDataUrl || "",
    label: body.label || "Signature principale",
    createdAt: existingIndex === -1 ? now : db.signatureSettings[existingIndex].createdAt,
    updatedAt: now
  };

  if (existingIndex === -1) db.signatureSettings.unshift(setting);
  else db.signatureSettings[existingIndex] = setting;

  addHistory(db, {
    userId,
    type: "signature.saved",
    label: "Signature sauvegardee",
    entityId: setting.id,
    entityType: "signature"
  });
  await writeDb(db);
  return ok({ signatureSetting: setting, signatureSettings: scopedItems(db.signatureSettings, userId) }, existingIndex === -1 ? 201 : 200);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const index = findScopedIndex(db.signatureSettings, body.id, userId);
  if (index === -1) return ok({ error: "Signature introuvable." }, 404);

  const signature = db.signatureSettings[index];
  if (body.action === "delete") {
    db.signatureSettings.splice(index, 1);
    addHistory(db, {
      userId: signature.userId || userId,
      type: "signature.deleted",
      label: "Signature supprimee",
      entityId: signature.id,
      entityType: "signature"
    });
    await writeDb(db);
    return ok({ signatureSetting: { ...signature, deleted: true }, signatureSettings: scopedItems(db.signatureSettings, userId) });
  }

  if (Object.prototype.hasOwnProperty.call(body, "signatureDataUrl")) signature.signatureDataUrl = body.signatureDataUrl;
  if (Object.prototype.hasOwnProperty.call(body, "label")) signature.label = body.label;
  signature.updatedAt = new Date().toISOString();
  db.signatureSettings[index] = signature;
  addHistory(db, {
    userId: signature.userId || userId,
    type: "signature.updated",
    label: "Signature mise a jour",
    entityId: signature.id,
    entityType: "signature"
  });
  await writeDb(db);
  return ok({ signatureSetting: signature, signatureSettings: scopedItems(db.signatureSettings, userId) });
}
