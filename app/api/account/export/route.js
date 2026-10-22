import { badRequest, ok } from "../../../../lib/http";
import { readDb, scopedItems } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { getVerifiedWorkerId } from "../../../../lib/worker-session";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";

// Droit a la portabilite des donnees (RGPD art. 20, 30 septembre) — export
// autoservice, contrairement a la suppression de compte (voir
// app/api/account/deletion-request/route.js) : lire ses propres donnees ne
// presente aucun risque de perte ou de conflit avec l'app mobile, donc pas
// besoin d'un traitement manuel ici.
//
// Perimetre couvert par type de compte (les entites les plus reconnaissables
// pour la personne — pas necessairement exhaustif sur les ~27 collections
// techniques internes) :
// - entreprise : profil, devis, chantiers, calendrier, equipe, contacts,
//   taches, depenses, interventions, fournisseurs, fournitures, alertes,
//   notifications, signalements techniques envoyes.
// - particulier : profil, offres Radar des Chantiers publiees, messages et
//   paiements lies, notifications.
// - ouvrier : fiche, pointages, notifications.
const SECRET_FIELDS = [
  "passwordHash", "passwordSalt", "password", "temporaryPassword",
  "portalPasswordHash", "portalPasswordSalt", "signatureAccessPasswordHash", "signatureAccessPasswordSalt"
];

function stripSecrets(record) {
  if (!record || typeof record !== "object") return record;
  const clean = { ...record };
  for (const key of SECRET_FIELDS) delete clean[key];
  return clean;
}

async function exportEntreprise(request, db) {
  const auth = getAuth(request);
  if (!auth) return null;

  const { data: profile } = await auth.supabase.from("users").select("email, business_info").eq("id", auth.userId).maybeSingle();
  const { data: devis } = await auth.supabase.from("quotes").select("*").eq("user_id", auth.userId);
  const { data: chantiers } = await auth.supabase.from("chantiers").select("*, chantier_budgets(*)");
  const { data: calendrier } = await auth.supabase.from("calendar_events").select("*");

  return {
    accountType: "entreprise",
    profil: stripSecrets(profile),
    devis: devis || [],
    chantiers: chantiers || [],
    calendrier: calendrier || [],
    equipe: scopedItems(db.workers, auth.userId).map(stripSecrets),
    contacts: scopedItems(db.contacts, auth.userId),
    taches: scopedItems(db.tasks, auth.userId),
    depenses: scopedItems(db.expenses, auth.userId),
    interventions: scopedItems(db.interventions, auth.userId),
    fournisseurs: scopedItems(db.suppliers, auth.userId),
    fournitures: scopedItems(db.supplies, auth.userId),
    alertesUrgentes: scopedItems(db.urgentAlerts, auth.userId),
    notifications: scopedItems(db.notifications, auth.userId),
    signalementsTechniques: scopedItems(db.technicalReports, auth.userId)
  };
}

function exportParticulier(portalUserId, db) {
  const profil = (db.users || []).find((u) => u.id === portalUserId);
  const offres = (db.chantierOffres || []).filter((o) => o.userId === portalUserId);
  const offreIds = new Set(offres.map((o) => o.id));
  return {
    accountType: "particulier",
    profil: stripSecrets(profil),
    offresRadarDesChantiers: offres,
    messages: (db.chantierOffreMessages || []).filter((m) => offreIds.has(m.offerId)),
    paiements: (db.chantierPaiements || []).filter((p) => offreIds.has(p.offerId)),
    notifications: scopedItems(db.notifications, portalUserId)
  };
}

function exportOuvrier(workerId, db) {
  const fiche = (db.workers || []).find((w) => w.id === workerId);
  return {
    accountType: "ouvrier",
    profil: stripSecrets(fiche),
    pointages: (db.attendanceEntries || []).filter((e) => e.workerId === workerId),
    notifications: scopedItems(db.notifications, workerId)
  };
}

export async function GET(request) {
  const db = await readDb();

  const entreprise = await exportEntreprise(request, db);
  if (entreprise) return ok({ export: entreprise, generatedAt: new Date().toISOString() });

  const portalUserId = getVerifiedPortalUserId(request);
  if (portalUserId) return ok({ export: exportParticulier(portalUserId, db), generatedAt: new Date().toISOString() });

  const workerId = getVerifiedWorkerId(request);
  if (workerId) return ok({ export: exportOuvrier(workerId, db), generatedAt: new Date().toISOString() });

  return badRequest("Session expirée. Reconnectez-vous.", 401);
}
