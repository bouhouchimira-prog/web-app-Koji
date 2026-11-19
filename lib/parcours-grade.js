// Mon parcours, version 2 (maquette PRO-26) : grade, niveaux, points
// d'expérience, hauts faits, aperçu côté particulier. Seuls des actes
// constatés par Koji dans les données rapportent de l'expérience ; jamais
// une déclaration de l'entreprise, jamais un clic. Tout est recalculé à
// chaque lecture : un devis rétracté ou annulé retire son expérience.
// Seule source des niveaux de Koji Pro : « Ma progression » (PRO-21) lit
// aussi ce fichier. Barèmes et seuils : hypothèses de la maquette, à
// valider par Bilal. Mêmes règles d'affichage dans l'app Koji Pro
// (mobile/lib/features/parcours/parcours_logic.dart).
import { noteValide, statsAvis } from "./avis.js";
import { paiementsDe } from "./encaissements.js";
import { etatTalents, jourParis } from "./parcours-talents.js";

// Expérience : ce que Koji constate lui-même (signature du client, PV
// signé par le client, avis du client, horodatage du Radar et des photos).
export const BAREME = {
  devisSigne: { label: "Devis signés", un: "Devis signé", xp: 50 },
  pv: { label: "Chantiers livrés avec PV", un: "Chantier livré avec PV", xp: 150 },
  avis: { label: "Avis vérifiés", un: "Avis vérifié", xp: 40 },
  avisBas: { label: "Avis vérifiés à 2 / 5 ou moins", un: "Avis vérifié à 2 / 5 ou moins", xp: -40 },
  radar: { label: "Réponses Radar en moins de 2 h", un: "Réponse Radar en moins de 2 h", xp: 10 },
  photo: { label: "Photos datées sur un chantier signé", un: "Photo datée sur un chantier signé", xp: 5 }
};
export const PHOTOS_MAX_PAR_CHANTIER = 10;
export const RADAR_RAPIDE_HEURES = 2;

// Lignes du barème de la maquette que Koji ne peut pas constater
// aujourd'hui : elles ne rapportent ni ne retirent rien.
export const NON_MESURES = [
  { id: "facture-delai", label: "Facture payée dans le délai (+ 20)", raison: "le paiement est saisi par l'entreprise, Koji ne le constate pas (pas de paiement en ligne)" },
  { id: "rdv-honore", label: "Rendez-vous honoré (+ 30)", raison: "le client ne confirme pas dans Koji que le rendez-vous a eu lieu" },
  { id: "rdv-non-honore", label: "Rendez-vous non honoré (− 60)", raison: "même raison : aucune donnée sur les rendez-vous manqués" },
  { id: "documents", label: "Documents à jour (+ 100)", raison: "la décennale est déclarée par l'entreprise, pas contrôlée par Koji" },
  { id: "litige", label: "Litige tranché contre l'entreprise (− 150)", raison: "Koji n'a pas de procédure de litige" }
];

export const GRADES = [
  { id: "apprenti", label: "Apprenti", de: 1, a: 5 },
  { id: "ouvrier", label: "Ouvrier", de: 6, a: 12 },
  { id: "compagnon", label: "Compagnon", de: 13, a: 20 },
  { id: "chef-equipe", label: "Chef d'équipe", de: 21, a: 30 },
  { id: "chef-chantier", label: "Chef de chantier", de: 31, a: 40 },
  { id: "maitre", label: "Maître", de: 41, a: 49 },
  { id: "batisseur", label: "Bâtisseur", de: 50, a: 50 }
];
export const NIVEAU_MAX = 50;
// Côté particulier, le titre n'apparaît qu'à partir de Compagnon : un
// artisan expérimenté qui s'inscrit n'est pas affiché « Apprenti », ses
// preuves passent avant (option de la maquette).
export const GRADE_PUBLIC_DES = 13;
export const DISTINCTIONS_MAX = 3;
// « Pionnier » : inscrit la première année de Koji (hypothèse : en 2026).
export const PIONNIER_AVANT = "2027-01-01";

const JOUR = 86400000;
const t = (v) => new Date(v || 0).getTime();
const j10 = (v) => String(v || "").slice(0, 10);

// Niveau n → n+1 : 100 × n points (maquette « niveau n = 100 × n »).
export const xpPourPasser = (n) => 100 * n;
export const cumulNiveau = (n) => 50 * n * (n - 1);
export const gradeDe = (niveau) => GRADES.find((g) => niveau >= g.de && niveau <= g.a) || GRADES[0];

export function niveauDe(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let n = 1;
  while (n < NIVEAU_MAX && cumulNiveau(n + 1) <= x) n++;
  const grade = gradeDe(n);
  const suivant = GRADES[GRADES.indexOf(grade) + 1] || null;
  const max = n >= NIVEAU_MAX;
  const dansNiveau = max ? 0 : x - cumulNiveau(n);
  const requis = max ? 0 : xpPourPasser(n);
  return {
    niveau: n,
    xp: x,
    dansNiveau,
    requis,
    pourcent: max ? 100 : Math.floor((dansNiveau / requis) * 100),
    grade: { id: grade.id, label: grade.label },
    prochainGrade: suivant ? { id: suivant.id, label: suivant.label, niveau: suivant.de } : null
  };
}

// Devis signé constaté : signature du client (lien, Koji Client ou sur
// place) ; pas un accord noté à la main, pas un devis rétracté ou annulé.
export function devisSigneConstate(q = {}) {
  const signe = q.status === "Signe" || q.signatureStatus === "Signe";
  if (!signe) return false;
  if (q.signatureProvider === "manuel") return false;
  return !(q.retracteLe || q.cancelledAt || q.status === "Annule");
}

// Délai entre la publication d'un chantier sur le Radar et la proposition.
export function delaiReponseRadar(position, offre) {
  if (!position?.createdAt || !offre) return null;
  const d = t(position.createdAt) - t(offre.publishedAt || offre.createdAt);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

const parDate = (a, b) => String(a.le || "").localeCompare(String(b.le || ""));

export function actesExperience({ quotes = [], clotures = [], avis = [], positions = [], offres = [], photos = [] } = {}) {
  const actes = [];
  const signes = quotes.filter(devisSigneConstate);
  for (const q of signes) actes.push({ type: "devisSigne", le: q.signedAt || "", ref: q.id });
  for (const c of clotures) if (c.pv?.signeLe) actes.push({ type: "pv", le: c.pv.signeLe, ref: c.projectId });
  for (const a of avis) if (a.verifie && noteValide(a.note)) actes.push({ type: Number(a.note) <= 2 ? "avisBas" : "avis", le: a.creeLe || "", ref: a.id });
  const offreDe = new Map(offres.map((o) => [o.id, o]));
  const vues = new Set();
  for (const p of [...positions].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    const d = delaiReponseRadar(p, offreDe.get(p.offerId));
    if (d == null || d > RADAR_RAPIDE_HEURES * 3600000 || vues.has(p.offerId)) continue;
    vues.add(p.offerId);
    actes.push({ type: "radar", le: p.createdAt, ref: p.offerId });
  }
  // Photos horodatées par le serveur, sur un chantier dont le devis est
  // signé par le client ; plafonnées par chantier.
  const chantiersSignes = new Set(signes.map((q) => q.projectId).filter(Boolean));
  const parChantier = new Map();
  for (const ph of [...photos].sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)))) {
    if (!ph.projectId || !chantiersSignes.has(ph.projectId) || !ph.takenAt) continue;
    const n = parChantier.get(ph.projectId) || 0;
    if (n >= PHOTOS_MAX_PAR_CHANTIER) continue;
    parChantier.set(ph.projectId, n + 1);
    actes.push({ type: "photo", le: ph.takenAt, ref: ph.id });
  }
  return actes.map((a) => ({ ...a, xp: BAREME[a.type].xp })).sort(parDate);
}

// Total (jamais négatif) et détail du mois en cours (heure de Paris).
export function experience(actes = [], maintenant = new Date().toISOString()) {
  const total = Math.max(0, actes.reduce((s, a) => s + a.xp, 0));
  const mois = jourParis(maintenant).slice(0, 7);
  const duMois = actes.filter((a) => a.le && jourParis(a.le).slice(0, 7) === mois);
  const ceMois = Object.keys(BAREME)
    .map((type) => {
      const liste = duMois.filter((a) => a.type === type);
      return { type, label: liste.length > 1 ? BAREME[type].label : BAREME[type].un, nombre: liste.length, xp: liste.reduce((s, a) => s + a.xp, 0) };
    })
    .filter((l) => l.nombre > 0);
  return { total, ceMois, totalMois: ceMois.reduce((s, l) => s + l.xp, 0) };
}

// ── Hauts faits ──────────────────────────────────────────────────────────
// Publics seulement s'ils reposent sur des faits que Koji constate ;
// bibliothèque, compagnons et trésorerie restent privés (maquette).
export const HAUTS_FAITS = [
  { id: "premier-coup-de-pelle", titre: "Premier coup de pelle", detail: "Premier devis signé", categorie: "Chantier", public: true, cible: 1 },
  { id: "cle-en-main", titre: "Clé en main", detail: "Premier chantier livré avec procès-verbal", categorie: "Chantier", public: true, cible: 1 },
  { id: "chantier-propre", titre: "Chantier propre", detail: "10 chantiers sans réserve au PV", categorie: "Chantier", public: true, cible: 10 },
  { id: "fil-a-plomb", titre: "Fil à plomb", detail: "50 chantiers livrés", categorie: "Chantier", public: true, cible: 50 },
  { id: "dix-sur-dix", titre: "Dix sur dix", detail: "10 avis vérifiés consécutifs à 4,5 ou plus", categorie: "Client", public: true, cible: 10 },
  { id: "parole-tenue", titre: "Parole tenue", detail: "20 rendez-vous honorés, confirmés par le client", categorie: "Client", public: true, cible: 20, mesurable: false, raison: "Koji ne demande pas encore au client de confirmer que le rendez-vous a eu lieu." },
  { id: "pas-une-minute", titre: "Pas une minute", detail: "20 réponses Radar en moins d'une heure", categorie: "Radar", public: true, cible: 20 },
  { id: "bon-voisinage", titre: "Bon voisinage", detail: "10 chantiers Radar à moins de 5 km du précédent", categorie: "Radar", public: true, cible: 10 },
  { id: "compagnons-d-abord", titre: "Compagnons d'abord", detail: "5 compagnons actifs sur un mois", categorie: "Équipe", public: false, cible: 5 },
  { id: "specialiste-salle-de-bain", titre: "Spécialiste salle de bain", detail: "20 salles de bain livrées", categorie: "Métier", public: true, cible: 20 },
  { id: "bibliotheque-complete", titre: "Bibliothèque complète", detail: "200 ouvrages avec prix", categorie: "Métier", public: false, cible: 200 },
  { id: "pionnier", titre: "Pionnier", detail: "Inscrit la première année", categorie: "Ancienneté", public: true, cible: 1 },
  { id: "fidele", titre: "Fidèle", detail: "Un an sur Koji", categorie: "Ancienneté", public: true, cible: 365 },
  { id: "tresorerie-saine", titre: "Trésorerie saine", detail: "12 mois de factures payées dans le délai", categorie: "Trésorerie", public: false, cible: 12 }
];

export const BON_VOISINAGE_KM = 5;
export const PAS_UNE_MINUTE_HEURES = 1;
const SALLE_DE_BAIN = /salle\s*(de\s*bains?|d['’]\s*eau)|\bsdb\b/i;

function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const coord = (o) => (o && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lon)) && o.lat !== null && o.lon !== null ? { lat: Number(o.lat), lon: Number(o.lon) } : null);

// Dates connues triées : la date d'obtention est celle du n-ième fait.
const nieme = (dates, n) => dates.filter(Boolean).map(String).sort()[n - 1] || "";
const plusJours = (jour, n) => new Date(t(`${j10(jour)}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

export function aSalleDeBain(q = {}) {
  return [...(q.items || []).map((i) => i.room), ...(q.rooms || []).map((r) => (typeof r === "string" ? r : r?.name || r?.label))].some((n) => SALLE_DE_BAIN.test(String(n || "")));
}

function moisSuivant(mois) {
  const [a, m] = mois.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

// Mois (échéances passées) où toutes les factures dues ont été payées au
// plus tard à l'échéance ; un mois sans échéance ne compte pas et ne
// casse pas la série. Données saisies par l'entreprise : haut fait privé.
export function serieTresorerie(invoices = [], aujourdhui) {
  const parMois = new Map();
  for (const f of invoices) {
    if (f.kind === "avoir" || ["Brouillon", "Annulee"].includes(f.status) || !f.dueDate || j10(f.dueDate) >= aujourdhui) continue;
    const pays = paiementsDe(f);
    const paye = pays.reduce((s, p) => s + Number(p.amount || 0), 0) >= Number(f.amountTtc || 0) - 0.01;
    const dernier = pays.map((p) => j10(p.date)).sort().at(-1) || "";
    const aTemps = paye && dernier && dernier <= j10(f.dueDate);
    const mois = j10(f.dueDate).slice(0, 7);
    const m = parMois.get(mois) || { ok: true, fin: "" };
    m.ok = m.ok && Boolean(aTemps);
    m.fin = [m.fin, j10(f.dueDate)].sort().at(-1);
    parMois.set(mois, m);
  }
  let serie = 0;
  let meilleure = 0;
  let obtenuLe = "";
  for (const mois of [...parMois.keys()].sort()) {
    const m = parMois.get(mois);
    serie = m.ok ? serie + 1 : 0;
    if (serie > meilleure) meilleure = serie;
    if (serie === 12 && !obtenuLe) obtenuLe = m.fin;
  }
  return { valeur: meilleure, obtenuLe };
}

// Valeur atteinte et date d'obtention de chaque haut fait.
function mesures(d, maintenant) {
  const auj = jourParis(maintenant);
  const signes = (d.quotes || []).filter(devisSigneConstate);
  const pv = (d.clotures || []).filter((c) => c.pv?.signeLe);
  const offreDe = new Map((d.offres || []).map((o) => [o.id, o]));
  const m = {};
  m["premier-coup-de-pelle"] = { valeur: signes.length, dates: signes.map((q) => q.signedAt) };
  m["cle-en-main"] = { valeur: pv.length, dates: pv.map((c) => c.pv.signeLe) };
  const propres = pv.filter((c) => !(c.pv.reserves || []).length);
  m["chantier-propre"] = { valeur: propres.length, dates: propres.map((c) => c.pv.signeLe) };
  m["fil-a-plomb"] = m["cle-en-main"];

  // Avis vérifiés consécutifs à 4,5 ou plus (notes entières : 5 sur 5).
  const avis = (d.avis || []).filter((a) => a.verifie && noteValide(a.note)).sort((a, b) => String(a.creeLe).localeCompare(String(b.creeLe)));
  let serie = 0;
  let meilleure = 0;
  let dixLe = "";
  for (const a of avis) {
    serie = Number(a.note) >= 4.5 ? serie + 1 : 0;
    meilleure = Math.max(meilleure, serie);
    if (serie === 10 && !dixLe) dixLe = a.creeLe || "";
  }
  m["dix-sur-dix"] = { valeur: meilleure, obtenuLe: dixLe };

  const rapides = new Map();
  for (const p of d.positions || []) {
    const delai = delaiReponseRadar(p, offreDe.get(p.offerId));
    if (delai != null && delai <= PAS_UNE_MINUTE_HEURES * 3600000 && !rapides.has(p.offerId)) rapides.set(p.offerId, p.createdAt);
  }
  m["pas-une-minute"] = { valeur: rapides.size, dates: [...rapides.values()] };

  // Chantiers du Radar signés par le client, chacun comparé au précédent
  // (coordonnées exactes, jamais renvoyées).
  const radar = signes
    .filter((q) => q.chantierOffreId && coord(offreDe.get(q.chantierOffreId)))
    .sort((a, b) => String(a.signedAt).localeCompare(String(b.signedAt)));
  const voisins = [];
  for (let i = 1; i < radar.length; i++) {
    if (distanceKm(coord(offreDe.get(radar[i - 1].chantierOffreId)), coord(offreDe.get(radar[i].chantierOffreId))) < BON_VOISINAGE_KM) voisins.push(radar[i].signedAt);
  }
  m["bon-voisinage"] = { valeur: voisins.length, dates: voisins };

  // Compagnons de l'équipe (pas les sous-traitants) ayant pointé dans le mois.
  const equipe = new Set((d.workers || []).filter((w) => !/sous.?traitant/i.test(String(w.type || ""))).map((w) => w.id));
  const parMois = new Map();
  let cinqLe = "";
  for (const e of [...(d.attendance || [])].filter((x) => equipe.has(x.workerId) && x.date).sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const mois = j10(e.date).slice(0, 7);
    const s = parMois.get(mois) || new Set();
    s.add(e.workerId);
    parMois.set(mois, s);
    if (s.size === 5 && !cinqLe) cinqLe = j10(e.date);
  }
  m["compagnons-d-abord"] = { valeur: Math.max(0, ...[...parMois.values()].map((s) => s.size)), obtenuLe: cinqLe };

  const sdb = pv.filter((c) => signes.some((q) => q.projectId && q.projectId === c.projectId && aSalleDeBain(q)));
  m["specialiste-salle-de-bain"] = { valeur: sdb.length, dates: sdb.map((c) => c.pv.signeLe) };
  m["bibliotheque-complete"] = { valeur: Number(d.ouvrages) || 0, obtenuLe: "" };

  const inscrit = j10(d.inscritLe);
  m.pionnier = inscrit ? { valeur: inscrit < PIONNIER_AVANT ? 1 : 0, obtenuLe: inscrit < PIONNIER_AVANT ? inscrit : "", atteignable: inscrit < PIONNIER_AVANT } : { valeur: 0, obtenuLe: "", mesurable: false };
  const jours = inscrit ? Math.max(0, Math.floor((t(`${auj}T12:00:00Z`) - t(`${inscrit}T12:00:00Z`)) / JOUR)) : 0;
  m.fidele = inscrit ? { valeur: jours, obtenuLe: jours >= 365 ? plusJours(inscrit, 365) : "" } : { valeur: 0, obtenuLe: "", mesurable: false };
  m["tresorerie-saine"] = serieTresorerie(d.invoices || [], auj);
  return m;
}

export function hautsFaits(donnees = {}, maintenant = new Date().toISOString()) {
  const m = mesures(donnees, maintenant);
  return HAUTS_FAITS.map((h) => {
    const x = m[h.id] || { valeur: 0 };
    const mesurable = h.mesurable !== false && x.mesurable !== false;
    const obtenu = mesurable && x.valeur >= h.cible;
    const obtenuLe = obtenu ? j10(x.obtenuLe !== undefined ? x.obtenuLe : nieme(x.dates || [], h.cible)) : "";
    return {
      id: h.id,
      titre: h.titre,
      detail: h.detail,
      categorie: h.categorie,
      public: h.public,
      mesurable,
      atteignable: mesurable && x.atteignable !== false,
      raison: h.raison || (x.atteignable === false ? "Réservé aux entreprises inscrites la première année." : ""),
      cible: h.cible,
      valeur: mesurable ? Math.min(x.valeur, h.cible) : 0,
      obtenu,
      obtenuLe,
      pourcent: obtenu ? 100 : mesurable ? Math.floor((Math.min(x.valeur, h.cible) / h.cible) * 100) : 0
    };
  });
}

// Chiffres de preuve (bandeau et côté particulier).
export function preuves(donnees = {}, faits = []) {
  const s = statsAvis(donnees.avis || []);
  return {
    chantiersLivres: (donnees.clotures || []).filter((c) => c.pv?.signeLe).length,
    avisVerifies: s.nombre,
    noteMoyenne: s.moyenne,
    devisSignes: (donnees.quotes || []).filter(devisSigneConstate).length,
    hautsFaitsPublics: faits.filter((h) => h.public && h.obtenu).length
  };
}

// Trois distinctions au plus, parmi les hauts faits publics obtenus.
export function distinctionsValides(ids = [], faits = []) {
  const ok = new Set(faits.filter((h) => h.public && h.obtenu).map((h) => h.id));
  return [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => ok.has(id)).slice(0, DISTINCTIONS_MAX);
}

const note1 = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0);
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// Ce que voit le particulier : grade (à partir de Compagnon), chiffres de
// preuve, trois distinctions choisies. Jamais de niveau, de points ni de
// talents.
export function plaqueParticulier({ niveau, preuves: p, faits = [], distinctions = [], avecAvis = true } = {}) {
  const lignes = [];
  if (p?.chantiersLivres) lignes.push(pl(p.chantiersLivres, "chantier livré avec PV", "chantiers livrés avec PV"));
  if (avecAvis && p?.avisVerifies) lignes.push(`${pl(p.avisVerifies, "avis vérifié", "avis vérifiés")} · ${note1(p.noteMoyenne)} / 5`);
  const titres = distinctionsValides(distinctions, faits).map((id) => faits.find((h) => h.id === id).titre);
  return {
    grade: niveau && niveau.niveau >= GRADE_PUBLIC_DES ? niveau.grade.label : "",
    preuves: lignes,
    distinctions: titres
  };
}

// État complet de « Mon parcours » pour l'entreprise.
export function etatParcours(donnees = {}, prefs = {}, maintenant = new Date().toISOString()) {
  const actes = actesExperience(donnees);
  const xp = experience(actes, maintenant);
  const niveau = niveauDe(xp.total);
  const faits = hautsFaits(donnees, maintenant);
  const p = preuves(donnees, faits);
  const distinctions = distinctionsValides(prefs.distinctions, faits);
  const talents = etatTalents(prefs.talents || {}, { points: niveau.niveau, maintenant });
  return {
    niveau,
    grades: GRADES.map((g) => ({ id: g.id, label: g.label, de: g.de, atteint: niveau.niveau >= g.de, actuel: g.id === niveau.grade.id })),
    preuves: p,
    ceMois: xp.ceMois,
    totalMois: xp.totalMois,
    hautsFaits: faits,
    compteurs: {
      obtenus: faits.filter((h) => h.obtenu).length,
      aVenir: faits.filter((h) => !h.obtenu && h.atteignable).length,
      tous: faits.length
    },
    distinctions,
    apercu: plaqueParticulier({ niveau, preuves: p, faits, distinctions, avecAvis: donnees.avecAvis !== false }),
    plaqueActive: talents.plaque,
    talents,
    bareme: Object.entries(BAREME).map(([id, b]) => ({ id, label: b.un, xp: b.xp })),
    nonMesures: NON_MESURES
  };
}
