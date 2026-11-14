import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { distanceKm } from "../../../../lib/geo";
import { fixText } from "../../../../lib/text";
import { maskedCityPostal } from "../../../../lib/offer-privacy";
import { prixRecommandesPour } from "../../../../lib/prix-recommande-server";
import { positionApprochee, zoneDeTravail } from "../../../../lib/radar-position";
import { contexteRadar, decorerOffre } from "../../../../lib/radar-server";

// Cote entreprise (Koji Pro) de Radar des Chantiers : liste des offres
// publiees par des particuliers. Diffusion par zone/metier (cahier des
// charges 3.2/4.3) : si l'entreprise a renseigne une zone de travail
// (adresse + rayon, dans son profil), seules les offres dont l'adresse
// geocodee tombe dans ce rayon ET dont le metier correspond a l'un des
// siens lui sont proposees. Sans zone renseignee (ou offre sans
// coordonnees), comportement inchange : l'offre reste visible — on prefere
// sur-inclure plutot que cacher un chantier legitime sur un detail
// technique. Les coordonnees du particulier (nom/email/telephone/adresse
// exacte) ne sont pas exposees ici, meme principe que le detail (voir
// app/api/marketplace/offres/[id]/route.js) : seule ville + code postal,
// jusqu'au RDV confirme (12 oct, bug remonte par Amira — l'adresse complete
// fuyait ici malgre le commentaire d'origine qui pretendait le contraire).
function publicMarketplaceOffer(offer, prixRecommande = null, radar = {}, zone = null) {
  return {
    ...radar,
    distanceKm: zone && Number.isFinite(offer.lat) && Number.isFinite(offer.lon) ? Math.round(distanceKm(zone.lat, zone.lon, offer.lat, offer.lon) * 10) / 10 : null,
    ouvrages: Array.isArray(offer.ouvrages) ? offer.ouvrages.slice(0, 8) : [],
    id: offer.id,
    photosCount: Array.isArray(offer.photos) ? offer.photos.length : 0,
    description: fixText(offer.description || ""),
    metier: fixText(offer.metier || ""),
    address: maskedCityPostal(offer),
    delaiEstimeJours: offer.delaiEstimeJours || null,
    status: offer.status,
    createdAt: offer.createdAt,
    // Calculé avec la bibliothèque et le taux de CETTE entreprise
    // (lib/prix-recommande.js) ; null quand rien n'a pu être chiffré.
    prixRecommande,
    // Carte du Radar : centre d'une maille de ~2 km, jamais l'adresse
    // géocodée (lib/radar-position.js) ; null sans géocodage.
    position: positionApprochee(offer.lat, offer.lon)
  };
}

function matchesZoneAndMetier(offer, zone, professions) {
  if (professions.length > 0 && offer.metier) {
    const metier = offer.metier.toLowerCase();
    const matchesProfession = professions.some((p) => {
      const prof = String(p || "").toLowerCase();
      return prof && (metier.includes(prof) || prof.includes(metier));
    });
    if (!matchesProfession) return false;
  }

  if (zone && Number.isFinite(offer.lat) && Number.isFinite(offer.lon)) {
    const d = distanceKm(zone.lat, zone.lon, offer.lat, offer.lon);
    if (d > zone.radiusKm) return false;
  }

  return true;
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const maintenant = new Date().toISOString();
  // Jetons, positions et chantiers masqués (maquette PRO-04).
  const ctx = await contexteRadar(db, entreprise, maintenant);
  const webUser = ctx.webUser;
  const business = ctx.business;
  const zone = Number.isFinite(Number(business.zoneLat)) && Number.isFinite(Number(business.zoneLon))
    ? { lat: Number(business.zoneLat), lon: Number(business.zoneLon), radiusKm: Math.max(1, Number(business.zoneRadiusKm) || 20) }
    : null;
  const professions = Array.isArray(webUser.professions) ? webUser.professions : [];

  const mesOffres = new Set(ctx.positions.filter((p) => !p.termine).map((p) => p.pos.offerId));
  const offres = (db.chantierOffres || [])
    .filter((offre) => offre.status === "Publiee" || mesOffres.has(offre.id))
    .filter((offre) => mesOffres.has(offre.id) || matchesZoneAndMetier(offre, zone, professions))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const budgets = new Map();
  const prix = await prixRecommandesPour({ db, userId: entreprise.userId, business, offres, budgets })
    .catch(() => new Map());
  const decorees = offres
    .map((offre) => ({ offre, radar: decorerOffre(db, offre, ctx, budgets.get(offre.id), maintenant) }))
    // Quittent le Radar : chantiers expirés, masqués (« Pas intéressé »),
    // et complets (3 entreprises), sauf ceux où l'entreprise est positionnée.
    .filter(({ offre, radar }) => mesOffres.has(offre.id) || (!radar.expiree && !radar.masque && !radar.places.complet));

  return ok({
    offres: decorees.map(({ offre, radar }) => publicMarketplaceOffer(offre, prix.get(offre.id) || null, radar, zone)),
    // Pour centrer et légender la carte : la zone de travail de l'entreprise.
    zone: zoneDeTravail(business),
    metiers: professions,
    jetons: { ...ctx.solde, prixHt: { start: 15, pro: 10, business: 8 }[ctx.palier] },
    premierUsage: !(db.chantierPositionnements || []).some((p) => p.entrepriseUserId === entreprise.userId)
  });
}

