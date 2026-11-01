import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth, getVerifiedUserId } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { isTrialUser } from "../../../lib/plan";
import { fixText } from "../../../lib/text";
import { cleanText, daysBetween, distanceBetween, documentsStatus, initials, publicProfil } from "../../../lib/reseau";

const METIER_MAX = 60;
const MAX_METIERS = 6;
const BESOIN_STATUSES = new Set(["ouvert", "pourvu", "ferme"]);

// Données stockées dans le JSON koji_web_state (pas de RLS) : l'identité vient
// toujours de getVerifiedUserId, jamais du simple décodage du jeton.
async function authenticate(request, body = null) {
  const userId = await getVerifiedUserId(request, body);
  const auth = userId ? getAuth(request, body) : null;
  if (!auth || auth.userId !== userId) return null;
  return auth;
}

async function loadMe(auth) {
  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const user = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  const business = user.business || {};
  const lat = business.zoneLat;
  const lon = business.zoneLon;
  return {
    user,
    companyName: fixText(business.raisonSociale || user.name || "Entreprise"),
    professions: Array.isArray(user.professions) ? user.professions : [],
    zone: { lat, lon },
    radiusKm: Number(business.zoneRadiusKm || 20),
    city: fixText(business.city || business.zoneAddress || "")
  };
}

function myProfil(db, userId) {
  return db.reseauProfils.find((profil) => profil.userId === userId) || null;
}

function besoinView(besoin, db, userId, viewerZone) {
  const mine = besoin.userId === userId;
  const echanges = db.reseauEchanges.filter((echange) => echange.besoinId === besoin.id);
  const myEchange = echanges.find((echange) => echange.participants.includes(userId));
  return {
    id: besoin.id,
    mine,
    companyName: besoin.companyName,
    initials: initials(besoin.companyName),
    title: besoin.title,
    metier: besoin.metier,
    startDate: besoin.startDate,
    endDate: besoin.endDate,
    days: daysBetween(besoin.startDate, besoin.endDate),
    city: besoin.city,
    distanceKm: mine ? null : distanceBetween(viewerZone, besoin.coords),
    budgetHt: besoin.budgetHt,
    fournitures: besoin.fournitures,
    message: besoin.message,
    lotLabel: besoin.lotLabel,
    projectTitle: mine || !besoin.hideClient ? besoin.projectTitle : "",
    fromChantier: Boolean(besoin.lotLabel),
    status: besoin.status,
    responses: echanges.length,
    myEchangeId: myEchange?.id || "",
    createdAt: besoin.createdAt
  };
}

function echangeView(echange, db, userId) {
  const otherId = echange.participants.find((id) => id !== userId);
  const otherName = echange.names?.[otherId] || "Entreprise";
  const besoin = echange.besoinId ? db.reseauBesoins.find((item) => item.id === echange.besoinId) : null;
  return {
    id: echange.id,
    besoinId: echange.besoinId || "",
    besoinTitle: besoin?.title || "",
    iOwnBesoin: Boolean(besoin && besoin.userId === userId),
    other: { companyName: otherName, initials: initials(otherName) },
    status: echange.status || "ouvert",
    messages: echange.messages.map((message) => ({ id: message.id, mine: message.from === userId, text: message.text, at: message.at })),
    updatedAt: echange.updatedAt
  };
}

function notify(db, { userId, title, message, echangeId, now }) {
  db.notifications.unshift({
    id: `notif-reseau-${echangeId}-${Date.now()}`,
    userId,
    type: "reseau.message",
    title,
    message,
    actionUrl: `/reseau-pro?tab=echanges&e=${echangeId}`,
    actionLabel: "Ouvrir l'échange",
    read: false,
    createdAt: now
  });
}

export async function GET(request) {
  const auth = await authenticate(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const me = await loadMe(auth);
  if (isTrialUser(me.user)) return ok({ locked: true });

  const db = await readDb();
  const userId = auth.userId;
  const profil = myProfil(db, userId);
  const docs = documentsStatus(profil);

  const besoins = db.reseauBesoins
    .filter((besoin) => besoin.userId === userId || besoin.status === "ouvert")
    .map((besoin) => besoinView(besoin, db, userId, me.zone))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  // Un document déclaré expiré masque le profil (règle de la maquette) ;
  // un document jamais renseigné le laisse visible, marqué « à jour requis ».
  const pros = db.reseauProfils
    .filter((item) => item.userId !== userId && item.visible && !documentsStatus(item).expired)
    .map((item) => publicProfil(item, me.zone))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.companyName.localeCompare(b.companyName));

  const echanges = db.reseauEchanges
    .filter((echange) => echange.participants.includes(userId))
    .map((echange) => echangeView(echange, db, userId))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return ok({
    locked: false,
    me: {
      companyName: me.companyName,
      professions: me.professions,
      hasZone: distanceBetween(me.zone, me.zone) !== null,
      radiusKm: me.radiusKm,
      city: me.city,
      profil: profil ? { ...profil, coords: undefined, userId: undefined } : null,
      documents: docs
    },
    besoins,
    pros,
    echanges
  });
}

export async function POST(request) {
  const body = await request.json();
  const auth = await authenticate(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const me = await loadMe(auth);
  if (isTrialUser(me.user)) return badRequest("Le Réseau pro est inclus dans les offres Pro et Business.", 402);

  const db = await readDb();
  const userId = auth.userId;
  const now = new Date().toISOString();
  const action = body.action;

  if (action === "profil") {
    const metiers = (Array.isArray(body.metiers) ? body.metiers : [])
      .map((metier) => cleanText(metier, METIER_MAX)).filter(Boolean).slice(0, MAX_METIERS);
    const existing = myProfil(db, userId);
    const profil = {
      id: existing?.id || `rp-${crypto.randomUUID()}`,
      userId,
      companyName: me.companyName,
      visible: Boolean(body.visible),
      metiers,
      zone: cleanText(body.zone, 120) || me.city,
      availableFrom: cleanText(body.availableFrom, 10),
      availabilityNote: cleanText(body.availabilityNote, 200),
      kbisDate: cleanText(body.kbisDate, 10),
      urssafUntil: cleanText(body.urssafUntil, 10),
      decennaleUntil: cleanText(body.decennaleUntil, 10),
      coords: me.zone,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    if (existing) db.reseauProfils[db.reseauProfils.indexOf(existing)] = profil;
    else db.reseauProfils.push(profil);
    await writeDb(db);
    return ok({ saved: true });
  }

  if (action === "besoin") {
    const title = cleanText(body.title, 200);
    const metier = cleanText(body.metier, METIER_MAX);
    if (!title || !metier) return badRequest("Décrivez le besoin et choisissez le métier.");
    const startDate = cleanText(body.startDate, 10);
    const endDate = cleanText(body.endDate, 10) || startDate;
    if (startDate && endDate < startDate) return badRequest("La date de fin est avant la date de début.");
    const budget = Number(body.budgetHt);
    const besoin = {
      id: `rb-${crypto.randomUUID()}`,
      userId,
      companyName: me.companyName,
      title,
      metier,
      startDate,
      endDate,
      budgetHt: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
      fournitures: body.fournitures === "sous-traitant" ? "sous-traitant" : "moi",
      city: cleanText(body.city, 120) || me.city,
      message: cleanText(body.message),
      hideClient: body.hideClient !== false,
      projectId: cleanText(body.projectId, 80),
      projectTitle: cleanText(body.projectTitle, 160),
      lotLabel: cleanText(body.lotLabel, 120),
      coords: me.zone,
      status: "ouvert",
      createdAt: now,
      updatedAt: now
    };
    db.reseauBesoins.unshift(besoin);
    addHistory(db, { userId, type: "reseau.besoin", label: `Besoin publié : ${title}`, entityId: besoin.id, entityType: "reseauBesoin" });
    await writeDb(db);
    return ok({ besoin: besoinView(besoin, db, userId, me.zone) }, 201);
  }

  if (action === "besoin-statut") {
    const besoin = db.reseauBesoins.find((item) => item.id === body.id && item.userId === userId);
    if (!besoin) return badRequest("Besoin introuvable.", 404);
    if (!BESOIN_STATUSES.has(body.status)) return badRequest("Statut inconnu.");
    besoin.status = body.status;
    besoin.updatedAt = now;
    await writeDb(db);
    return ok({ besoin: besoinView(besoin, db, userId, me.zone) });
  }

  if (action === "contacter") {
    const text = cleanText(body.text);
    if (!text) return badRequest("Écrivez un message.");
    let otherId = "";
    let besoinId = "";
    if (body.besoinId) {
      const besoin = db.reseauBesoins.find((item) => item.id === body.besoinId && item.status === "ouvert");
      if (!besoin) return badRequest("Ce besoin n'est plus ouvert.", 404);
      if (besoin.userId === userId) return badRequest("C'est votre propre besoin.");
      otherId = besoin.userId;
      besoinId = besoin.id;
    } else {
      const profil = db.reseauProfils.find((item) => item.id === body.profilId && item.visible);
      if (!profil || profil.userId === userId) return badRequest("Profil introuvable.", 404);
      otherId = profil.userId;
    }
    const otherName = besoinId
      ? db.reseauBesoins.find((item) => item.id === besoinId).companyName
      : db.reseauProfils.find((item) => item.userId === otherId).companyName;
    let echange = db.reseauEchanges.find((item) => (item.besoinId || "") === besoinId
      && item.participants.includes(userId) && item.participants.includes(otherId));
    if (!echange) {
      echange = { id: `re-${crypto.randomUUID()}`, besoinId, participants: [userId, otherId], names: { [userId]: me.companyName, [otherId]: otherName }, status: "ouvert", messages: [], createdAt: now, updatedAt: now };
      db.reseauEchanges.unshift(echange);
    }
    echange.messages.push({ id: `rm-${crypto.randomUUID()}`, from: userId, text, at: now });
    echange.updatedAt = now;
    notify(db, {
      userId: otherId,
      title: besoinId ? "Nouvelle réponse à votre besoin" : "Nouveau message du Réseau pro",
      message: `${me.companyName} : ${text.slice(0, 140)}`,
      echangeId: echange.id,
      now
    });
    await writeDb(db);
    return ok({ echange: echangeView(echange, db, userId) }, 201);
  }

  if (action === "message") {
    const text = cleanText(body.text);
    if (!text) return badRequest("Écrivez un message.");
    const echange = db.reseauEchanges.find((item) => item.id === body.echangeId && item.participants.includes(userId));
    if (!echange) return badRequest("Échange introuvable.", 404);
    echange.messages.push({ id: `rm-${crypto.randomUUID()}`, from: userId, text, at: now });
    echange.updatedAt = now;
    const otherId = echange.participants.find((id) => id !== userId);
    notify(db, { userId: otherId, title: "Nouveau message du Réseau pro", message: `${me.companyName} : ${text.slice(0, 140)}`, echangeId: echange.id, now });
    await writeDb(db);
    return ok({ echange: echangeView(echange, db, userId) });
  }

  if (action === "retenir") {
    const echange = db.reseauEchanges.find((item) => item.id === body.echangeId && item.participants.includes(userId));
    const besoin = echange?.besoinId ? db.reseauBesoins.find((item) => item.id === echange.besoinId) : null;
    if (!echange || !besoin || besoin.userId !== userId) return badRequest("Seul l'auteur du besoin peut retenir un pro.", 403);
    echange.status = "retenu";
    echange.updatedAt = now;
    besoin.status = "pourvu";
    besoin.updatedAt = now;
    const otherId = echange.participants.find((id) => id !== userId);
    notify(db, { userId: otherId, title: "Vous êtes retenu", message: `${me.companyName} vous retient pour : ${besoin.title}`, echangeId: echange.id, now });
    await writeDb(db);
    return ok({ echange: echangeView(echange, db, userId), besoin: besoinView(besoin, db, userId, me.zone) });
  }

  return badRequest("Action inconnue.");
}
