// Lancer le chantier (maquette PRO-02.1) : Koji propose le planning à partir
// des lots du devis et des durées de la bibliothèque (temps unitaire ×
// quantité, déjà calculé sur chaque ligne du devis), enchaînés dans l'ordre
// des lots, en jours ouvrés (samedi, dimanche et jours fériés exclus).
// Tout reste modifiable avant de créer le chantier.

const JOUR = 86400000;

function iso(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dateUTC(texte) {
  const [a, m, j] = String(texte).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, (m || 1) - 1, j || 1));
}

// Dimanche de Pâques (algorithme de Meeus / Butcher).
function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

// Jours fériés en métropole (Alsace-Moselle non comprise).
export function joursFeries(annee) {
  const p = paques(annee).getTime();
  const fixes = ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"].map((md) => `${annee}-${md}`);
  const mobiles = [1, 39, 50].map((n) => iso(new Date(p + n * JOUR))); // lundi de Pâques, Ascension, lundi de Pentecôte
  return new Set([...fixes, ...mobiles]);
}

export function estOuvre(texte) {
  const d = dateUTC(texte);
  const jour = d.getUTCDay();
  if (jour === 0 || jour === 6) return false;
  return !joursFeries(d.getUTCFullYear()).has(iso(d));
}

// Premier jour ouvré à partir de cette date (incluse).
export function premierOuvre(texte) {
  let d = dateUTC(texte);
  while (!estOuvre(iso(d))) d = new Date(d.getTime() + JOUR);
  return iso(d);
}

// Date de fin quand on travaille `jours` jours ouvrés à partir de `debut`.
export function finApres(debut, jours) {
  let d = dateUTC(premierOuvre(debut));
  let restants = Math.max(1, Math.round(jours)) - 1;
  while (restants > 0) {
    d = new Date(d.getTime() + JOUR);
    if (estOuvre(iso(d))) restants -= 1;
  }
  return iso(d);
}

export function lendemainOuvre(texte) {
  return premierOuvre(iso(new Date(dateUTC(texte).getTime() + JOUR)));
}

export function joursOuvresEntre(debut, fin) {
  if (!debut || !fin || fin < debut) return 0;
  let n = 0;
  for (let d = dateUTC(debut); iso(d) <= fin; d = new Date(d.getTime() + JOUR)) if (estOuvre(iso(d))) n += 1;
  return n;
}

// Heures d'une ligne de devis : temps corrigé, sinon temps total, sinon
// temps unitaire × quantité ; sous-lignes comprises.
export function heuresLigne(ligne) {
  const directes = Number(ligne.correctedTimeHours || ligne.totalTimeHours || 0)
    || Number(ligne.normativeTime || 0) * Number(ligne.quantity || 0);
  const sous = Array.isArray(ligne.subItems) ? ligne.subItems.reduce((n, s) => n + heuresLigne(s), 0) : 0;
  return Math.max(0, directes) + (directes ? 0 : sous);
}

// Même clé que la fiche chantier (app/chantiers/page.jsx::quoteItemId).
export function cleLigne(ligne, index) {
  return `${ligne.roomId || ligne.room || "chantier"}-${ligne.taskId || ligne.code || index}`;
}

// Lots du devis dans l'ordre où ils apparaissent.
export function lotsDuDevis(devis) {
  const lots = [];
  (Array.isArray(devis?.items) ? devis.items : []).forEach((ligne, index) => {
    const nom = String(ligne.room || "Chantier").trim() || "Chantier";
    let lot = lots.find((l) => l.nom === nom);
    if (!lot) {
      lot = { nom, lignes: [], heures: 0, montantHt: 0 };
      lots.push(lot);
    }
    const heures = heuresLigne(ligne);
    lot.lignes.push({ cle: cleLigne(ligne, index), ligne, heures });
    lot.heures += heures;
    lot.montantHt += Number(ligne.totalHt || 0);
  });
  return lots.map((l) => ({ ...l, heures: Math.round(l.heures * 100) / 100, montantHt: Math.round(l.montantHt * 100) / 100 }));
}

// Planning proposé : chaque lot dure ses heures / heures par jour (au moins
// un jour), le suivant commence le jour ouvré d'après.
export function proposerPlanning(devis, { debut, heuresParJour = 7, durees = {} } = {}) {
  const lots = lotsDuDevis(devis);
  let curseur = premierOuvre(debut);
  const planifies = lots.map((lot, i) => {
    const jours = Math.max(1, Number(durees[lot.nom]) || Math.ceil(lot.heures / Math.max(1, heuresParJour)) || 1);
    const debutLot = i === 0 ? curseur : lendemainOuvre(curseur);
    const finLot = finApres(debutLot, jours);
    curseur = finLot;
    return { ...lot, numero: String(i + 1).padStart(2, "0"), jours, debut: debutLot, fin: finLot };
  });
  const fin = planifies.at(-1)?.fin || premierOuvre(debut);
  return { debut: premierOuvre(debut), fin, joursOuvres: joursOuvresEntre(premierOuvre(debut), fin), lots: planifies };
}

// Jour ouvré proposé pour démarrer : dans `delai` jours ouvrés.
export function demarragePropose(aujourdhui, delai = 3) {
  let d = aujourdhui;
  for (let i = 0; i < delai; i += 1) d = lendemainOuvre(d);
  return d;
}
