import catalog from "../../../data/catalog-ouvrages.json";
import { ok, badRequest } from "../../../lib/http";
import { ADMIN_SCOPE, addHistory, findScopedIndex, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { fixText } from "../../../lib/text";

function normalizeOuvrage(item) {
  return {
    ...item,
    code: fixText(item.code || ""),
    label: fixText(item.label || ""),
    description: fixText(item.description || ""),
    profession: fixText(item.profession || item.family || ""),
    family: fixText(item.family || "Autre"),
    category: fixText(item.category || item.family || "General"),
    type: item.type || (item.parentCode ? "SOUS-POSTE" : "POSTE"),
    unit: fixText(item.unit || "u"),
    normativeTime: Number(item.normativeTime || 0),
    hourlyRate: Number(item.hourlyRate || 0),
    coefficient: Number(item.coefficient || 1),
    discount: Number(item.discount || 0),
    parentCode: item.parentCode || null,
    materialCategories: Array.isArray(item.materialCategories) ? item.materialCategories : []
  };
}

// Ouvrages library is shared across all users — no userId scoping on reads.
function mergedOuvrages(db) {
  const deleted = new Set(db.deletedOuvrages || []);
  const custom = (db.ouvrages || []).map(normalizeOuvrage);
  const customById = new Map(custom.map((item) => [item.id, item]));
  const base = catalog
    .filter((item) => !deleted.has(item.id))
    .map((item) => customById.get(item.id) || normalizeOuvrage(item));
  const customOnly = custom.filter((item) => !catalog.some((baseItem) => baseItem.id === item.id));
  return [...base, ...customOnly];
}

export async function GET(request) {
  const db = await readDb();
  return ok({ ouvrages: mergedOuvrages(db) });
}

export async function POST(request) {
  const body = await request.json();
  if (!body.code || !body.label) return badRequest("Code et designation obligatoires.");

  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const now = new Date().toISOString();
  const ouvrage = normalizeOuvrage({
    id: `ouv-${Date.now()}`,
    userId,
    code: body.code,
    label: body.label,
    description: body.description || "",
    profession: body.family || "Autre",
    family: body.family || "Autre",
    category: body.category || body.family || "General",
    type: body.parentCode ? "SOUS-POSTE" : "POSTE",
    unit: body.unit || "u",
    normativeTime: body.normativeTime,
    hourlyRate: body.hourlyRate,
    coefficient: body.coefficient,
    discount: body.discount,
    parentCode: body.parentCode || null,
    materialCategories: body.materialCategories || [],
    createdAt: now,
    updatedAt: now,
    isCustom: true
  });

  db.ouvrages.unshift(ouvrage);
  addHistory(db, {
    userId,
    type: "ouvrage.created",
    label: `Ouvrage cree: ${ouvrage.code}`,
    entityId: ouvrage.id,
    entityType: "ouvrage"
  });
  await writeDb(db);
  return ok({ ouvrage, ouvrages: mergedOuvrages(db) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  if (!body.id) return badRequest("Ouvrage introuvable.");

  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  const now = new Date().toISOString();
  const index = findScopedIndex(db.ouvrages, body.id, ADMIN_SCOPE); // shared library — anyone can edit
  const source = index === -1 ? catalog.find((item) => item.id === body.id) : db.ouvrages[index];
  if (!source) return badRequest("Ouvrage introuvable.", 404);

  const updated = normalizeOuvrage({
    ...source,
    ...body,
    userId: source.userId || userId,
    updatedAt: now,
    isCustom: true
  });

  if (index === -1) {
    db.ouvrages.unshift(updated);
  } else {
    db.ouvrages[index] = updated;
  }

  addHistory(db, {
    userId,
    type: "ouvrage.updated",
    label: `Ouvrage modifie: ${updated.code}`,
    entityId: updated.id,
    entityType: "ouvrage"
  });
  await writeDb(db);
  return ok({ ouvrage: updated, ouvrages: mergedOuvrages(db) });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("Ouvrage introuvable.");

  const db = await readDb();
  const userId = await getVerifiedUserId(request);
  const index = findScopedIndex(db.ouvrages, id, ADMIN_SCOPE); // shared library — anyone can delete
  const existing = index === -1 ? catalog.find((item) => item.id === id) : db.ouvrages[index];
  if (!existing) return badRequest("Ouvrage introuvable.", 404);

  if (index === -1) {
    if (!db.deletedOuvrages.includes(id)) db.deletedOuvrages.push(id);
  } else {
    db.ouvrages.splice(index, 1);
  }

  addHistory(db, {
    userId,
    type: "ouvrage.deleted",
    label: `Ouvrage supprime: ${existing.code}`,
    entityId: id,
    entityType: "ouvrage"
  });
  await writeDb(db);
  return ok({ ouvrages: mergedOuvrages(db) });
}
