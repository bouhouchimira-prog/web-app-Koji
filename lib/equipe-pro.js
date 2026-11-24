// Équipe Koji Pro (maquettes PRO-16 à 16.5) : qui est où aujourd'hui, heures
// de la semaine, fiche compagnon, rôles, documents, ce que les heures
// apprennent aux devis. Règles pures, partagées avec l'app
// (mobile/lib/features/equipe), testées dans tests/unit/equipe-pro.test.js.

const j10 = (v) => String(v || "").slice(0, 10);
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export function jourLong(jour) { return JOURS_LONGS[new Date(`${j10(jour)}T12:00:00Z`).getUTCDay()]; }

export const ROLES = {
  compagnon: { label: "Compagnon", detail: "sa journée, ses tâches, pointer, envoyer des photos · aucun prix" },
  chef: { label: "Chef de chantier", detail: "en plus : le planning et les chantiers qu'il suit" },
  dirigeant: { label: "Dirigeant", detail: "tout, y compris prix, factures et comptabilité" }
};
export function roleDe(worker = {}) {
  return ROLES[worker.roleEquipe] ? worker.roleEquipe : "compagnon";
}

// Heure et date de Paris.
export function paris(iso = new Date().toISOString()) {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const g = (t) => f.find((x) => x.type === t)?.value || "00";
  return { jour: `${g("year")}-${g("month")}-${g("day")}`, heure: `${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}` };
}
const minutesDe = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export function ajouterJours(jour, n) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function lundiDe(jour) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  return ajouterJours(jour, -((d.getUTCDay() + 6) % 7));
}
export function numeroSemaine(jour) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  const jeudi = new Date(d);
  jeudi.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const debut = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((jeudi - debut) / 86400000 - 3 + ((debut.getUTCDay() + 6) % 7)) / 7);
}
export function jourCourt(jour) {
  const d = new Date(`${j10(jour)}T12:00:00Z`);
  return `${JOURS_COURTS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

// « 8 h », « 7,5 h », « 38,5 h » (tableau) ; « 6 h 12 » (durée en cours).
export function heuresDecimales(minutes = 0) {
  const h = Math.round((Number(minutes) || 0) / 6) / 10;
  return `${String(h).replace(".", ",")} h`;
}
export function heuresMinutes(minutes = 0) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

// « 07:32 » → « 7 h 32 » ; « 16:00 » → « 16 h ».
export const heureCourte = (hhmm = "") => String(hhmm).replace(/^0(?=\d)/, "").replace(":", " h ").replace(/ h 00$/, " h");

// Durée d'un pointage ; un pointage encore ouvert compte jusqu'à maintenant
// le jour même, et rien les jours passés (case douteuse).
export function dureePointage(e = {}, maintenant = new Date().toISOString()) {
  if (e.endTime) return Math.max(0, Number(e.durationMinutes) || ((minutesDe(e.endTime) ?? 0) - (minutesDe(e.startTime) ?? 0)));
  const p = paris(maintenant);
  if (e.date === p.jour && e.startTime) return Math.max(0, (minutesDe(p.heure) ?? 0) - (minutesDe(e.startTime) ?? 0));
  return 0;
}

// Congés et absences déclarés (worker.conges [{du, au, motif}]).
export function enConge(worker = {}, jour) {
  return (worker.conges || []).some((c) => c.du && j10(jour) >= j10(c.du) && j10(jour) <= j10(c.au || c.du));
}

// Qui est où aujourd'hui.
export function etatDuJour(worker = {}, { entries = [], taches = [], jour, maintenant = new Date().toISOString(), titres = new Map() } = {}) {
  const auj = jour || paris(maintenant).jour;
  const mes = entries.filter((e) => e.workerId === worker.id && e.date === auj).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  const tache = taches.find((t) => (t.workerIds || []).includes(worker.id) && !t.done && j10(t.startDate || t.dueDate) <= auj && j10(t.endDate || t.dueDate || t.startDate) >= auj);
  const chantier = tache ? titres.get(tache.projectId) || tache.project || "" : "";
  if (enConge(worker, auj)) return { statut: "conge", texte: "congé", chantier: "" };
  if (!mes.length) return { statut: "pas_arrive", texte: "pas encore arrivé", chantier, projectId: tache?.projectId || "" };
  const ouvert = mes.find((e) => !e.endTime);
  const arrivee = heureCourte(mes[0].startTime);
  if (ouvert) return { statut: "arrive", texte: `arrivé ${arrivee}`, chantier, projectId: tache?.projectId || "", minutes: mes.reduce((n, e) => n + dureePointage(e, maintenant), 0) };
  return { statut: "parti", texte: `parti à ${heureCourte(mes[mes.length - 1].endTime)}`, chantier, projectId: tache?.projectId || "", minutes: mes.reduce((n, e) => n + dureePointage(e, maintenant), 0) };
}

// Feuille de la semaine : une ligne par compagnon, une case par jour ouvré.
export function grilleSemaine(workers = [], entries = [], lundi, { maintenant = new Date().toISOString(), jours = 5 } = {}) {
  const auj = paris(maintenant).jour;
  const dates = Array.from({ length: jours }, (_, i) => ajouterJours(lundi, i));
  const lignes = workers.map((w) => {
    const cases = dates.map((date) => {
      const mes = entries.filter((e) => e.workerId === w.id && e.date === date);
      if (enConge(w, date)) return { date, statut: "conge", minutes: 0 };
      if (!mes.length) return { date, statut: date < auj ? "manquant" : "a_venir", minutes: 0 };
      const ouvert = mes.find((e) => !e.endTime);
      const corrige = mes.some((e) => e.source === "corrige");
      if (ouvert && date < auj) return { date, statut: "douteux", minutes: mes.reduce((n, e) => n + dureePointage(e, maintenant), 0), entryId: ouvert.id };
      return { date, statut: corrige ? "corrige" : ouvert ? "en_cours" : "ok", minutes: mes.reduce((n, e) => n + dureePointage(e, maintenant), 0), entryId: mes[0].id };
    });
    // Proposition pour une case douteuse : la durée habituelle des autres jours.
    const autres = cases.filter((c) => c.statut === "ok" || c.statut === "corrige").map((c) => c.minutes).sort((a, b) => a - b);
    const habituel = autres.length ? autres[Math.floor(autres.length / 2)] : 0;
    for (const c of cases) if (c.statut === "douteux" && habituel) { c.proposition = habituel; c.minutes = habituel; }
    return { workerId: w.id, nom: w.name, cases, total: cases.reduce((n, c) => n + c.minutes, 0) };
  });
  return { lundi, dates, lignes, total: lignes.reduce((n, l) => n + l.total, 0) };
}

// Phrases de Koji sur la feuille : départ non pointé, journée non pointée.
export function remarquesSemaine(grille = {}) {
  const out = [];
  for (const l of grille.lignes || []) {
    for (const c of l.cases) {
      const quand = jourLong(c.date);
      if (c.statut === "douteux") out.push({ type: "depart", workerId: l.workerId, date: c.date, texte: `${l.nom} n'a pas pointé son départ ${quand}`, detail: c.proposition ? `Koji a mis ${heuresDecimales(c.proposition).replace(",0 h", " h")}, comme les autres jours. Touchez la case pour corriger.` : "Touchez la case pour corriger." });
    }
  }
  const manquants = new Map();
  for (const l of grille.lignes || []) for (const c of l.cases) if (c.statut === "manquant") manquants.set(c.date, [...(manquants.get(c.date) || []), l]);
  for (const [date, ls] of manquants) out.push({ type: "manquant", date, workerIds: ls.map((l) => l.workerId), texte: `${ls.length > 1 ? `${ls.length} compagnons n'ont` : `${ls[0].nom} n'a`} pas pointé ${jourLong(date)}`, detail: "Le rappel est prêt à envoyer." });
  return out;
}

// Heures des 4 dernières semaines d'un compagnon.
export function heures4Semaines(entries = [], workerId, aujourdhui = new Date().toISOString()) {
  const lundi = lundiDe(paris(aujourdhui).jour);
  return [3, 2, 1, 0].map((k) => {
    const debut = ajouterJours(lundi, -7 * k);
    const fin = ajouterJours(debut, 6);
    const minutes = entries.filter((e) => e.workerId === workerId && e.date >= debut && e.date <= fin).reduce((n, e) => n + dureePointage(e, aujourdhui), 0);
    return { semaine: `S${numeroSemaine(debut)}`, lundi: debut, minutes };
  });
}

// Documents des compagnons (carte BTP, formations…) : rappel un mois avant.
export function documentsAExpirer(workers = [], aujourdhui = new Date().toISOString(), jours = 30) {
  const auj = paris(aujourdhui).jour;
  const limite = ajouterJours(auj, jours);
  const out = [];
  for (const w of workers) for (const d of w.documents || []) if (d.jusqua && j10(d.jusqua) <= limite) out.push({ workerId: w.id, nom: w.name, document: d.nom, jusqua: j10(d.jusqua), expire: j10(d.jusqua) < auj });
  return out.sort((a, b) => a.jusqua.localeCompare(b.jusqua));
}

// Ce que Koji a appris : un lot où les heures réelles dépassent nettement
// le prévu ; avec la quantité et le temps de la bibliothèque, le temps
// réel par unité.
// lignes : [{ lot, chantier, faitesMin, prevuesMin, quantite, unite, hParUniteBib, code }]
export function apprentissages(lignes = []) {
  return lignes
    .filter((l) => l.prevuesMin > 0 && l.faitesMin >= l.prevuesMin * 1.15 && l.faitesMin - l.prevuesMin >= 120)
    .map((l) => {
      const reel = l.quantite > 0 ? Math.round((l.faitesMin / 60 / l.quantite) * 100) / 100 : 0;
      const ratio = (n) => String(n).replace(".", ",");
      return {
        ...l,
        titre: `${l.lot}${l.chantier ? `, ${l.chantier}` : ""}`,
        resume: `${Math.round(l.faitesMin / 60)} h faites pour ${Math.round(l.prevuesMin / 60)} h prévues`,
        hParUniteReel: reel,
        texte: reel && l.hParUniteBib ? `Sur ce lot, la pose vous prend ${ratio(reel)} h/${l.unite || "u"}. Votre bibliothèque compte ${ratio(l.hParUniteBib)} h/${l.unite || "u"} : vos devis sont trop bas sur ce poste.` : "Les heures réelles dépassent le devis : vérifiez le temps de cet ouvrage dans votre bibliothèque."
      };
    })
    .sort((a, b) => (b.faitesMin - b.prevuesMin) - (a.faitesMin - a.prevuesMin))
    .slice(0, 3);
}

// Export pour le comptable : une ligne par compagnon et par jour.
export function csvHeures(grille = {}) {
  const lignes = [["Compagnon", "Date", "Heures", "Statut"]];
  for (const l of grille.lignes || []) for (const c of l.cases) lignes.push([l.nom, c.date.split("-").reverse().join("/"), String(Math.round(c.minutes / 6) / 10).replace(".", ","), { ok: "pointé", corrige: "corrigé", douteux: "départ non pointé", manquant: "non pointé", conge: "congé", a_venir: "", en_cours: "en cours" }[c.statut] || c.statut]);
  return "﻿" + lignes.map((l) => l.map((x) => (/[;"\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(";")).join("\r\n");
}

// Invitation : lien valable 7 jours. L'invitation porte un code (celui du
// lien et de la connexion du compagnon), posé par creerInvitation.
export const INVITATION_JOURS = 7;
export function invitationValide(inv = {}, maintenant = new Date().toISOString()) {
  return Boolean(inv?.code && inv.creeLe && Date.parse(maintenant) - Date.parse(inv.creeLe) < INVITATION_JOURS * 86400000);
}
export function messageInvitation({ prenom = "", entreprise = "", lien = "" } = {}) {
  return `Bonjour${prenom ? ` ${prenom}` : ""}, ${entreprise || "votre entreprise"} vous invite sur Koji pour voir vos chantiers, vos tâches et pointer vos heures. Ouvrez ce lien (pas de mot de passe) : ${lien}`;
}
