// Distance a vol d'oiseau entre deux points (formule de Haversine), en km.
// Utilise pour le matching zone de travail entreprise <-> adresse du chantier
// (cahier des charges 3.2/4.3), en l'absence de PostGIS sur le stockage
// actuel (blob koji_web_state).
export function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
