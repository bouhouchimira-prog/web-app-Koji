import { badRequest, ok } from "../../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../../lib/db";
import { resolveEntreprise, loadEntrepriseSnapshot } from "../../../../../../lib/entreprise-auth";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";

// Positionnement d'une entreprise sur un chantier (cahier des charges 3.3 et
// 4.3) : premier arrive premier servi, pas de plafond sur le nombre
// d'entreprises pouvant se positionner sur UN chantier, mais un plafond sur
// le nombre de chantiers qu'UNE entreprise peut avoir en positionnement
// simultane, pour eviter qu'elle ne se disperse.
const MAX_ACTIVE_POSITIONNEMENTS = 5;

function publicPositionnement(entry) {
  return {
    id: entry.id,
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
    return ok({ positionnee: Boolean(mine), plafondAtteint: activeCount(db, entreprise.userId) >= MAX_ACTIVE_POSITIONNEMENTS });
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
  if (existing?.status === "Active") return ok({ positionnement: publicPositionnement(existing) });

  if (activeCount(db, entreprise.userId) >= MAX_ACTIVE_POSITIONNEMENTS) {
    return badRequest(`Vous êtes déjà positionnée sur ${MAX_ACTIVE_POSITIONNEMENTS} chantiers simultanés. Retirez-vous de l'un d'eux pour vous positionner sur celui-ci.`, 409);
  }

  const now = new Date().toISOString();
  const entrepriseSnapshot = await loadEntrepriseSnapshot(entreprise);

  let entry;
  if (existing) {
    existing.status = "Active";
    existing.entrepriseSnapshot = entrepriseSnapshot;
    existing.createdAt = now;
    entry = existing;
  } else {
    entry = {
      id: makeToken("position"),
      offerId: id,
      entrepriseUserId: entreprise.userId,
      entrepriseSnapshot,
      status: "Active",
      createdAt: now
    };
    db.chantierPositionnements.push(entry);
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
  await writeDb(db);
  return ok({ retiree: true });
}
