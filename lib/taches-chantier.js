// Tâches du chantier (maquette PRO-02.7) : la liste par lot (une tâche = un
// lot, un compagnon, un jour), « Fait » coché par le compagnon et
// corrigeable, « Bloquant » (livraison, réserve…) qui remonte sur
// l'accueil ; filtres Aujourd'hui / Bloquées ; ajout en dictant (Koji
// remplit lot, compagnon, jour). Mêmes règles dans l'app Koji Pro
// (mobile/lib/apps/entreprise/chantiers/taches_chantier.dart).

export const FILTRES_TACHES = [
  { id: "toutes", label: "Toutes" },
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "bloquees", label: "Bloquées" }
];

const JOUR = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const midi = (j) => new Date(`${String(j).slice(0, 10)}T12:00:00Z`);

export function sansAccents(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// « Equipe » = l'équipe de l'entreprise (valeur par défaut au lancement du
// chantier) ; vide ou « À affecter » = personne.
export function estAffectee(t) {
  const qui = String(t.assignedTo || "").trim();
  return Boolean(qui) && !/^(a|à) affecter$/i.test(qui);
}

function nomQui(t) {
  return /^(equipe|équipe)$/i.test(String(t.assignedTo || "").trim()) ? "Équipe" : t.assignedTo;
}

export function dateTache(t) {
  return String(t.startDate || t.dueDate || t.endDate || "").slice(0, 10);
}

function finTache(t) {
  return String(t.endDate || t.dueDate || t.startDate || "").slice(0, 10);
}

export function semaine(jour) {
  const d = midi(jour);
  const j = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - j + 3);
  const premier = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - premier) / JOUR - 3 + ((premier.getUTCDay() + 6) % 7)) / 7);
}

function jourCourt(jour, aujourdhui) {
  const d = midi(jour);
  const memeMois = String(jour).slice(0, 7) === String(aujourdhui).slice(0, 7);
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", ...(memeMois ? {} : { month: "short" }) });
  return f.format(d);
}

// « Rui C. · jeu. 30 », « à affecter · sem. 46 », « Mehdi B. · lun. 3 nov.
// · bloquant : receveur livré vendredi ».
export function ligneTache(t, aujourdhui) {
  const debut = dateTache(t);
  const fin = finTache(t);
  const qui = estAffectee(t) ? nomQui(t) : "à affecter";
  let quand = "pas de date";
  if (debut) {
    if (!estAffectee(t)) quand = `sem. ${semaine(debut)}`;
    else if (fin && fin !== debut) quand = `${jourCourt(debut, aujourdhui)} → ${jourCourt(fin, aujourdhui)}`;
    else quand = jourCourt(debut, aujourdhui);
  }
  const bloque = t.bloquant?.raison && !t.done ? ` · bloquant : ${t.bloquant.raison}` : "";
  return `${qui} · ${quand}${bloque}`;
}

export function etatTache(t, aujourdhui) {
  if (t.done) return { id: "fait", label: "Fait" };
  if (t.bloquant?.raison) return { id: "bloquant", label: "Bloquant" };
  if (t.pendingValidation) return { id: "a_valider", label: "À valider" };
  const fin = finTache(t);
  if (fin && fin < aujourdhui) return { id: "retard", label: "En retard" };
  return { id: "a_faire", label: "" };
}

export function duJour(t, aujourdhui) {
  const debut = dateTache(t);
  const fin = finTache(t) || debut;
  return !t.done && Boolean(debut) && debut <= aujourdhui && aujourdhui <= fin;
}

export function filtrerTaches(taches, filtre, aujourdhui) {
  if (filtre === "aujourdhui") return taches.filter((t) => duJour(t, aujourdhui));
  if (filtre === "bloquees") return taches.filter((t) => !t.done && t.bloquant?.raison);
  return taches;
}

export function compterTaches(taches, aujourdhui) {
  return {
    toutes: taches.length,
    faites: taches.filter((t) => t.done).length,
    aujourdhui: taches.filter((t) => duJour(t, aujourdhui)).length,
    bloquees: taches.filter((t) => !t.done && t.bloquant?.raison).length
  };
}

// Lots dans l'ordre du devis (« Lot 03 · Carrelage »), puis les tâches
// hors devis ; dans un lot, par date.
export function tachesParLot(taches, devis) {
  const ordre = [];
  for (const l of devis?.items || []) {
    const nom = String(l.room || "Chantier").trim() || "Chantier";
    if (!ordre.includes(nom)) ordre.push(nom);
  }
  const groupes = new Map();
  for (const t of taches) {
    const nom = String(t.room || "").trim() || "Autres tâches";
    if (!groupes.has(nom)) groupes.set(nom, []);
    groupes.get(nom).push(t);
  }
  const noms = [...ordre.filter((n) => groupes.has(n)), ...[...groupes.keys()].filter((n) => !ordre.includes(n))];
  return noms.map((nom) => {
    const liste = [...groupes.get(nom)].sort((a, b) => (dateTache(a) || "9999").localeCompare(dateTache(b) || "9999"));
    const index = ordre.indexOf(nom);
    return {
      nom,
      titre: index >= 0 ? `Lot ${String(index + 1).padStart(2, "0")} · ${nom}` : nom,
      taches: liste,
      faites: liste.filter((t) => t.done).length
    };
  });
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOTS_VIDES = new Set(["avec", "pour", "le", "la", "les", "de", "des", "du", "et", "a", "au", "aux", "en", "un", "une", "sur", "dans"]);

function racines(texte) {
  return sansAccents(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)).map((m) => m.slice(0, 5));
}

// Ajout en dictant : « Poser les plinthes carrelées vendredi avec Rui » →
// tâche, lot (mots du lot), compagnon (prénom), jour (jour de la semaine,
// demain, après-demain, « le 31 »). Ce qui n'est pas compris reste vide.
export function comprendreDictee(texte, { lots = [], compagnons = [], aujourdhui } = {}) {
  let reste = ` ${String(texte || "").replace(/[«»"]/g, " ").trim()} `;
  const plat = () => sansAccents(reste);
  const retirer = (motif) => {
    const m = motif.exec(plat());
    if (m) reste = reste.slice(0, m.index) + " " + reste.slice(m.index + m[0].length);
  };

  let compagnon = null;
  for (const c of compagnons) {
    const prenom = sansAccents(String(c.name || "").trim().split(/\s+/)[0] || "");
    if (prenom.length < 2) continue;
    const motif = new RegExp(`\\s(?:avec\\s+|par\\s+|pour\\s+)?${prenom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^\\s]*`);
    if (motif.test(plat())) { compagnon = c; retirer(motif); break; }
  }

  let jour = "";
  const base = midi(aujourdhui || new Date().toISOString().slice(0, 10));
  const relatif = /\s(apres-demain|demain|aujourd'hui|aujourdhui|ce soir)\b/.exec(plat());
  if (relatif) {
    const n = relatif[1] === "apres-demain" ? 2 : relatif[1] === "demain" ? 1 : 0;
    jour = iso(new Date(base.getTime() + n * JOUR));
    retirer(/\s(apres-demain|demain|aujourd'hui|aujourdhui|ce soir)\b/);
  } else {
    const semaineJ = new RegExp(`\\s(?:ce\\s+|le\\s+)?(${JOURS.join("|")})(\\s+prochain)?\\b`).exec(plat());
    if (semaineJ) {
      const cible = JOURS.indexOf(semaineJ[1]);
      let ecart = (cible - base.getUTCDay() + 7) % 7;
      if (ecart === 0 && semaineJ[2]) ecart = 7;
      jour = iso(new Date(base.getTime() + ecart * JOUR));
      retirer(new RegExp(`\\s(?:ce\\s+|le\\s+)?(${JOURS.join("|")})(\\s+prochain)?\\b`));
    } else {
      const quantieme = /\sle\s+(\d{1,2})\b/.exec(plat());
      if (quantieme) {
        const n = Number(quantieme[1]);
        const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), n, 12));
        if (n < base.getUTCDate()) d.setUTCMonth(d.getUTCMonth() + 1);
        jour = iso(d);
        retirer(/\sle\s+(\d{1,2})\b/);
      }
    }
  }

  let lot = "";
  const mots = racines(reste);
  let meilleur = 0;
  for (const l of lots) {
    const score = racines(l).filter((r) => mots.includes(r)).length;
    if (score > meilleur) { meilleur = score; lot = l; }
  }

  const label = reste.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").replace(/[\s,.;]+$/, "").trim();
  return { label: label ? label[0].toUpperCase() + label.slice(1) : "", lot, compagnonId: compagnon?.id || "", compagnonNom: compagnon?.name || "", jour };
}
