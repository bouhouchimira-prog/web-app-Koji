import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { distanceKm } from "../../../../lib/geo";
import { fixText } from "../../../../lib/text";

// Cote entreprise (Koji Pro) de Radar des Chantiers : liste des offres
// publiees par des particuliers. Diffusion par zone/metier (cahier des
// charges 3.2/4.3) : si l'entreprise a renseigne une zone de travail
// (adresse + rayon, dans son profil), seules les offres dont l'adresse
// geocodee tombe dans ce rayon ET dont le metier correspond a l'un des
// siens lui sont proposees. Sans zone renseignee (ou offre sans
// coordonnees), comportement inchange : l'offre reste visible — on prefere
// sur-inclure plutot que cacher un chantier legitime sur un detail
// technique. Les coordonnees du particulier (nom/email/telephone) ne sont
// pas exposees ici : voir positionnement + RDV (5.4).
function publicMarketplaceOffer(offer) {
  return {
    id: offer.id,
    photosCount: Array.isArray(offer.photos) ? offer.photos.length : 0,
    description: fixText(offer.description || ""),
    metier: fixText(offer.metier || ""),
    address: fixText(offer.address || ""),
    priceRangeMin: Number(offer.priceRangeMin || 0) || null,
    priceRangeMax: Number(offer.priceRangeMax || 0) || null,
    delaiEstimeJours: offer.delaiEstimeJours || null,
    status: offer.status,
    createdAt: offer.createdAt
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

  const webUser = await loadEntrepriseProfile(entreprise);
  const business = webUser.business || {};
  const zone = Number.isFinite(Number(business.zoneLat)) && Number.isFinite(Number(business.zoneLon))
    ? { lat: Number(business.zoneLat), lon: Number(business.zoneLon), radiusKm: Math.max(1, Number(business.zoneRadiusKm) || 20) }
    : null;
  const professions = Array.isArray(webUser.professions) ? webUser.professions : [];

  const db = await readDb();
  const offres = (db.chantierOffres || [])
    .filter((offre) => offre.status === "Publiee")
    .filter((offre) => matchesZoneAndMetier(offre, zone, professions))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map(publicMarketplaceOffer);

  return ok({ offres });
}
