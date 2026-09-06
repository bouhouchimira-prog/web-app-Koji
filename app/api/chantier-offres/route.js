import { badRequest, ok } from "../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../lib/db";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { resolveAdminUserId, PRIMARY_ADMIN_EMAIL } from "../../../lib/admin-account";
import { sendExpertiseAlertEmail } from "../../../lib/mailer";
import { fixObjectText, fixText } from "../../../lib/text";

// V1 de Radar des Chantiers : cote particulier — creer/lister ses propres
// offres. Stocke dans le blob koji_web_state (db.chantierOffres), pas
// encore une vraie table Supabase.
// Cote particulier 100% gratuit (decision Bilal) : pas de quota, pas de
// supplement payant.
//
// Decisions du 4 septembre : plus de budget saisi par le client — la
// publication se fait a partir d'une expertise IA deja generee
// (app/api/expertise-koji/route.js), qui fixe une fourchette de prix
// (+/-15%). Cette route ne fait plus QUE relayer/enregistrer cette
// fourchette : elle la RECALCULE elle-meme a partir du devis interne et des
// conseils selectionnes, sans jamais faire confiance a un chiffre envoye
// par le client.
const PRICE_RANGE_SPREAD = 0.15;

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

  const expertiseId = String(body.expertiseId || "");
  const address = fixText(body.address || "");
  if (!expertiseId) return badRequest("Lancez d'abord une expertise avant de publier.");
  if (!address.trim()) return badRequest("L'adresse du chantier est obligatoire.");

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: expertiseRow, error: fetchError } = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", expertiseId)
    .maybeSingle();
  if (fetchError) return badRequest(`Lecture de l'expertise impossible: ${fetchError.message}`, 500);
  const expertise = expertiseRow ? mapQuote(expertiseRow) : null;
  if (!expertise || !expertise.internalOnly) return badRequest("Expertise introuvable.", 404);

  const selectedIds = new Set(Array.isArray(body.conseilsSelectionnes) ? body.conseilsSelectionnes.map(String) : []);
  const allConseils = expertise.expertiseConseils || [];
  const appliedDiscount = allConseils
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + Number(c.discountPercent || 0), 0);
  const adjustedTotal = Math.max(0, expertise.totalTtc * (1 - appliedDiscount / 100));
  const priceRangeMin = Math.round(adjustedTotal * (1 - PRICE_RANGE_SPREAD));
  const priceRangeMax = Math.round(adjustedTotal * (1 + PRICE_RANGE_SPREAD));

  const now = new Date().toISOString();
  const offer = {
    id: `radar-${Date.now()}`,
    userId,
    clientName: fixText(user.name || user.email || "Particulier"),
    clientEmail: user.email || "",
    clientPhone: fixText(user.phone || user.personal?.phone || ""),
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 8) : [],
    description: fixText(body.description || expertise.workDescription || ""),
    metier: fixText(body.metier || ""),
    address,
    city: fixText(body.city || ""),
    postalCode: fixText(body.postalCode || ""),
    lat: typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null,
    lon: typeof body.lon === "number" && Number.isFinite(body.lon) ? body.lon : null,
    priceRangeMin,
    priceRangeMax,
    delaiEstimeJours: expertise.expertiseDelaiJours || null,
    conseilsSelectionnes: allConseils.filter((c) => selectedIds.has(c.id)),
    expertiseId,
    priceVisible: true,
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
    meta: { clientUserId: userId, metier: offer.metier, address: offer.address, priceRangeMin, priceRangeMax }
  });

  const adminUserId = await resolveAdminUserId();
  if (adminUserId) {
    db.notifications.unshift({
      id: makeToken("notif"),
      userId: adminUserId,
      accountType: "entreprise",
      type: "radar.expertise_publiee",
      title: "Nouvelle expertise Radar des Chantiers publiée",
      message: `${offer.description.slice(0, 100)} — ${priceRangeMin}€ à ${priceRangeMax}€`,
      offerId: offer.id,
      quoteId: expertiseId,
      read: false,
      createdAt: now
    });
  }

  await writeDb(db);

  // Relie le devis interne a l'offre maintenant qu'elle existe (pour le
  // retrouver depuis /devis, et pour app/api/estimer-devis/route.js qui en
  // copiera le contenu pour chaque entreprise qui se positionne).
  await supabaseAdmin
    .from("quotes")
    .update({ web_extras: { ...(expertiseRow.web_extras || {}), chantierOffreId: offer.id } })
    .eq("id", expertiseId);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  sendExpertiseAlertEmail({
    to: PRIMARY_ADMIN_EMAIL,
    offreId: offer.id,
    expertiseId,
    priceRangeMin,
    priceRangeMax,
    description: offer.description,
    devisUrl: `${appUrl}/devis?id=${expertiseId}`
  }).catch(() => {});

  return ok({ offre: publicOffer(offer) }, 201);
}
