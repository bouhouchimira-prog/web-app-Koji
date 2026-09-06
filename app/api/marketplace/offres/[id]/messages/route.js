import { badRequest, ok } from "../../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { resolveEntreprise, loadEntrepriseSnapshot } from "../../../../../../lib/entreprise-auth";
import { fixText } from "../../../../../../lib/text";

// Messagerie interne Radar des Chantiers (module 4.5 du cahier des charges)
// — un fil par (offre, entreprise). Cote entreprise : un seul fil, le sien.
// Cote particulier (proprietaire de l'offre) : tous les fils, un par
// entreprise qui a ecrit, regroupes cote client dans l'UI.
//
// "kind" distingue un message texte simple d'un message structure : "text"
// (defaut, retrocompatible avec tous les messages envoyes avant l'ajout de
// ce champ), "rdv_proposal"/"rdv_response" (module positionnement/RDV — une
// proposition porte rdvDate, une reponse porte respondsToId et rdvStatus
// "accepted"|"declined"), et "photo_request"/"photo_grant" (photos du
// chantier masquees par defaut — l'entreprise demande, le particulier
// debloque ; voir lib/photo-access.js).
function publicMessage(message) {
  return {
    id: message.id,
    senderType: message.senderType,
    entrepriseUserId: message.entrepriseUserId,
    entrepriseSnapshot: message.entrepriseSnapshot || null,
    message: message.message,
    kind: message.kind || "text",
    rdvDate: message.rdvDate || null,
    respondsToId: message.respondsToId || null,
    rdvStatus: message.rdvStatus || null,
    createdAt: message.createdAt
  };
}

export async function GET(request, context) {
  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  const entreprise = await resolveEntreprise(request);
  if (entreprise) {
    // Cote entreprise : uniquement son propre fil.
    const thread = (db.chantierOffreMessages || [])
      .filter((m) => m.offerId === id && m.entrepriseUserId === entreprise.userId)
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
      .map(publicMessage);
    return ok({ messages: thread });
  }

  const portalUserId = getVerifiedPortalUserId(request);
  if (portalUserId && portalUserId === offre.userId) {
    // Cote particulier, proprietaire de l'offre : tous les fils.
    const thread = (db.chantierOffreMessages || [])
      .filter((m) => m.offerId === id)
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
      .map(publicMessage);
    return ok({ messages: thread });
  }

  return badRequest("Session expirée. Reconnectez-vous.", 401);
}

const VALID_KINDS = new Set(["text", "rdv_proposal", "rdv_response", "photo_request", "photo_grant"]);

// Valide et normalise les champs specifiques a un message de RDV ; renvoie
// null si la demande est incoherente (kind invalide vus les champs fournis).
function normalizeKindFields(body) {
  const kind = VALID_KINDS.has(body.kind) ? body.kind : "text";
  if (kind === "rdv_proposal") {
    const rdvDate = String(body.rdvDate || "");
    if (!rdvDate) return null;
    return { kind, rdvDate, respondsToId: null, rdvStatus: null };
  }
  if (kind === "rdv_response") {
    const respondsToId = String(body.respondsToId || "");
    const rdvStatus = body.rdvStatus === "accepted" || body.rdvStatus === "declined" ? body.rdvStatus : "";
    if (!respondsToId || !rdvStatus) return null;
    return { kind, rdvDate: null, respondsToId, rdvStatus };
  }
  if (kind === "photo_request" || kind === "photo_grant") {
    return { kind, rdvDate: null, respondsToId: null, rdvStatus: null };
  }
  return { kind: "text", rdvDate: null, respondsToId: null, rdvStatus: null };
}

function defaultMessageText(kindFields) {
  if (kindFields.kind === "rdv_proposal") {
    const formatted = new Date(kindFields.rdvDate).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    return `Proposition de rendez-vous : ${formatted}`;
  }
  if (kindFields.kind === "rdv_response") {
    return kindFields.rdvStatus === "accepted" ? "Rendez-vous confirmé." : "Rendez-vous refusé.";
  }
  if (kindFields.kind === "photo_request") {
    return "Demande d'accès aux photos du chantier.";
  }
  if (kindFields.kind === "photo_grant") {
    return "Photos du chantier débloquées.";
  }
  return "";
}

export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  const kindFields = normalizeKindFields(body);
  if (!kindFields) return badRequest("Demande de rendez-vous incomplète.");
  const message = fixText(body.message || "") || defaultMessageText(kindFields);
  if (!message.trim()) return badRequest("Écrivez un message.");

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  const now = new Date().toISOString();
  const entreprise = await resolveEntreprise(request, body);

  if (entreprise) {
    // Cote entreprise : ouvre ou poursuit son fil avec le particulier.
    const entrepriseSnapshot = await loadEntrepriseSnapshot(entreprise);
    const entry = {
      id: makeToken("radarmsg"),
      offerId: id,
      particulierUserId: offre.userId,
      entrepriseUserId: entreprise.userId,
      entrepriseSnapshot,
      senderType: "entreprise",
      message,
      ...kindFields,
      createdAt: now
    };
    db.chantierOffreMessages.push(entry);

    db.notifications.unshift({
      id: makeToken("notif"),
      userId: offre.userId,
      accountType: "particulier",
      type: "radar.message",
      title: `${entrepriseSnapshot.raisonSociale} vous a contacté`,
      message: message.slice(0, 140),
      offerId: id,
      entrepriseUserId: entreprise.userId,
      entrepriseName: entrepriseSnapshot.raisonSociale,
      entrepriseAddress: entrepriseSnapshot.address,
      entrepriseWebsite: entrepriseSnapshot.website,
      entrepriseIsPro: entrepriseSnapshot.isPro,
      read: false,
      createdAt: now
    });

    addHistory(db, {
      userId: entreprise.userId,
      type: "radar.message_sent",
      label: `Message envoyé pour l'offre Radar des Chantiers : ${offre.description.slice(0, 60)}`,
      entityId: offre.id,
      entityType: "chantier-offre",
      meta: { offerId: offre.id }
    });
    await writeDb(db);
    return ok({ message: publicMessage(entry) }, 201);
  }

  const portalUserId = getVerifiedPortalUserId(request, body);
  if (portalUserId && portalUserId === offre.userId) {
    // Cote particulier : reponse dans un fil deja ouvert par une entreprise.
    const entrepriseUserId = String(body.entrepriseUserId || "");
    const existingThread = (db.chantierOffreMessages || []).find(
      (m) => m.offerId === id && m.entrepriseUserId === entrepriseUserId
    );
    if (!entrepriseUserId || !existingThread) return badRequest("Conversation introuvable.", 404);

    const entry = {
      id: makeToken("radarmsg"),
      offerId: id,
      particulierUserId: offre.userId,
      entrepriseUserId,
      entrepriseSnapshot: existingThread.entrepriseSnapshot || null,
      senderType: "particulier",
      message,
      ...kindFields,
      createdAt: now
    };
    db.chantierOffreMessages.push(entry);
    await writeDb(db);
    return ok({ message: publicMessage(entry) }, 201);
  }

  return badRequest("Session expirée. Reconnectez-vous.", 401);
}
