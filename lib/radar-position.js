// Position d'un chantier sur la carte du Radar (maquette PRO-01). Le
// particulier ne donne son adresse exacte qu'à l'acceptation d'un devis
// (maquette CLI) : la carte ne reçoit que le centre d'une maille d'environ
// 2 km (0,02° : 2,2 km nord-sud, 1,5 km est-ouest en France), jamais les
// coordonnées géocodées de l'adresse.
export const MAILLE_DEGRES = 0.02;

function centreDeMaille(valeur, pas) {
  return Math.round((Math.floor(valeur / pas) + 0.5) * pas * 1e4) / 1e4;
}

export function positionApprochee(lat, lon, pas = MAILLE_DEGRES) {
  if (lat === null || lat === undefined || lat === "" || lon === null || lon === undefined || lon === "") return null;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: centreDeMaille(la, pas), lon: centreDeMaille(lo, pas) };
}

// « 12 rue Caulaincourt, 75018 Paris » → « Paris » ; « Saint-Ouen » → idem.
export function villeDeZone(adresse) {
  const texte = String(adresse || "").trim();
  if (!texte) return "";
  const cp = texte.match(/\b\d{5}\s+([^,]+)/);
  if (cp) return cp[1].trim();
  const parties = texte.split(",").map((p) => p.trim()).filter(Boolean);
  return (parties[parties.length - 1] || "").replace(/^\d{5}\s*/, "");
}

// Zone de travail de l'entreprise (profil › zone d'intervention), pour
// centrer la carte et la légender : « Paris et 20 km autour ». Ce sont les
// données de l'entreprise elle-même, renvoyées à elle seule.
export function zoneDeTravail(business = {}) {
  const lat = Number(business.zoneLat);
  const lon = Number(business.zoneLon);
  if (business.zoneLat === null || business.zoneLat === undefined || business.zoneLat === "") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    radiusKm: Math.max(1, Number(business.zoneRadiusKm) || 20),
    ville: villeDeZone(business.zoneAddress || business.city || "")
  };
}
