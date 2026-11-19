// Talents (maquette PRO-26.1) : deux branches, Radar et Vitrine, quatre
// paliers à 1, 3, 6 et 10 points ; un point de métier par niveau. Placer
// un point nouveau prend effet tout de suite ; réorganiser rend tous les
// points, une fois par mois, avec effet le 1er du mois suivant. Les points
// viennent des niveaux, jamais d'un achat ; aucune fonction de Koji ne se
// débloque avec des points.
// Avantages en service aujourd'hui : seulement la Plaque de chantier
// (grade et preuves sur la KojiPage). Les autres paliers (jetons offerts,
// accès anticipé, mise en avant, nom de domaine…) sont affichés comme la
// maquette mais marqués « pas encore en service » : aucun jeton n'est
// crédité par les talents. Mêmes règles dans l'app Koji Pro
// (mobile/lib/features/parcours/parcours_logic.dart).

export const SEUILS = [1, 3, 6, 10];
export const POINTS_MAX_BRANCHE = 10;

export const BRANCHES = [
  {
    id: "radar",
    titre: "Radar",
    sousTitre: "Trouver des chantiers",
    noeuds: [
      { id: "oeil-de-lynx", titre: "Œil de lynx", detail: "+ 1 jeton offert par mois", seuil: 1, avantage: "Jetons offerts", enService: false },
      { id: "premier-sur-le-chantier", titre: "Premier sur le chantier", detail: "voir les annonces 1 h avant les autres · à vérifier", seuil: 3, avantage: "Annonces Radar", enService: false },
      { id: "carnet-plein", titre: "Carnet plein", detail: "+ 3 jetons offerts par mois", seuil: 6, avantage: "Jetons offerts", enService: false },
      { id: "grand-rayon", titre: "Grand rayon", detail: "rayon du Radar élargi · 2 positions gratuites par mois", seuil: 10, avantage: "Rayon du Radar", enService: false }
    ]
  },
  {
    id: "vitrine",
    titre: "Vitrine",
    sousTitre: "Être vu et choisi",
    noeuds: [
      { id: "plaque", titre: "Plaque de chantier", detail: "grade et preuves sur la KojiPage", seuil: 1, avantage: "KojiPage", enService: true, texteService: "grade et preuves affichés" },
      { id: "mise-en-avant", titre: "Mise en avant signalée", detail: "proposition mise en avant chez le particulier, étiquetée « mise en avant »", seuil: 3, avantage: "Mise en avant", enService: false },
      { id: "enseigne", titre: "Enseigne", detail: "KojiPage avec votre propre nom de domaine", seuil: 6, avantage: "Enseigne", enService: false },
      { id: "bouche-a-oreille", titre: "Bouche à oreille", detail: "vos avis mis en avant sur le Radar côté particulier, étiquetés", seuil: 10, avantage: "Avis sur le Radar", enService: false }
    ]
  }
];

export const PAS_EN_SERVICE = "pas encore en service";

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const entier = (v) => Math.max(0, Math.floor(Number(v) || 0));

// Jour de Paris (AAAA-MM-JJ) d'un instant.
export function jourParis(iso = new Date().toISOString()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function premierDuMoisSuivant(jour) {
  const [a, m] = String(jour).split("-").map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
}

// « 1er déc. », « 15 janv. »
export function jourCourt(jour) {
  const [, m, j] = String(jour || "").split("-").map(Number);
  if (!m || !j) return "";
  return `${j === 1 ? "1er" : j} ${MOIS[m - 1]}`;
}
export function moisLong(jour) {
  const m = Number(String(jour || "").split("-")[1]);
  return m ? MOIS_LONGS[m - 1] : "";
}

// Si le niveau baisse (devis rétracté, avis), les points en trop sont
// retirés de la branche la plus chargée.
function ajuster(a, points) {
  let r = Math.min(POINTS_MAX_BRANCHE, entier(a.radar));
  let v = Math.min(POINTS_MAX_BRANCHE, entier(a.vitrine));
  while (r + v > points) {
    if (r >= v && r > 0) r--;
    else v--;
  }
  return { radar: r, vitrine: v };
}

// Répartition en vigueur, réorganisation à venir, droit de réorganiser.
export function lireTalents(store = {}, { points = 0, maintenant = new Date().toISOString() } = {}) {
  const auj = jourParis(maintenant);
  const p = entier(points);
  let actuel = { radar: store?.radar, vitrine: store?.vitrine };
  let aVenir = store?.aVenir && store.aVenir.effetLe ? { ...store.aVenir } : null;
  if (aVenir && auj >= aVenir.effetLe) {
    actuel = { radar: aVenir.radar, vitrine: aVenir.vitrine };
    aVenir = null;
  }
  actuel = ajuster(actuel, p);
  if (aVenir) aVenir = { ...ajuster(aVenir, p), effetLe: aVenir.effetLe, valideLe: aVenir.valideLe || "" };
  const derniereReorg = store?.derniereReorg || "";
  // Une réorganisation par mois : effet le 1er du mois suivant, la
  // prochaine est possible le mois d'après (maquette : validée en novembre,
  // effet le 1er déc., prochaine le 1er janv.).
  const prochaineReorgLe = derniereReorg ? premierDuMoisSuivant(premierDuMoisSuivant(derniereReorg)) : "";
  return { ...actuel, aVenir, derniereReorg, prochaineReorgLe, reorgPossible: !prochaineReorgLe || auj >= prochaineReorgLe };
}

const brancheConnue = (id) => BRANCHES.some((b) => b.id === id);
const enregistrable = (t) => ({ radar: t.radar, vitrine: t.vitrine, aVenir: t.aVenir, derniereReorg: t.derniereReorg });

// Place un point libre dans une branche. Pendant une réorganisation
// validée, le point va dans la nouvelle répartition (et tout de suite dans
// l'actuelle s'il y reste de la place).
export function placerPoint(store, branche, { points = 0, maintenant } = {}) {
  if (!brancheConnue(branche)) throw new Error("Branche inconnue.");
  const t = lireTalents(store, { points, maintenant });
  const plan = t.aVenir || t;
  if (plan.radar + plan.vitrine >= entier(points)) throw new Error("Aucun point de métier à placer.");
  if (plan[branche] >= POINTS_MAX_BRANCHE) throw new Error("Cette branche est complète.");
  const suivant = enregistrable(t);
  if (t.aVenir) {
    suivant.aVenir = { ...t.aVenir, [branche]: t.aVenir[branche] + 1 };
    if (t.radar + t.vitrine < entier(points) && t[branche] < POINTS_MAX_BRANCHE) suivant[branche] = t[branche] + 1;
  } else {
    suivant[branche] = t[branche] + 1;
  }
  return suivant;
}

// Réorganise : nouvelle répartition, effet le 1er du mois suivant.
export function reorganiser(store, repartition = {}, { points = 0, maintenant = new Date().toISOString() } = {}) {
  const t = lireTalents(store, { points, maintenant });
  if (!t.reorgPossible) throw new Error(`Prochaine réorganisation possible le ${jourCourt(t.prochaineReorgLe)}.`);
  const r = entier(repartition.radar);
  const v = entier(repartition.vitrine);
  if (r > POINTS_MAX_BRANCHE || v > POINTS_MAX_BRANCHE) throw new Error(`${POINTS_MAX_BRANCHE} points au plus par branche.`);
  if (r + v > entier(points)) throw new Error("Vous placez plus de points que vous n'en avez.");
  const auj = jourParis(maintenant);
  return { radar: t.radar, vitrine: t.vitrine, aVenir: { radar: r, vitrine: v, effetLe: premierDuMoisSuivant(auj), valideLe: maintenant }, derniereReorg: auj };
}

// Un nœud acquis est graphite, disponible bordé de jaune (atteignable avec
// les points libres), verrouillé gris.
export function etatNoeud(pointsBranche, seuil, libres) {
  if (pointsBranche >= seuil) return "got";
  return seuil - pointsBranche <= libres ? "avail" : "lock";
}

// Tout ce que l'écran Talents affiche.
export function etatTalents(store, { points = 0, maintenant = new Date().toISOString() } = {}) {
  const t = lireTalents(store, { points, maintenant });
  const p = entier(points);
  const plan = t.aVenir || t;
  const libres = Math.max(0, p - (plan.radar + plan.vitrine));
  const branches = BRANCHES.map((b) => {
    const pts = t[b.id];
    const noeuds = b.noeuds.map((n) => ({ ...n, etat: etatNoeud(pts, n.seuil, libres) }));
    const suivant = noeuds.find((n) => n.etat !== "got") || null;
    return {
      id: b.id,
      titre: b.titre,
      sousTitre: b.sousTitre,
      points: pts,
      aVenir: t.aVenir ? t.aVenir[b.id] : null,
      noeuds,
      suivant: suivant ? suivant.id : "",
      peutPlacer: libres > 0 && plan[b.id] < POINTS_MAX_BRANCHE
    };
  });
  const acquis = branches.flatMap((b) => b.noeuds.filter((n) => n.etat === "got"));
  return {
    points: p,
    places: t.radar + t.vitrine,
    libres,
    radar: t.radar,
    vitrine: t.vitrine,
    branches,
    aVenir: t.aVenir,
    reorg: {
      possible: t.reorgPossible && !t.aVenir,
      prochaineLe: t.prochaineReorgLe,
      // Après une réorganisation validée aujourd'hui.
      effetSiValideeLe: premierDuMoisSuivant(jourParis(maintenant)),
      suivanteSiValideeLe: premierDuMoisSuivant(premierDuMoisSuivant(jourParis(maintenant)))
    },
    avantages: acquis.map((n) => ({ id: n.id, label: n.avantage, texte: n.enService ? n.texteService : `${n.titre} · ${PAS_EN_SERVICE}`, enService: n.enService })),
    plaque: t.vitrine >= 1
  };
}
