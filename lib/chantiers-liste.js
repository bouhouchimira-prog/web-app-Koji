// Liste des chantiers (maquette PRO-02), site et app Koji Pro : une ligne par
// chantier non archivé, calculée avec les mêmes données que la fiche
// (chantier, devis rattaché, tâches, rendez-vous, factures, alertes).
// Rien n'est stocké : le statut se déduit à chaque lecture.
//
// - Avancement : les lots du devis (lignes regroupées par pièce / lot, comme
//   dans l'éditeur), un lot est fait quand toutes ses lignes ont leur tâche
//   terminée ; sans devis, les tâches du chantier.
// - Statut affiché : ce qui demande une action d'abord (Bloquant, À
//   relancer, En retard, Échéance), sinon l'état du chantier.

const JOUR = 86400000;
const ECHEANCE_JOURS = 7;

export const ONGLETS_CHANTIERS = [
  { id: "en_cours", label: "En cours" },
  { id: "a_planifier", label: "À planifier" },
  { id: "termine", label: "Clôturés" },
  { id: "tous", label: "Tous" }
];

const URGENCES = { degat: "Dégât", fuite: "Fuite", urgence: "Urgence", incendie: "Incendie", autre: "Alerte" };

function euros(n) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)).replace(/ /g, " ")} €`;
}

function jourCourt(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d) : "";
}

function jourJalon(iso, aujourdhui) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const t = new Date(`${aujourdhui}T12:00:00`);
  const ecart = Math.round((d - t) / JOUR);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short" }).format(d);
}

function heure(hhmm) {
  const [h, m] = String(hhmm || "").split(":");
  if (!h) return "";
  return ` ${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
}

export function villeDe(adresse) {
  const parties = String(adresse || "").split(",").map((p) => p.trim()).filter(Boolean);
  const derniere = parties.length > 1 ? parties[parties.length - 1] : parties[0] || "";
  return derniere.replace(/^\d{5}\s*/, "");
}

export function estArchive(chantier) {
  return String(chantier.status || "").toLowerCase().includes("archive");
}

export function devisSigne(devis) {
  return Boolean(devis && (devis.status === "Signe" || devis.signatureStatus === "Signe"));
}

// Même clé que la fiche chantier (app/chantiers/page.jsx::quoteItemId).
export function cleLigne(ligne, index) {
  return `${ligne.roomId || ligne.room || "chantier"}-${ligne.taskId || ligne.code || index}`;
}

export function lotsDuDevis(devis, taches = []) {
  const lignes = Array.isArray(devis?.items) ? devis.items : [];
  const lots = new Map();
  lignes.forEach((ligne, index) => {
    const lot = String(ligne.room || "Chantier").trim() || "Chantier";
    const cle = cleLigne(ligne, index);
    const tache = taches.find((t) => t.quoteItemId === cle) || taches.find((t) => t.label === ligne.label && (t.room || "") === (ligne.room || ""));
    const actuel = lots.get(lot) || { lignes: 0, faites: 0 };
    actuel.lignes += 1;
    if (tache?.done) actuel.faites += 1;
    lots.set(lot, actuel);
  });
  const total = lots.size;
  const faits = [...lots.values()].filter((l) => l.lignes > 0 && l.faites === l.lignes).length;
  const lignesFaites = [...lots.values()].reduce((n, l) => n + l.faites, 0);
  return { total, faits, lignes: lignes.length, lignesFaites };
}

export function statutChantier(progression, signe, finPrevue, aujourdhui) {
  if (progression >= 100) return "termine";
  if (!signe) return "a_planifier";
  if (finPrevue && String(finPrevue).slice(0, 10) < aujourdhui) return "retard";
  if (progression >= 85) return "finitions";
  return "en_cours";
}

export const ONGLET_DU_STATUT = { en_cours: "en_cours", finitions: "en_cours", retard: "en_cours", a_planifier: "a_planifier", termine: "termine" };

const ETIQUETTE_STATUT = {
  retard: { label: "En retard", ton: "b" },
  a_planifier: { label: "À planifier", ton: "o" },
  en_cours: { label: "En cours", ton: "e" },
  finitions: { label: "Finitions", ton: "e" },
  termine: { label: "Clôturé", ton: "dim" }
};

export function lignesChantiers({ projects = [], quotes = [], tasks = [], calendarEvents = [], invoices = [], alerts = [], aujourdhui, maintenant }) {
  const today = aujourdhui || new Date().toISOString().slice(0, 10);
  const now = maintenant ?? Date.now();
  return projects
    .filter((p) => !estArchive(p))
    .map((p) => {
      const devis = quotes.find((q) => q.projectId === p.id) || null;
      const signe = devisSigne(devis);
      const taches = tasks.filter((t) => t.projectId === p.id);
      const tachesFaites = taches.filter((t) => t.done).length;
      const lots = lotsDuDevis(devis, taches);
      // Avancement : les lignes du devis (une ligne sans tâche n'est pas
      // faite), sinon les tâches, sinon la valeur saisie sur le chantier.
      const progression = lots.lignes
        ? Math.round((lots.lignesFaites / lots.lignes) * 100)
        : taches.length ? Math.round((tachesFaites / taches.length) * 100) : Number(p.progress || 0);
      const fins = taches.map((t) => t.endDate || t.dueDate).filter(Boolean).sort();
      const finPrevue = fins.at(-1) || p.endDate || p.dueDate || "";
      // Devis signé, rien de planifié ni facturé (hors acompte) : le
      // chantier reste « À planifier » jusqu'à son lancement (maquette
      // PRO-02.1). Un chantier déjà facturé sans tâches reste en cours.
      const factureHorsAcompte = invoices.some((f) => f.projectId === p.id && f.kind !== "acompte" && f.status !== "Brouillon");
      const aLancer = signe && lots.lignes > 0 && taches.length === 0 && !factureHorsAcompte;
      const statut = aLancer ? "a_planifier" : statutChantier(progression, signe, finPrevue, today);

      const avancement = lots.total
        ? { faits: lots.faits, total: lots.total, unite: "lots", pourcent: Math.round((lots.faits / lots.total) * 100) }
        : taches.length
          ? { faits: tachesFaites, total: taches.length, unite: "tâches", pourcent: progression }
          : null;

      // Prochain jalon : tâche non faite ou rendez-vous à venir le plus proche.
      const aVenir = [
        ...taches.filter((t) => !t.done && (t.dueDate || t.startDate || "") >= today)
          .map((t) => ({ label: t.label || "Tâche", date: t.dueDate || t.startDate, heure: "" })),
        ...calendarEvents.filter((e) => e.projectId === p.id && new Date(e.startAt || "").getTime() >= now)
          .map((e) => ({ label: e.title || "Rendez-vous", date: String(e.startAt).slice(0, 10), heure: String(e.startAt).slice(11, 16) }))
      ].sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`));
      let jalon = aVenir[0] ? `${aVenir[0].label}, ${jourJalon(aVenir[0].date, today)}${heure(aVenir[0].heure)}` : "";

      // Ce qui demande une action.
      const alerte = alerts.find((a) => a.projectId === p.id && a.status !== "resolved");
      const factureEchue = invoices
        .filter((f) => f.projectId === p.id && f.kind !== "avoir" && ["Emise", "Partielle"].includes(f.status) && f.dueDate && String(f.dueDate).slice(0, 10) < today)
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
      const debut = String(devis?.startDate || p.startDate || "").slice(0, 10);
      const echeanceProche = statut === "a_planifier" && debut && (new Date(`${debut}T12:00:00`) - new Date(`${today}T12:00:00`)) / JOUR <= ECHEANCE_JOURS;

      let etiquette = ETIQUETTE_STATUT[statut];
      let detail = "";
      let montant = { texte: Number(devis?.totalHt || p.budgetHt || 0) > 0 ? `${euros(devis?.totalHt || p.budgetHt)} HT` : "", attente: false };
      if (alerte) {
        etiquette = { label: "Bloquant", ton: "b" };
        detail = `${URGENCES[alerte.type] || "Alerte"} signalée${alerte.source === "client" ? " par le client" : alerte.senderName ? ` par ${alerte.senderName}` : ""}`;
      } else if (factureEchue) {
        etiquette = { label: "À relancer", ton: "o" };
        const reste = Number(factureEchue.amountTtc || 0);
        jalon = `${factureEchue.invoiceNumber ? `Facture ${factureEchue.invoiceNumber}` : "Facture"} : ${euros(reste)} à encaisser`;
        montant = { texte: `${euros(reste)} en attente`, attente: true };
      } else if (statut === "retard") {
        detail = `Fin prévue dépassée (${jourCourt(finPrevue)})`;
      } else if (echeanceProche) {
        etiquette = { label: "Échéance", ton: "w" };
        if (!jalon) jalon = `Démarrage à planifier, ${jourCourt(debut)}`;
      } else if (aLancer) {
        if (!jalon) jalon = "Chantier à lancer : planning à valider";
      } else if (statut === "a_planifier") {
        detail = signe ? "" : "Devis pas encore signé";
      }

      return {
        id: p.id,
        titre: p.title || "Chantier",
        ville: villeDe(p.address),
        client: devis?.client || p.client || "",
        onglet: ONGLET_DU_STATUT[statut],
        statut,
        aLancer,
        etiquette,
        avancement,
        jalon,
        detail,
        montant,
        recherche: [p.title, devis?.client, p.client, p.address].filter(Boolean).join(" ").toLowerCase()
      };
    });
}

export function compterOnglets(lignes) {
  const comptes = { en_cours: 0, a_planifier: 0, termine: 0, tous: lignes.length };
  for (const l of lignes) comptes[l.onglet] += 1;
  return comptes;
}

// « 3 en cours · 1 à planifier » (en-tête téléphone).
export function resumeChantiers(comptes) {
  return [
    comptes.en_cours ? `${comptes.en_cours} en cours` : "",
    comptes.a_planifier ? `${comptes.a_planifier} à planifier` : ""
  ].filter(Boolean).join(" · ") || "aucun chantier en cours";
}
