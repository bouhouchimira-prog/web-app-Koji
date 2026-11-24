import { ok, badRequest } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { normalizeOuvrage, mergedOuvrages, mergedOuvragesAsync } from "../../../lib/ouvrages";
import { upsertSharedOuvrage, deleteSharedOuvrage } from "../../../lib/koji-ouvrages";
import { isVerifiedUserAdmin } from "../../../lib/admin-account";
import { resolveEntreprise } from "../../../lib/entreprise-auth";
import { chargerCatalogue } from "../../../lib/fournitures-serveur";
import { fixText } from "../../../lib/text";

// Champs de la fiche ouvrage (maquettes PRO-08, 08.1) : temps fixe,
// sensibilités aux facteurs de situation, « Pour Koji » (synonymes,
// déclenche, questions), lot par défaut, confiance, fourniture principale
// fournie par le client.
const FACTEURS = ["ACC", "STO", "EXI", "OCC", "SUP", "HSP", "HOR"];
const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
function champsFiche(body = {}) {
  const out = {};
  if (body.fixedTime !== undefined) out.fixedTime = Math.max(0, Math.min(200, Number(body.fixedTime) || 0));
  if (body.sensitivities && typeof body.sensitivities === "object") {
    out.sensitivities = Object.fromEntries(FACTEURS.map((k) => [k, Math.max(0, Math.min(1, Number(body.sensitivities[k]) || 0))]));
  }
  if (Array.isArray(body.synonyms)) out.synonyms = body.synonyms.map((x) => texte(x, 60)).filter(Boolean).slice(0, 20);
  if (Array.isArray(body.triggers)) out.triggers = body.triggers.map((x) => texte(x, 30).toUpperCase()).filter(Boolean).slice(0, 12);
  if (Array.isArray(body.questions)) out.questions = body.questions.map((x) => texte(x, 200)).filter(Boolean).slice(0, 6);
  if (body.defaultLot !== undefined) out.defaultLot = texte(body.defaultLot, 60);
  if (body.familyCode !== undefined) out.familyCode = texte(body.familyCode, 10).toUpperCase();
  if (["A", "B", "C"].includes(body.confidence)) out.confidence = body.confidence;
  if (body.clientFournit !== undefined) out.clientFournit = Boolean(body.clientFournit);
  return out;
}

// Fournitures liées depuis la fiche : le lien vit sur l'article (PRO-07,
// db.articlesPro.ouvrages), une seule source pour le devis et les commandes.
async function lierFournitures(request, body, db, code) {
  if (!Array.isArray(body.fournitures) || !code) return;
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return;
  const { articles } = await chargerCatalogue(entreprise, db);
  const voulus = new Map(body.fournitures.filter((f) => f && f.articleId).map((f) => [f.articleId, Math.max(0, Number(f.conso) || 0)]));
  if (!Array.isArray(db.articlesPro)) db.articlesPro = [];
  for (const a of articles) {
    const liee = a.ouvrages.some((o) => o.code === code);
    if (!voulus.has(a.id) && !liee) continue;
    let fiche = db.articlesPro.find((d) => d.id === a.id && d.userId === entreprise.userId);
    if (!fiche) { fiche = { id: a.id, userId: entreprise.userId, ouvrages: [] }; db.articlesPro.push(fiche); }
    const autres = (fiche.ouvrages || a.ouvrages || []).filter((o) => o.code !== code);
    fiche.ouvrages = voulus.has(a.id) && voulus.get(a.id) > 0
      ? [...autres, { code, label: texte(body.label, 120), conso: voulus.get(a.id), unite: texte(body.unit, 12) }]
      : autres;
  }
}

// Historique d'une fiche : qui a changé quoi, gardé sur l'ouvrage.
function noterHistorique(ancien = {}, nouveau = {}, now) {
  const champs = ["label", "unit", "normativeTime", "fixedTime", "hourlyRate", "coefficient", "discount", "sensitivities", "synonyms", "triggers", "questions"]
    .filter((k) => JSON.stringify(ancien[k] ?? null) !== JSON.stringify(nouveau[k] ?? null));
  const h = Array.isArray(ancien.historique) ? ancien.historique : [];
  return champs.length ? [...h, { date: now, champs }].slice(-30) : h;
}

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
  return ok({ ouvrages: await mergedOuvragesAsync(db, userId) });
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
    billingMode: body.billingMode,
    fixedAmountHt: body.fixedAmountHt,
    suppliesCost: body.suppliesCost,
    copiedFromCode: body.copiedFromCode || null,
    copiedFromKojiPriceHt: body.copiedFromKojiPriceHt,
    ...champsFiche(body),
    createdAt: now,
    updatedAt: now,
    isCustom: !addToKoji
  });
  if (!addToKoji && mergedOuvrages(db, userId).some((o) => String(o.code).toUpperCase() === String(ouvrage.code).toUpperCase())) {
    return badRequest(`Le code ${ouvrage.code} existe déjà dans votre bibliothèque.`, 409);
  }

  if (addToKoji) db.kojiOuvrages.unshift(ouvrage);
  else db.ouvrages.unshift(ouvrage);
  await lierFournitures(request, body, db, ouvrage.code);

  addHistory(db, {
    userId,
    type: addToKoji ? "ouvrage.koji_created" : "ouvrage.created",
    label: `Ouvrage cree: ${ouvrage.code}`,
    entityId: ouvrage.id,
    entityType: "ouvrage"
  });
  await writeDb(db);
  // Synchronisation vers la table partagee (mobile) — best-effort.
  if (addToKoji) await upsertSharedOuvrage(ouvrage).catch(() => null);
  return ok({ ouvrage, ouvrages: await mergedOuvragesAsync(db, userId) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  if (!body.id) return badRequest("Ouvrage introuvable.");

  const db = await readDb();
  const { userId, isAdmin } = await resolveCaller(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const now = new Date().toISOString();

  const fiche = champsFiche(body);
  // Fiche Bibliothèque (PRO-08) : « perso » modifie toujours la version de
  // l'entreprise, même pour un compte admin (le socle commun ne change que
  // depuis l'outil admin), y compris pour un ouvrage du socle lu dans la
  // table partagée.
  if (body.perso === true) {
    const visibles = await mergedOuvragesAsync(db, userId);
    const base = visibles.find((item) => item.id === body.id);
    if (!base) return badRequest("Ouvrage introuvable.", 404);
    const idx = db.ouvrages.findIndex((item) => item.id === body.id && item.userId === userId);
    const { perso, fournitures, ...reste } = body;
    void perso; void fournitures;
    const ancien = idx === -1 ? base : db.ouvrages[idx];
    const updated = normalizeOuvrage({ ...ancien, ...reste, ...fiche, id: body.id, userId, updatedAt: now, isCustom: true, ajusteLe: now });
    updated.historique = noterHistorique(ancien, updated, now);
    if (idx === -1) db.ouvrages.unshift(updated);
    else db.ouvrages[idx] = updated;
    await lierFournitures(request, body, db, updated.code);
    addHistory(db, { userId, type: "ouvrage.updated", label: `Ouvrage modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
    await writeDb(db);
    return ok({ ouvrage: updated, ouvrages: await mergedOuvragesAsync(db, userId) });
  }

  const kojiIndex = db.kojiOuvrages.findIndex((item) => item.id === body.id);
  if (kojiIndex !== -1) {
    if (isAdmin) {
      // Un admin corrige directement le socle commun — visible de tout le
      // monde immediatement.
      const updated = normalizeOuvrage({ ...db.kojiOuvrages[kojiIndex], ...body, userId: "", updatedAt: now, isCustom: false });
      db.kojiOuvrages[kojiIndex] = updated;
      addHistory(db, { userId, type: "ouvrage.koji_updated", label: `Ouvrage Koji modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
      await writeDb(db);
      await upsertSharedOuvrage(updated).catch(() => null);
      return ok({ ouvrage: updated, ouvrages: await mergedOuvragesAsync(db, userId) });
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
    return ok({ ouvrage: updated, ouvrages: await mergedOuvragesAsync(db, userId) });
  }

  // Ouvrage propre a une entreprise (pas dans le socle Koji) — seul son
  // proprietaire ou un admin peut le modifier.
  const index = db.ouvrages.findIndex((item) => item.id === body.id && (isAdmin || item.userId === userId));
  if (index === -1) return badRequest("Ouvrage introuvable.", 404);
  const updated = normalizeOuvrage({ ...db.ouvrages[index], ...body, id: body.id, userId: db.ouvrages[index].userId, updatedAt: now, isCustom: true });
  db.ouvrages[index] = updated;
  addHistory(db, { userId, type: "ouvrage.updated", label: `Ouvrage modifie: ${updated.code}`, entityId: updated.id, entityType: "ouvrage" });
  await writeDb(db);
  return ok({ ouvrage: updated, ouvrages: await mergedOuvragesAsync(db, userId) });
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
      await deleteSharedOuvrage(existing.code).catch(() => null);
    } else {
      // Masque cet ouvrage Koji uniquement pour cette entreprise — ne
      // touche ni au socle commun ni aux autres comptes.
      const alreadyHidden = db.deletedOuvrages.some((entry) => typeof entry === "string" ? entry === id : (entry.ouvrageId === id && entry.userId === userId));
      if (!alreadyHidden) db.deletedOuvrages.push({ ouvrageId: id, userId });
      addHistory(db, { userId, type: "ouvrage.hidden", label: `Ouvrage masque: ${existing.code}`, entityId: id, entityType: "ouvrage" });
    }
    await writeDb(db);
    return ok({ ouvrages: await mergedOuvragesAsync(db, userId) });
  }

  const index = db.ouvrages.findIndex((item) => item.id === id && (isAdmin || item.userId === userId));
  if (index === -1) return badRequest("Ouvrage introuvable.", 404);
  const existing = db.ouvrages[index];
  db.ouvrages.splice(index, 1);
  addHistory(db, { userId, type: "ouvrage.deleted", label: `Ouvrage supprime: ${existing.code}`, entityId: id, entityType: "ouvrage" });
  await writeDb(db);
  return ok({ ouvrages: await mergedOuvragesAsync(db, userId) });
}
