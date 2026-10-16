import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { fixObjectText } from "../../../../lib/text";

// Boite de reception unifiee cote particulier (16 oct, maquette Artifact) —
// les conversations existent deja en vrai par offre (db.chantierOffreMessages,
// voir app/api/marketplace/offres/[id]/messages/route.js) mais n'etaient
// visibles qu'en ouvrant chaque offre une par une (app/client/radar/[id]).
// Cette route se contente de regrouper ce qui existe deja par (offre,
// entreprise), sans nouveau stockage.
function publicMessage(message) {
  return {
    id: message.id,
    offerId: message.offerId,
    senderType: message.senderType,
    message: message.message,
    kind: message.kind || "text",
    rdvDate: message.rdvDate || null,
    respondsToId: message.respondsToId || null,
    rdvStatus: message.rdvStatus || null,
    createdAt: message.createdAt
  };
}

export async function GET(request) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return ok({ conversations: [] });

  const db = await readDb();
  const myOfferIds = new Set((db.chantierOffres || []).filter((o) => o.userId === userId).map((o) => o.id));
  const offresById = new Map((db.chantierOffres || []).map((o) => [o.id, o]));

  const byKey = new Map();
  for (const m of db.chantierOffreMessages || []) {
    if (!myOfferIds.has(m.offerId)) continue;
    const key = `${m.offerId}:${m.entrepriseUserId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        offerId: m.offerId,
        entrepriseUserId: m.entrepriseUserId,
        entrepriseSnapshot: m.entrepriseSnapshot || null,
        offre: fixObjectText({
          description: offresById.get(m.offerId)?.description || "",
          address: offresById.get(m.offerId)?.address || "",
          status: offresById.get(m.offerId)?.status || ""
        }),
        messages: []
      });
    }
    const conv = byKey.get(key);
    conv.messages.push(publicMessage(m));
    if (m.entrepriseSnapshot) conv.entrepriseSnapshot = m.entrepriseSnapshot;
  }

  const unreadOfferEntreprisePairs = new Set(
    (db.notifications || [])
      .filter((n) => n.userId === userId && n.type === "radar.message" && !n.read)
      .map((n) => `${n.offerId}:${n.entrepriseUserId}`)
  );

  const conversations = Array.from(byKey.values())
    .map((conv) => ({
      ...conv,
      messages: conv.messages.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))),
      unread: unreadOfferEntreprisePairs.has(`${conv.offerId}:${conv.entrepriseUserId}`)
    }))
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.createdAt || "";
      const bLast = b.messages[b.messages.length - 1]?.createdAt || "";
      return bLast.localeCompare(aLast);
    });

  return ok({ conversations });
}
