// Mon parcours v2 (PRO-26 / 26.1) côté serveur : rassemble les données du
// compte (et seulement les siennes) pour lib/parcours-grade.js. Aucune
// écriture de jetons ici ; les jetons du « Premier mois » restent gérés
// par /api/parcours.
import { chargerChantiers } from "./depenses-serveur";
import { fetchUserOuvrages } from "./koji-ouvrages";
import { offreKojiPage } from "./kojipage";
import { etatParcours, plaqueParticulier } from "./parcours-grade";
import { lireTalents } from "./parcours-talents";

export function prefsParcours(db, userId) {
  const p = (db.parcoursPrefs || {})[userId];
  return p && typeof p === "object" ? p : {};
}

export function ecrirePrefsParcours(db, userId, prefs) {
  if (!db.parcoursPrefs || typeof db.parcoursPrefs !== "object" || Array.isArray(db.parcoursPrefs)) db.parcoursPrefs = {};
  db.parcoursPrefs[userId] = { ...prefsParcours(db, userId), ...prefs, majLe: new Date().toISOString() };
}

// Données du compte : devis (Supabase), PV, avis, positions Radar, photos,
// équipe, factures, bibliothèque, date d'inscription.
export function donneesDuCompte(db, userId, { quotes = [], ouvrages = 0, inscritLe = "", avecAvis = true } = {}) {
  const mes = (liste) => (liste || []).filter((x) => x.userId === userId);
  const workers = mes(db.workers);
  const ids = new Set(workers.map((w) => w.id));
  return {
    quotes,
    clotures: mes(db.clotures),
    avis: mes(db.avis),
    positions: (db.chantierPositionnements || []).filter((p) => p.entrepriseUserId === userId),
    offres: db.chantierOffres || [],
    photos: mes(db.chantierPhotos),
    workers,
    attendance: (db.attendanceEntries || []).filter((e) => ids.has(e.workerId)),
    invoices: mes(db.invoices),
    ouvrages,
    inscritLe,
    avecAvis
  };
}

async function devisDe(entreprise) {
  try {
    return (await chargerChantiers(entreprise, { archives: true })).quotes;
  } catch {
    return [];
  }
}

// Données de l'entreprise connectée (session vérifiée par l'appelant).
export async function donneesEntreprise(db, entreprise, webUser) {
  const userId = entreprise.userId;
  const [quotes, ouvragesKoji] = await Promise.all([devisDe(entreprise), fetchUserOuvrages(userId)]);
  const ouvrages = (db.ouvrages || []).filter((o) => o.userId === userId).length + ouvragesKoji.length;
  return donneesDuCompte(db, userId, { quotes, ouvrages, inscritLe: webUser.createdAt || "", avecAvis: offreKojiPage(webUser).avis });
}

export async function etatParcoursEntreprise(db, entreprise, webUser, { maintenant = new Date().toISOString() } = {}) {
  return etatParcours(await donneesEntreprise(db, entreprise, webUser), prefsParcours(db, entreprise.userId), maintenant);
}

// Plaque de la KojiPage publique : seulement si le talent « Plaque de
// chantier » est en vigueur. Ne renvoie ni niveau, ni points, ni talents.
export async function plaquePublique(db, userId, { supabase, webUser, avecAvis = true, maintenant = new Date().toISOString() } = {}) {
  const prefs = prefsParcours(db, userId);
  const brut = prefs.talents || {};
  // Lecture rapide : pas de point en Vitrine, pas de plaque (le niveau
  // n'est calculé que si besoin).
  if (!(Number(brut.vitrine) >= 1 || Number(brut.aVenir?.vitrine) >= 1)) return null;
  const quotes = await devisDe({ supabase, userId });
  const donnees = donneesDuCompte(db, userId, { quotes, inscritLe: webUser?.createdAt || "", avecAvis });
  const etat = etatParcours(donnees, prefs, maintenant);
  if (!lireTalents(brut, { points: etat.niveau.niveau, maintenant }).vitrine) return null;
  const plaque = plaqueParticulier({ niveau: etat.niveau, preuves: etat.preuves, faits: etat.hautsFaits, distinctions: prefs.distinctions, avecAvis });
  return plaque.grade || plaque.preuves.length || plaque.distinctions.length ? plaque : null;
}
