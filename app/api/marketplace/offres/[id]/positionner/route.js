import { badRequest, ok } from "../../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../../lib/db";
import { resolveEntreprise, loadEntrepriseSnapshot } from "../../../../../../lib/entreprise-auth";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { maxPositionsForPlan } from "../../../../../../lib/plan";
import { contexteRadar, decorerOffre } from "../../../../../../lib/radar-server";
import { prixRecommandesPour } from "../../../../../../lib/prix-recommande-server";
import { fixText } from "../../../../../../lib/text";

// Positionnement d'une entreprise sur un chantier (cahier des charges 3.3 et
// 4.3) : premier arrive premier servi, pas de plafond sur le nombre
// d'entreprises pouvant se positionner sur UN chantier, mais un plafond sur
// le nombre de chantiers qu'UNE entreprise peut avoir en positionnement
// simultane, pour eviter qu'elle ne se disperse. Plafond desormais
// dependant du plan (24 oct, maxPositionsForPlan) — avant cette date,
// MAX_ACTIVE_POSITIONNEMENTS=5 etait fixe pour tout le monde.

function publicPositionnement(entry) {
  return {
    id: entry.id,
    jetons: Number(entry.jetons) || 0,
    creneaux: entry.creneaux || [],
    offerId: entry.offerId,
    entrepriseUserId: entry.entrepriseUserId,
    entrepriseSnapshot: entry.entrepriseSnapshot || null,
    status: entry.status,
    createdAt: entry.createdAt
  };
}

function activeCount(db, entrepriseUserId) {
  return (db.chantierPositionnements || []).filter(
    (p) => p.entrepriseUserId === entrepriseUserId && p.status === "Active"
  ).length;
}

export async function GET(request, context) {
  const { id } = await context.params;
  const db = await readDb();

  const entreprise = await resolveEntreprise(request);
  if (entreprise) {
    const mine = (db.chantierPositionnements || []).find(
      (p) => p.offerId === id && p.entrepriseUserId === entreprise.userId && p.status === "Active"
    );
    const snapshot = await loadEntrepriseSnapshot(entreprise);
    return ok({ positionnee: Boolean(mine), plafondAtteint: activeCount(db, entreprise.userId) >= maxPositionsForPlan(snapshot.plan) });
  }

  // Cote particulier (proprietaire de l'offre) : qui s'est positionne.
  // Auth obligatoire ici aussi — sans elle, n'importe qui pourrait lister
  // les entreprises positionnees (nom, adresse, telephone) sur une offre.
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre || offre.userId !== portalUserId) return badRequest("Offre introuvable.", 404);

  const list = (db.chantierPositionnements || [])
    .filter((p) => p.offerId === id && p.status === "Active")
    .map(publicPositionnement);
  return ok({ positionnements: list });
}

export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  const existing = (db.chantierPositionnements || []).find(
    (p) => p.offerId === id && p.entrepriseUserId === entreprise.userId
  );
  if (existing?.status === "Active" && Number(existing.jetons) > 0) return ok({ positionnement: publicPositionnement(existing) });

  // Jetons et places (maquette PRO-04) : 3 entreprises au plus, jetons
  // réservés maintenant, débités seulement si le client confirme un
  // rendez-vous.
  const maintenant = new Date().toISOString();
  const ctx = await contexteRadar(db, entreprise, maintenant);
  const budgets = new Map();
  const prix = await prixRecommandesPour({ db, userId: entreprise.userId, business: ctx.business, offres: [offre], budgets }).catch(() => new Map());
  const radar = decorerOffre(db, offre, ctx, budgets.get(offre.id), maintenant);
  if (offre.status !== "Publiee" || radar.expiree) return badRequest("Ce chantier n'est plus sur le Radar.", 409);
  if (radar.places.complet) return badRequest("Trois entreprises sont déjà positionnées sur ce chantier.", 409);
  if (ctx.solde.solde < radar.jetons) {
    return Response.json({ error: `Il faut ${radar.jetons} jetons, il vous en reste ${ctx.solde.solde}.`, code: "solde", manque: radar.jetons - ctx.solde.solde }, { status: 409 });
  }
  const message = fixText(String(body.message || "")).trim().slice(0, 2000);
  const creneaux = (Array.isArray(body.creneaux) ? body.creneaux : [])
    .map((c) => String(c || ""))
    .filter((c) => Number.isFinite(new Date(c).getTime()) && new Date(c).getTime() > Date.now())
    .slice(0, 4);
  const devisTtc = body.joindreDevis === true ? Number(prix.get(offre.id)?.ttc) || 0 : 0;

  const entrepriseSnapshot = await loadEntrepriseSnapshot(entreprise);
  const maxPositions = maxPositionsForPlan(entrepriseSnapshot.plan);
  if (activeCount(db, entreprise.userId) >= maxPositions) {
    return badRequest(`Vous êtes déjà positionnée sur ${maxPositions} chantiers simultanés. Retirez-vous de l'un d'eux pour vous positionner sur celui-ci.`, 409);
  }

  const now = new Date().toISOString();

  let entry;
  const proposition = { jetons: radar.jetons, message, creneaux, devisEstimatifTtc: devisTtc || null, retireLe: "" };
  if (existing) {
    Object.assign(existing, { status: "Active", entrepriseSnapshot, createdAt: now, ...proposition });
    entry = existing;
  } else {
    entry = {
      id: makeToken("position"),
      offerId: id,
      entrepriseUserId: entreprise.userId,
      entrepriseSnapshot,
      status: "Active",
      createdAt: now,
      ...proposition
    };
    db.chantierPositionnements.push(entry);
  }

  // Le client reçoit le message, les créneaux (un rendez-vous à accepter
  // par créneau) et, s'il est joint, le montant du devis estimatif.
  const base = { offerId: id, particulierUserId: offre.userId, entrepriseUserId: entreprise.userId, entrepriseSnapshot, senderType: "entreprise", respondsToId: null, rdvStatus: null };
  const texte = [message, devisTtc ? `Devis estimatif à mes prix : ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(devisTtc)} € TTC, à confirmer après la visite.` : ""].filter(Boolean).join("\n\n");
  db.chantierOffreMessages = db.chantierOffreMessages || [];
  if (texte) db.chantierOffreMessages.push({ id: makeToken("radarmsg"), ...base, message: texte, kind: "text", rdvDate: null, createdAt: now });
  for (const c of creneaux) {
    const quand = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" }).format(new Date(c));
    db.chantierOffreMessages.push({ id: makeToken("radarmsg"), ...base, message: `Proposition de visite : ${quand}.`, kind: "rdv_proposal", rdvDate: c, createdAt: now });
  }

  db.notifications.unshift({
    id: makeToken("notif"),
    userId: offre.userId,
    accountType: "particulier",
    type: "radar.positionnement",
    title: `${entrepriseSnapshot.raisonSociale} s'est positionnée sur votre chantier`,
    message: offre.description.slice(0, 140),
    offerId: id,
    entrepriseUserId: entreprise.userId,
    entrepriseName: entrepriseSnapshot.raisonSociale,
    read: false,
    createdAt: now
  });

  addHistory(db, {
    userId: entreprise.userId,
    type: "radar.positionnement",
    label: `Positionnement sur l'offre Radar des Chantiers : ${offre.description.slice(0, 60)}`,
    entityId: offre.id,
    entityType: "chantier-offre",
    meta: { offerId: offre.id }
  });

  await writeDb(db);
  return ok({ positionnement: publicPositionnement(entry) }, 201);
}

export async function DELETE(request, context) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const entry = (db.chantierPositionnements || []).find(
    (p) => p.offerId === id && p.entrepriseUserId === entreprise.userId && p.status === "Active"
  );
  if (!entry) return ok({ retiree: true });

  entry.status = "Retiree";
  entry.retireLe = new Date().toISOString();
  await writeDb(db);
  return ok({ retiree: true });
}
