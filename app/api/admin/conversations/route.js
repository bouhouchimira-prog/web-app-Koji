import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { resolveAdminUserId } from "../../../../lib/admin-account";
import { readDb } from "../../../../lib/db";

// Vue admin des conversations enregistrees (2 oct, demande d'Amira : garder
// une trace "en cas ou on rencontre un probleme", consultable dans les
// details de chaque client). Reunit deux sources distinctes, deja stockees
// separement : db.radarConversations (particuliers, Radar des Chantiers,
// voir app/api/radar-assistant/log/route.js, ajoute le 2 oct) et
// db.kojiAssistantMessages (entreprises, assistant koji du dashboard, deja
// enregistre depuis le 15 septembre — aucun changement necessaire la,
// juste une lecture groupee par client ici).
export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const adminUserId = await resolveAdminUserId();
  if (!adminUserId || auth.userId !== adminUserId) return badRequest("Accès réservé à l'administrateur.", 403);

  const db = await readDb();

  // Particuliers (Radar des Chantiers) — comptes vivant dans db.users, pas
  // Supabase Auth (voir lib/portal-session.js).
  const radarByUser = new Map();
  for (const conv of db.radarConversations || []) {
    if (!radarByUser.has(conv.userId)) radarByUser.set(conv.userId, []);
    radarByUser.get(conv.userId).push({
      id: conv.id,
      metier: conv.metier || "",
      chantierOffreId: conv.chantierOffreId || null,
      turns: conv.turns || [],
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt
    });
  }
  const radarClients = Array.from(radarByUser.entries()).map(([userId, conversations]) => {
    const user = (db.users || []).find((u) => u.id === userId);
    conversations.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return {
      userId,
      name: user?.name || user?.business?.raisonSociale || "Client inconnu",
      email: user?.email || "",
      conversations
    };
  }).sort((a, b) => String(b.conversations[0]?.updatedAt || "").localeCompare(String(a.conversations[0]?.updatedAt || "")));

  // Entreprises (assistant koji, dashboard) — comptes Supabase Auth.
  const artisanByUser = new Map();
  for (const entry of db.kojiAssistantMessages || []) {
    if (!artisanByUser.has(entry.userId)) artisanByUser.set(entry.userId, new Map());
    const convs = artisanByUser.get(entry.userId);
    const convId = entry.conversationId || "legacy";
    if (!convs.has(convId)) convs.set(convId, []);
    convs.get(convId).push({ role: entry.role, message: entry.message, createdAt: entry.createdAt });
  }
  const artisanUserIds = Array.from(artisanByUser.keys());
  let profilesByUserId = new Map();
  if (artisanUserIds.length > 0) {
    const { data: profiles } = await auth.supabase.from("users").select("id, email, business_info").in("id", artisanUserIds);
    profilesByUserId = new Map((profiles || []).map((p) => [p.id, p]));
  }
  const artisanConversations = artisanUserIds.map((userId) => {
    const profile = profilesByUserId.get(userId);
    const conversations = Array.from(artisanByUser.get(userId).entries()).map(([conversationId, messages]) => ({
      id: conversationId,
      messages: messages.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))),
      updatedAt: messages[messages.length - 1]?.createdAt || ""
    })).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return {
      userId,
      name: profile?.business_info?.raisonSociale || profile?.email || "Entreprise inconnue",
      email: profile?.email || "",
      conversations
    };
  }).sort((a, b) => String(b.conversations[0]?.updatedAt || "").localeCompare(String(a.conversations[0]?.updatedAt || "")));

  return ok({ radarClients, artisanConversations });
}
