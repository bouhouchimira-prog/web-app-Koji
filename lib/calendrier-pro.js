// Calendrier Koji Pro (maquettes PRO-11 à 11.4) : jours fériés et ouvrés,
// premier créneau libre d'un intervenant, conflits avec une proposition
// concrète, livraisons des bons de commande, lots à planifier, agenda du
// jour. Logique pure, testée dans tests/unit/calendrier-pro.test.js.
import { estOuvre, finApres, joursFeries, joursOuvresEntre, lendemainOuvre, lotsDuDevis, premierOuvre } from "./planning-chantier.js";
import { etatBon } from "./fournitures-bons.js";

const JOUR = 86400000;
const jour = (v) => String(v || "").slice(0, 10);
const plus = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const jourLong = (j) => { const d = new Date(`${jour(j)}T12:00:00Z`); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()}${d.getUTCDate() === 1 ? "er" : ""} ${MOIS[d.getUTCMonth()]}`; };

export const estFerie = (j) => joursFeries(Number(jour(j).slice(0, 4))).has(jour(j));
export { estOuvre, finApres, joursOuvresEntre, lendemainOuvre, premierOuvre };

const debutTache = (t) => jour(t.startDate || t.dueDate || t.endDate);
const finTache = (t) => { const d = debutTache(t); const f = jour(t.endDate || t.dueDate || t.startDate) || d; return f < d ? d : f; };
export const tacheDatee = (t) => Boolean(debutTache(t));

// Jours ouvrés occupés par un intervenant (tâches non faites).
export function joursOccupes(taches = [], workerId, { sauf = "" } = {}) {
  const occ = new Set();
  for (const t of taches) {
    if (t.done || t.id === sauf || !tacheDatee(t) || !(t.workerIds || []).includes(workerId)) continue;
    for (let d = debutTache(t); d <= finTache(t); d = plus(d, 1)) if (estOuvre(d)) occ.add(d);
  }
  return occ;
}

// Premier jour ouvré ≥ `apres` où l'intervenant est libre `jours` jours ouvrés de suite.
export function premierCreneau(occupes = new Set(), apres, jours = 1) {
  let d = premierOuvre(apres);
  for (let essai = 0; essai < 260; essai += 1) {
    const fin = finApres(d, jours);
    let libre = true;
    for (let x = d; x <= fin; x = plus(x, 1)) if (estOuvre(x) && occupes.has(x)) { libre = false; break; }
    if (libre) return { debut: d, fin };
    d = lendemainOuvre(d);
  }
  return { debut: d, fin: finApres(d, jours) };
}

// Conflits : un intervenant sur deux chantiers le même jour ouvré. Koji
// propose de décaler la tâche qui commence le plus tard au premier
// créneau libre après ce jour, en gardant sa durée en jours ouvrés.
export function conflits(taches = [], workers = [], { debut, fin, titres = new Map() } = {}) {
  const out = [];
  for (const w of workers) {
    const miennes = taches.filter((t) => !t.done && tacheDatee(t) && (t.workerIds || []).includes(w.id));
    const parJour = new Map();
    for (const t of miennes) for (let d = debutTache(t); d <= finTache(t); d = plus(d, 1)) {
      if (!estOuvre(d) || (debut && d < debut) || (fin && d > fin)) continue;
      if (!parJour.has(d)) parJour.set(d, []);
      parJour.get(d).push(t);
    }
    for (const [d, liste] of [...parJour.entries()].sort()) {
      const projets = [...new Set(liste.map((t) => t.projectId || t.project))];
      if (projets.length < 2) continue;
      if (out.some((c) => c.workerId === w.id && c.taches.every((x) => liste.some((t) => t.id === x.id)))) continue;
      const aDecaler = [...liste].sort((a, b) => debutTache(b).localeCompare(debutTache(a)) || String(b.id).localeCompare(String(a.id)))[0];
      const duree = Math.max(1, joursOuvresEntre(debutTache(aDecaler), finTache(aDecaler)));
      const libre = premierCreneau(joursOccupes(taches, w.id, { sauf: aDecaler.id }), lendemainOuvre(d), duree);
      out.push({
        id: `${w.id}-${d}`, workerId: w.id, worker: w.name, jour: d,
        taches: liste.map((t) => ({ id: t.id, projectId: t.projectId || "", chantier: titres.get(t.projectId) || t.project || "Chantier", label: t.room || t.label || "" })),
        proposition: { taskId: aDecaler.id, chantier: titres.get(aDecaler.projectId) || aDecaler.project || "Chantier", debut: libre.debut, fin: libre.fin }
      });
    }
  }
  return out.sort((a, b) => a.jour.localeCompare(b.jour));
}

// Livraisons des bons de commande sur la période ; « Bloquant » quand le
// lieu n'est pas confirmé ou qu'une livraison passée est incomplète.
export function livraisons(bons = [], { debut, fin, titres = new Map(), aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  return bons
    .filter((b) => b.livraisonLe && b.etat !== "annule" && etatBon(b) !== "brouillon" && (!debut || b.livraisonLe >= debut) && (!fin || b.livraisonLe <= fin))
    .map((b) => {
      const etat = etatBon(b);
      const sansLieu = !String(b.livraisonAdresse || "").trim();
      const incomplete = etat !== "livre" && b.livraisonLe < aujourdhui;
      return {
        id: b.id, date: b.livraisonLe, heure: b.livraisonHeure || "", fournisseur: b.supplierName || "Fournisseur", numero: b.numeroKoji || b.numero || "",
        projectId: b.projectId || "", chantier: titres.get(b.projectId) || b.projectTitle || "", etat,
        livre: etat === "livre", bloquant: !b.livre && etat !== "livre" && (sansLieu || incomplete),
        raison: etat === "livre" ? "livré" : sansLieu ? "lieu à confirmer" : incomplete ? "livraison incomplète" : ""
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
}

// Lots des devis signés sans aucune tâche datée : « À planifier ». Durée =
// heures du devis ÷ heures par jour ; après le dernier lot daté du chantier.
export function lotsAPlanifier(chantiers = [], taches = [], { heuresParJour = 7 } = {}) {
  const out = [];
  for (const c of chantiers) {
    if (!c.quote) continue;
    const lots = lotsDuDevis(c.quote);
    const tachesChantier = taches.filter((t) => t.projectId === c.projectId);
    let finPrecedent = "";
    lots.forEach((lot, i) => {
      const datees = tachesChantier.filter((t) => (t.room || "") === lot.nom && tacheDatee(t));
      if (datees.length) {
        finPrecedent = datees.map(finTache).sort().at(-1);
        return;
      }
      if (tachesChantier.some((t) => (t.room || "") === lot.nom && t.done)) return;
      const tachesLot = tachesChantier.filter((t) => (t.room || "") === lot.nom);
      out.push({
        projectId: c.projectId, chantier: c.title, lot: lot.nom, numero: String(i + 1).padStart(2, "0"),
        jours: Math.max(1, Math.ceil(lot.heures / Math.max(1, heuresParJour))), montantHt: lot.montantHt,
        workerIds: [...new Set(tachesLot.flatMap((t) => t.workerIds || []))],
        apres: finPrecedent ? lendemainOuvre(finPrecedent) : "", lotPrecedent: i > 0 ? lots[i - 1].nom : "",
        taskIds: tachesLot.map((t) => t.id)
      });
    });
  }
  return out;
}

// Agenda d'un jour : rendez-vous à l'heure, démarrages et lots en cours,
// livraisons, relances de devis.
export function agendaDuJour({ jour: j, taches = [], evenements = [], livraisons: livs = [], relances = [], titres = new Map(), noms = new Map() } = {}) {
  const l = [];
  for (const e of evenements) {
    if (jour(e.startAt) !== j) continue;
    const h = e.allDay ? "" : new Date(e.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":00", " h").replace(":", " h ");
    l.push({ type: "rdv", heure: h, tri: e.allDay ? "00:00" : new Date(e.startAt).toISOString().slice(11, 16), titre: e.title || "Rendez-vous", detail: [e.projectTitle, e.clientName].filter(Boolean).join(" · "), id: e.id });
  }
  const parChantier = new Map();
  for (const t of taches) {
    if (t.done || !tacheDatee(t) || debutTache(t) > j || finTache(t) < j) continue;
    const k = t.projectId || t.project;
    if (!parChantier.has(k)) parChantier.set(k, []);
    parChantier.get(k).push(t);
  }
  for (const [k, ts] of parChantier) {
    const demarre = ts.some((t) => debutTache(t) === j);
    const qui = [...new Set(ts.flatMap((t) => (t.workerIds || []).map((id) => noms.get(id)).filter(Boolean)))].join(", ");
    const lots = [...new Set(ts.map((t) => t.room).filter(Boolean))];
    l.push({ type: "chantier", heure: "8 h", tri: "08:00", titre: `${demarre ? "Démarrage · " : ""}${titres.get(k) || ts[0].project || "Chantier"}`, detail: [lots.length ? `${lots.length > 1 ? "lots" : "lot"} ${lots.join(", ")}` : "", qui].filter(Boolean).join(" · "), projectId: k });
  }
  for (const v of livs.filter((x) => x.date === j)) l.push({ type: "livraison", heure: v.heure, tri: v.heure ? v.heure.replace(/\D/g, "").padStart(2, "0") : "09", titre: `Livraison ${v.fournisseur}${v.chantier ? ` → ${v.chantier}` : ""}`, detail: [v.numero, v.raison].filter(Boolean).join(" · "), id: v.id });
  for (const r of relances) l.push({ type: "relance", heure: "17 h", tri: "17:00", titre: `Relancer ${r.client}`, detail: `Devis ${r.numero} · sans réponse depuis ${r.jours} jours`, id: r.id });
  return l.sort((a, b) => a.tri.localeCompare(b.tri));
}

export function resumeSemaine({ taches = [], workers = [], livraisons: livs = [], debut, fin }) {
  const visibles = taches.filter((t) => !t.done && tacheDatee(t) && finTache(t) >= debut && debutTache(t) <= fin);
  const sous = new Set(visibles.flatMap((t) => t.workerIds || []).filter((id) => workers.find((w) => w.id === id)?.type === "Sous-traitant"));
  return { chantiers: new Set(visibles.map((t) => t.projectId || t.project)).size, sousTraitants: sous.size, livraisons: livs.filter((v) => v.date >= debut && v.date <= fin).length };
}

// Dates d'une tâche décalée : même nombre de jours ouvrés à partir de `debut`.
export function decaler(tache = {}, debut) {
  const duree = Math.max(1, joursOuvresEntre(debutTache(tache), finTache(tache)));
  const d = premierOuvre(debut);
  return { startDate: d, endDate: finApres(d, duree), dueDate: finApres(d, duree) };
}
