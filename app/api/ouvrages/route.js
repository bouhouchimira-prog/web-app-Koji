import { ok, badRequest } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { normalizeOuvrage, mergedOuvrages } from "../../../lib/ouvrages";
import { isVerifiedUserAdmin } from "../../../lib/admin-account";

// Bibliotheque de prix (21 oct — avant cette date, PATCH/DELETE passaient
// ADMIN_SCOPE en dur ("shared library — anyone can edit/delete"), donc
// n'importe quel compte entreprise, admin ou non, pouvait modifier le
// catalogue partage ou les ouvrages personnalises d'une AUTRE entreprise.
// Desormais : le socle commun (db.kojiOuvrages) n'est editable/supprimable
// que par un compte admin ; tout le reste (ajout, modification, masquage)
// est propre a l'entreprise appelante (voir lib/ouvrages.js::mergedOuvrages).
//
// isVerifiedUserAdmin (pas db.users.find(...).isAdmin, qui ne contient que
// les comptes particuliers — lib/particulier-users.js) resout le vrai email
// Supabase Auth d'un compte entreprise et le compare a lib/auth.js::ADMIN_EMAILS.
async function resolveCaller(request, body, db) {
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return { userId: "", isAdmin: false };
  const isAdmin = await isVerifiedUserAdmin(userId);
  return { userId, isAdmin };
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  return ok({ ouvrages: mergedOuvrages(db, userId) });
}

export async function POST(request) {
  const body = await request.json();
  if (!body.code || !body.label) return badRequest("Code et designation obligatoires.");

  const db = await readDb();
  const { userId, isAdmin } = await resolveCaller(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const now = new Date().toISOString();
  // Un admin peut publier directement dans le socle commun Koji
  // (body.addToKojiCatalog) — tout le monde d'autre cree toujours un
  // ouvrage propre a son entreprise, jamais visible des autres comptes.
  const addToKoji = isAdmin && Boolean(body.addToKojiCatalog);

  const ouvrage = normalizeOuvrage({
    id: addToKoji ? `koji-${Date.now()}` : `ouv-${Date.now()}`,
    userId: addToKoji ? "" : userId,
    code: body.code,
    label: body.label,
    description: body.description || "",
    noteInterne: body.noteInterne || "",
    sourceInterne: body.sourceInterne || "",
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
    isCustom: !addToKoji
  });

  if (addToKoji) db.kojiOuvrages.unshift(ouvrage);
  else db.ouvrages.unshift(ouvrage);

  addHistory(db, {
    userId,
    type: addToKoji ? "ouvrage.koji_created" : "ouvrage.created",
    label: `Ouvrage cree: ${ouvrage.code}`,
    entityId: ouvrage.id,
    entityType: "ouvrage"
  });
  await writeDb(db);
  return ok({ ouvrage, ouvrages: mergedOuvrages(db, userId) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  if (!body.id) return badRequest("Ouvrage introuvable.");

  const db = await readDb();
  const { userId, isAdmin } = await resolveCaller(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const now = new Date().toISOString();

  const kojiIndex = db.kojiOuvrages.findIndex((item) => item.id === body.id);
  if (kojiIndex !== -1) {
    if (isAdmin) {
      // Un admin corrige directement le socle commun — visible de tout le
      // monde immediatement.
      const updated = normalizeOuvrage({ ...db.kojiOuvrages[kojiIndex], ...body, userId: "", updatedAt: now, isCustom: false });
      db.kojiOuvrages[kojiIndex] = updated;
      addHistory(db, { userId, type: "ouvrage.koji_updated", label: `Ouvrage Koji modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
      await writeDb(db);
      return ok({ ouvrage: updated, ouvrages: mergedOuvrages(db, userId) });
    }
    // Sinon : cree/met a jour une surcharge propre a cette entreprise, sans
    // jamais toucher au socle commun ni a ce que voient les autres comptes.
    const overrideIndex = db.ouvrages.findIndex((item) => item.id === body.id && item.userId === userId);
    const base = overrideIndex === -1 ? db.kojiOuvrages[kojiIndex] : db.ouvrages[overrideIndex];
    const updated = normalizeOuvrage({ ...base, ...body, id: body.id, userId, updatedAt: now, isCustom: true });
    if (overrideIndex === -1) db.ouvrages.unshift(updated);
    else db.ouvrages[overrideIndex] = updated;
    addHistory(db, { userId, type: "ouvrage.updated", label: `Ouvrage modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
    await writeDb(db);
    return ok({ ouvrage: updated, ouvrages: mergedOuvrages(db, userId) });
  }

  // Ouvrage propre a une entreprise (pas dans le socle Koji) — seul son
  // proprietaire ou un admin peut le modifier.
  const index = db.ouvrages.findIndex((item) => item.id === body.id && (isAdmin || item.userId === userId));
  if (index === -1) return badRequest("Ouvrage introuvable.", 404);
  const updated = normalizeOuvrage({ ...db.ouvrages[index], ...body, id: body.id, userId: db.ouvrages[index].userId, updatedAt: now, isCustom: true });
  db.ouvrages[index] = updated;
  addHistory(db, { userId, type: "ouvrage.updated", label: `Ouvrage modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
  await writeDb(db);
  return ok({ ouvrage: updated, ouvrages: mergedOuvrages(db, userId) });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("Ouvrage introuvable.");

  const db = await readDb();
  const { userId, isAdmin } = await resolveCaller(request, null, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const kojiIndex = db.kojiOuvrages.findIndex((item) => item.id === id);
  if (kojiIndex !== -1) {
    const existing = db.kojiOuvrages[kojiIndex];
    if (isAdmin) {
      db.kojiOuvrages.splice(kojiIndex, 1);
      addHistory(db, { userId, type: "ouvrage.koji_deleted", label: `Ouvrage Koji supprime: ${existing.code}`, entityId: id, entityType: "ouvrage" });
    } else {
      // Masque cet ouvrage Koji uniquement pour cette entreprise — ne
      // touche ni au socle commun ni aux autres comptes.
      const alreadyHidden = db.deletedOuvrages.some((entry) => typeof entry === "string" ? entry === id : (entry.ouvrageId === id && entry.userId === userId));
      if (!alreadyHidden) db.deletedOuvrages.push({ ouvrageId: id, userId });
      addHistory(db, { userId, type: "ouvrage.hidden", label: `Ouvrage masque: ${existing.code}`, entityId: id, entityType: "ouvrage" });
    }
    await writeDb(db);
    return ok({ ouvrages: mergedOuvrages(db, userId) });
  }

  const index = db.ouvrages.findIndex((item) => item.id === id && (isAdmin || item.userId === userId));
  if (index === -1) return badRequest("Ouvrage introuvable.", 404);
  const existing = db.ouvrages[index];
  db.ouvrages.splice(index, 1);
  addHistory(db, { userId, type: "ouvrage.deleted", label: `Ouvrage supprime: ${existing.code}`, entityId: id, entityType: "ouvrage" });
  await writeDb(db);
  return ok({ ouvrages: mergedOuvrages(db, userId) });
}
