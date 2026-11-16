import { badRequest, ok } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { getVerifiedUserId } from "../../../../../lib/server-auth";
import { hasConfirmedRdv } from "../../../../../lib/rdv";
import { hasPhotoAccess } from "../../../../../lib/photo-access";
import { fixText } from "../../../../../lib/text";
import { clientContactFields } from "../../../../../lib/offer-privacy";
import { getSupabaseAdmin } from "../../../../../lib/supabase";
import { buildWebUser } from "../../../../../lib/user-profile";
import { prixRecommandesPour } from "../../../../../lib/prix-recommande-server";
import { resolveEntreprise } from "../../../../../lib/entreprise-auth";
import { contexteRadar, decorerOffre } from "../../../../../lib/radar-server";
import { creneauxProposes, messagePositionnement, PRIX_JETON_HT, RAISONS_PAS_INTERESSE } from "../../../../../lib/radar-jetons";
import { listeAVerifier } from "../../../../../lib/visite-mode";
import { villeSeule } from "../../../../../lib/radar-display";
import { distanceKm } from "../../../../../lib/geo";

// Detail cote entreprise (Koji Pro) d'une offre Radar des Chantiers.
// Regle unique (decisions du 4 septembre) : aucune coordonnee visible
// (adresse exacte, email, telephone), dans les deux sens, tant que le RDV
// n'est pas confirme — l'echange passe par la messagerie interne. Les
// photos suivent une regle independante : masquees par defaut, debloquees
// par le particulier entreprise par entreprise (lib/photo-access.js).
// clientContactFields (lib/offer-privacy.js, 23 oct) centralise la partie
// coordonnees/adresse, reutilisee telle quelle par
// app/api/marketplace/mes-chantiers/route.js — jamais reecrite 2 fois.
function detailOffer(offer, rdvUnlocked, photosUnlocked) {
  return {
    id: offer.id,
    photos: photosUnlocked ? (Array.isArray(offer.photos) ? offer.photos : []) : [],
    photosCount: Array.isArray(offer.photos) ? offer.photos.length : 0,
    photosUnlocked,
    description: fixText(offer.description || ""),
    ouvrages: Array.isArray(offer.ouvrages) ? offer.ouvrages : [],
    metier: fixText(offer.metier || ""),
    delaiEstimeJours: offer.delaiEstimeJours || null,
    status: offer.status,
    createdAt: offer.createdAt,
    rdvConfirmed: rdvUnlocked,
    ...clientContactFields(offer, rdvUnlocked)
  };
}

export async function GET(request, context) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Offre introuvable.", 404);

  const rdvUnlocked = hasConfirmedRdv(db.chantierOffreMessages, id, userId);
  const photosUnlocked = hasPhotoAccess(db.chantierOffreMessages, id, userId);
  // Prix recommandé avec les prix de l'entreprise qui consulte (jamais
  // envoyé au particulier, voir lib/prix-recommande.js).
  let prixRecommande = null;
  const budgets = new Map();
  let webUser = null;
  try {
    const { data: profile } = await getSupabaseAdmin().from("users").select("*").eq("id", userId).maybeSingle();
    webUser = buildWebUser({ id: userId, email: profile?.email || "", profile });
    const prix = await prixRecommandesPour({ db, userId, business: webUser.business || {}, offres: [offre], budgets });
    prixRecommande = prix.get(offre.id) || null;
  } catch { /* le détail s'affiche sans prix */ }

  // Fiche du Radar (maquette PRO-04) : jetons, places, position, et pour se
  // positionner un message et des créneaux tirés du calendrier.
  let radar = {};
  try {
    const entreprise = await resolveEntreprise(request);
    const maintenant = new Date().toISOString();
    const ctx = await contexteRadar(db, entreprise, maintenant);
    const { data: evenements } = await getSupabaseAdmin().from("calendar_events").select("start_at,end_at").eq("user_id", userId).gte("start_at", maintenant);
    const business = ctx.business;
    const zone = Number.isFinite(Number(business.zoneLat)) && Number.isFinite(Number(business.zoneLon))
      ? { lat: Number(business.zoneLat), lon: Number(business.zoneLon), radiusKm: Math.max(1, Number(business.zoneRadiusKm) || 20) }
      : null;
    const distance = zone && Number.isFinite(offre.lat) && Number.isFinite(offre.lon) ? Math.round(distanceKm(zone.lat, zone.lon, offre.lat, offre.lon) * 10) / 10 : null;
    const metier = String(offre.metier || "").toLowerCase();
    const metierCorrespond = (ctx.webUser.professions || []).find((p) => metier && String(p || "").toLowerCase() && (metier.includes(String(p).toLowerCase()) || String(p).toLowerCase().includes(metier))) || "";
    radar = {
      distanceKm: distance,
      dansZone: Boolean(zone && distance != null && distance <= zone.radiusKm),
      metierCorrespond,
      publieLe: offre.publishedAt || offre.createdAt,
      ...decorerOffre(db, offre, ctx, budgets.get(offre.id), maintenant),
      solde: { ...ctx.solde, prixHt: PRIX_JETON_HT[ctx.palier] },
      creneaux: creneauxProposes((evenements || []).map((e) => ({ startAt: e.start_at, endAt: e.end_at })), maintenant),
      messagePropose: messagePositionnement({
        prenom: String(business.firstName || business.prenom || webUser?.name || "").split(" ")[0],
        entreprise: business.raisonSociale || "",
        metier: offre.metier || "",
        ville: villeSeule([offre.postalCode, offre.city].filter(Boolean).join(" "))
      }),
      aVerifier: listeAVerifier([offre.description, ...(offre.ouvrages || []).flatMap((o) => [o.room, ...(o.postes || [])])].join(" ")).map((p) => p.libelle),
      raisonsPasInteresse: RAISONS_PAS_INTERESSE
    };
  } catch { /* la fiche s'affiche sans les jetons */ }
  return ok({ offre: { ...detailOffer(offre, rdvUnlocked, photosUnlocked), prixRecommande, ...radar } });
}
