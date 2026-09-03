import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { fixObjectText, fixText } from "../../../lib/text";

// V1 de Radar des Chantiers (voir cahier des charges) : cote particulier
// uniquement pour l'instant — creer/lister ses propres offres. Pas encore de
// matching entreprise, pas d'IA d'estimation (V2), pas de messagerie ni de
// visites (viendront une fois cette premiere brique validee). Stocke dans le
// blob koji_web_state (db.chantierOffres), pas encore une vraie table
// Supabase — plus simple pour un premier test, migrable plus tard.
// Cote particulier 100% gratuit (decision Bilal) : pas de quota, pas de
// supplement payant.

function publicOffer(offer) {
  return fixObjectText(offer);
}

export async function GET(request) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return ok({ offres: [] });

  const db = await readDb();
  const mine = (db.chantierOffres || [])
    .filter((offre) => offre.userId === userId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return ok({ offres: mine.map(publicOffer) });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const userId = getVerifiedPortalUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const description = fixText(body.description || "");
  const address = fixText(body.address || "");
  if (!description.trim()) return badRequest("Décrivez les travaux à réaliser.");
  if (!address.trim()) return badRequest("L'adresse du chantier est obligatoire.");

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);

  const now = new Date().toISOString();
  const offer = {
    id: `radar-${Date.now()}`,
    userId,
    clientName: fixText(user.name || user.email || "Particulier"),
    clientEmail: user.email || "",
    clientPhone: fixText(user.phone || user.personal?.phone || ""),
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 8) : [],
    description,
    metier: fixText(body.metier || ""),
    address,
    lat: typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null,
    lon: typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null,
    budget: Number(body.budget || 0),
    withSupplies: Boolean(body.withSupplies),
    priceVisible: body.priceVisible !== false,
    status: "Publiee",
    createdAt: now,
    updatedAt: now,
    publishedAt: now
  };

  db.chantierOffres.unshift(offer);
  addHistory(db, {
    userId: "",
    type: "radar.offer_created",
    label: `Offre Radar des Chantiers publiée : ${offer.description.slice(0, 60)}`,
    entityId: offer.id,
    entityType: "chantier-offre",
    meta: { clientUserId: userId, metier: offer.metier, address: offer.address }
  });
  await writeDb(db);

  return ok({ offre: publicOffer(offer) }, 201);
}
