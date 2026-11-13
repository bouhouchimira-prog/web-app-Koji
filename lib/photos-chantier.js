// Photos avant / après (maquette PRO-02.2) : chaque lot commence par une
// photo avant et se termine par une photo après, prises dans l'application.
// Date, heure et auteur sont posés par le serveur à la prise, jamais par
// l'appareil, et ne se modifient pas. Sans photo après, un lot terminé reste
// « photo après manquante » et ne peut pas être clôturé.

export const PHASES = ["avant", "pendant", "apres", "reserve", "levee"];

// Phases des réserves (PRO-02.3) : photo de la réserve, photo de la levée.
export const PHASES_RESERVE = ["reserve", "levee"];

// Les photos des compagnons (app ouvriers, table worker_photos) n'ont qu'une
// légende : « Avant… » / « Après… » donnent la phase, sinon « pendant ».
export function phaseDeLegende(legende) {
  const t = String(legende || "").trim().toLowerCase();
  if (/^avant\b/.test(t)) return "avant";
  if (/^apr[eè]s\b/.test(t)) return "apres";
  return "pendant";
}

// « 14/11 08:02 » en heure de Paris (la prise est enregistrée en UTC).
export function horodatage(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.day}/${v.month} ${v.hour}:${v.minute}`;
}

// État d'un lot : première photo avant, dernière photo après, et ce qui
// manque selon l'avancement de ses ouvrages.
export function photosDuLot(photos, lot, { faites = 0, total = 0 } = {}) {
  const duLot = photos.filter((p) => p.lot === lot).sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)));
  const avant = duLot.find((p) => p.phase === "avant") || null;
  const apres = [...duLot].reverse().find((p) => p.phase === "apres") || null;
  const termine = total > 0 && faites === total;
  let etat = "a_faire";
  if (termine && apres) etat = "termine";
  else if (termine) etat = "apres_manquante";
  else if (avant || faites > 0) etat = "en_cours";
  return { avant, apres, pendant: duLot.filter((p) => p.phase === "pendant"), etat };
}

export const LIBELLE_ETAT_PHOTOS = {
  termine: "terminé",
  apres_manquante: "photo après manquante",
  en_cours: "en cours",
  a_faire: "pas commencé"
};
