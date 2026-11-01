import { distanceKm } from "./geo.js";

// Réseau pro (PRO-14) : besoins de sous-traitance et annuaire entre
// entreprises Koji. Les coordonnées de zone ne quittent jamais le serveur :
// seule la distance calculée est renvoyée au navigateur.

export const KBIS_MAX_AGE_DAYS = 90;
export const TEXT_MAX = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Dates déclarées par l'entreprise (Kbis de moins de 3 mois, attestation
// URSSAF et décennale en cours de validité). Pas de vérification des pièces
// par Koji pour l'instant : l'écran le dit.
export function documentsStatus(profil, now = new Date()) {
  const today = dayStart(now.toISOString());
  const kbis = dayStart(profil?.kbisDate);
  const urssaf = dayStart(profil?.urssafUntil);
  const decennale = dayStart(profil?.decennaleUntil);
  const items = {
    kbis: !kbis ? "missing" : (today - kbis) / DAY_MS > KBIS_MAX_AGE_DAYS ? "expired" : "ok",
    urssaf: !urssaf ? "missing" : urssaf < today ? "expired" : "ok",
    decennale: !decennale ? "missing" : decennale < today ? "expired" : "ok"
  };
  const values = Object.values(items);
  return {
    items,
    ok: values.every((value) => value === "ok"),
    expired: values.includes("expired")
  };
}

export function initials(name) {
  const words = String(name || "").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "?").toUpperCase();
}

export function distanceBetween(a, b) {
  const usable = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(usable)) return null;
  return Math.round(distanceKm(Number(a.lat), Number(a.lon), Number(b.lat), Number(b.lon)) * 10) / 10;
}

export function cleanText(value, max = TEXT_MAX) {
  return String(value || "").trim().slice(0, max);
}

export function daysBetween(start, end) {
  const a = dayStart(start);
  const b = dayStart(end) || a;
  if (!a) return 0;
  return Math.max(1, Math.round((b - a) / DAY_MS) + 1);
}

// Ce qu'une autre entreprise voit d'un profil : jamais e-mail, téléphone,
// identifiant de compte ni coordonnées.
export function publicProfil(profil, viewerZone) {
  const docs = documentsStatus(profil);
  return {
    id: profil.id,
    companyName: profil.companyName,
    initials: initials(profil.companyName),
    metiers: profil.metiers || [],
    zone: profil.zone || "",
    availableFrom: profil.availableFrom || "",
    availabilityNote: profil.availabilityNote || "",
    documentsOk: docs.ok,
    distanceKm: distanceBetween(viewerZone, profil.coords)
  };
}
