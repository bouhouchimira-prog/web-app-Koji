import { badRequest, ok } from "../../../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../../../lib/db";
import { getAccessToken, getVerifiedUserId } from "../../../../../../lib/server-auth";
import { getSupabaseForToken } from "../../../../../../lib/supabase";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { buildWebUser } from "../../../../../../lib/user-profile";
import { isTrialUser } from "../../../../../../lib/plan";
import { fixText } from "../../../../../../lib/text";

// Messagerie interne Radar des Chantiers (module 4.5 du cahier des charges)
// — un fil par (offre, entreprise). Cote entreprise : un seul fil, le sien.
// Cote particulier (proprietaire de l'offre) : tous les fils, un par
// entreprise qui a ecrit, regroupes cote client dans l'UI.
function publicMessage(message) {
  return {
    id: message.id,
    senderType: message.senderType,
    entrepriseUserId: message.entrepriseUserId,
    entrepriseSnapshot: message.entrepriseSnapshot || null,
    message: message.message,
    createdAt: message.createdAt
  };
}

// getVerifiedUserId checks the token's signature against Supabase Auth
// itself (unlike getAuth's plain decode) — the right check to gate access on
// here, since a forged token must not be able to read another company's
// message threads. The RLS-scoped client is only needed afterward, to read
// this now-verified caller's own business_info for the snapshot.
async function resolveEntreprise(request, body = null) {
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return null;
  const token = getAccessToken(request, body);
  return { userId, supabase: getSupabaseForToken(token) };
}

async function loadEntrepriseSnapshot(entreprise) {
  const { data: profile } = await entreprise.supabase
    .from("users")
    .select("*")
    .eq("id", entreprise.userId)
    .maybeSingle();
  const webUser = buildWebUser({ id: entreprise.userId, email: profile?.email || "", profile });
  return {
    raisonSociale: webUser.business?.raisonSociale || webUser.name || "Une entreprise",
    address: webUser.business?.address || "",
    phone: webUser.business?.phone || "",
    website: webUser.business?.website || "",
    isPro: Boolean(webUser.isAdmin) || !isTrialUser(webUser)
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

export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  const message = fixText(body.message || "");
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
      createdAt: now
    };
    db.chantierOffreMessages.push(entry);
    await writeDb(db);
    return ok({ message: publicMessage(entry) }, 201);
  }

  return badRequest("Session expirée. Reconnectez-vous.", 401);
}
