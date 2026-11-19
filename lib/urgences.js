// Urgences : dépannage immédiat (maquette PRO-17). Le particulier choisit
// son urgence dans Koji Client, voit les prix des artisans disponibles près
// de chez lui ; les plus proches reçoivent l'urgence, le premier qui accepte
// l'obtient ; le particulier confirme, l'artisan part, puis la suite est
// l'intervention rapide existante (PRO-17.1 : devis avant travaux, facture).
// Règles pures, testées dans tests/unit/urgences.test.js ; l'app reprend les
// mêmes textes (mobile/lib/features/urgences/urgences_logic.dart).
//
// Aucun prix calculé par Koji (décision du 10 nov.) : chaque prix vient des
// réglages d'un artisan. Aucun paiement dans Koji. L'adresse exacte, le nom
// et le téléphone du particulier ne sont transmis à l'artisan qu'après la
// confirmation du particulier ; avant, seulement le quartier (maille ~1 km).

import { distanceKm } from "./geo.js";
import { positionApprochee } from "./radar-position.js";
import { arriveeVers, euros, heureParis } from "./intervention-rapide.js";

export const NUMERO_GAZ = "0 800 47 33 33";
export const TEXTE_GAZ = `Sortez, n'actionnez aucun interrupteur, appelez Urgence sécurité gaz au ${NUMERO_GAZ}.`;
export const NOTE_PRO = "Vous acceptez ou refusez chaque urgence librement. Refuser ne change ni votre visibilité ni vos prochaines demandes.";
export const PIECES_SUR_DEVIS = "sur devis signé avant travaux";

// Catégories au lancement (maquette, « Fonctionnement »). Odeur de gaz :
// jamais d'artisan, renvoi vers le numéro d'urgence. [metiers] : métiers
// déclarés exigés (électricité et chauffage, points de vigilance (c)).
export const CATEGORIES = [
  {
    id: "fuite", label: "Fuite d'eau", pro: "Fuite d'eau",
    icone: "M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z", metiers: null,
    questions: [
      { id: "ou", label: "Où ?", court: "Où", options: ["Sous l'évier", "WC", "Chauffe-eau", "Plafond"] },
      { id: "coupee", label: "L'eau est-elle coupée ?", court: "Eau coupée", options: ["Oui", "Non", "Je ne sais pas"] }
    ]
  },
  {
    id: "bouche", label: "WC ou évier bouché", pro: "Canalisation bouchée",
    icone: "M3 7h9a5 5 0 0 1 5 5v9M3 11h8a2 2 0 0 1 2 2v8", metiers: null,
    questions: [
      { id: "quoi", label: "Qu'est-ce qui est bouché ?", court: "Bouché", options: ["WC", "Évier", "Douche ou baignoire", "Toute l'évacuation"] },
      { id: "deborde", label: "L'eau déborde-t-elle ?", court: "Débordement", options: ["Oui", "Non"] }
    ]
  },
  {
    id: "electricite", label: "Panne d'électricité", pro: "Panne d'électricité",
    icone: "M13 3L5 14h6l-1 7 8-11h-6z", metiers: ["Electricien", "Tout corps d'etat"],
    questions: [
      { id: "ou", label: "Où est la panne ?", court: "Panne", options: ["Tout le logement", "Une pièce", "Une prise ou un appareil"] },
      { id: "disjoncteur", label: "Le disjoncteur se réarme-t-il ?", court: "Disjoncteur", options: ["Oui", "Non", "Je ne sais pas"] }
    ]
  },
  {
    id: "serrure", label: "Porte claquée, serrure", pro: "Porte claquée, serrure",
    icone: "M8 15a4 4 0 1 1 3.5-6L21 9v3h-2v2h-2v-2h-5.5A4 4 0 0 1 8 15z", metiers: null,
    questions: [
      { id: "quoi", label: "Que se passe-t-il ?", court: "Situation", options: ["Porte claquée", "Clé perdue ou volée", "Serrure bloquée", "Après une effraction"] },
      { id: "porte", label: "Quelle porte ?", court: "Porte", options: ["Standard", "Blindée", "Je ne sais pas"] }
    ]
  },
  {
    id: "eau_chaude", label: "Plus d'eau chaude", pro: "Plus d'eau chaude",
    icone: "M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4.5 2.5-7 1.5 1 2.5 2.5 2.5 4.5", metiers: ["Plombier", "Chauffagiste", "Tout corps d'etat"],
    questions: [
      { id: "appareil", label: "Quel appareil ?", court: "Appareil", options: ["Chauffe-eau électrique", "Chaudière", "Je ne sais pas"] },
      { id: "fuite", label: "Y a-t-il une fuite ?", court: "Fuite", options: ["Oui", "Non"] }
    ]
  },
  {
    id: "vitre", label: "Vitre cassée", pro: "Vitre cassée",
    icone: "M4 4h16v16H4zM4 12h16M12 4v16M14 6l-3 4 2 1-2 3", metiers: null,
    questions: [
      { id: "quoi", label: "Quelle vitre ?", court: "Vitre", options: ["Fenêtre", "Porte-fenêtre", "Porte d'entrée", "Vitrine"] },
      { id: "ouvert", label: "Le logement est-il ouvert sur l'extérieur ?", court: "Ouvert sur l'extérieur", options: ["Oui", "Non"] }
    ]
  }
];
// Ordre des puces côté artisan (maquette ordinateur).
export const ORDRE_PRO = ["fuite", "bouche", "eau_chaude", "electricite", "serrure", "vitre"];
export const categorieDe = (id) => CATEGORIES.find((c) => c.id === id) || null;

// Attribution (maquette) : les 3 plus proches, 60 secondes pour accepter,
// une vague de plus chaque minute ; à 3 minutes, tous les artisans
// disponibles de la zone ; à 5 minutes sans personne, la recherche s'arrête.
export const REGLES = { parVague: 3, fenetreS: 60, vagueS: 60, elargiS: 180, rechercheS: 300, confirmationS: 600, graceS: 10 };
export const RAYONS = [3, 5, 8, 10, 15, 20];
export const MAILLE_QUARTIER = 0.01; // ~1 km, même esprit que la maille du Radar

const ms = (iso) => Date.parse(iso || "") || 0;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const fini = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const minuscule = (t = "") => (t ? t.charAt(0).toLowerCase() + t.slice(1) : "");

// --- Heures de Paris -------------------------------------------------------
function decalageParis(date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const v = (t) => Number(p.find((x) => x.type === t)?.value);
  return Math.round((Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - date.getTime()) / 60000);
}
const jourParis = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));

// « 20:00 » → instant ISO de la prochaine fois qu'il est 20:00 à Paris ;
// null si l'heure est illisible ou à plus de 14 heures.
export function finDispo(hhmm, maintenant = new Date().toISOString()) {
  const m = /^(\d{1,2})[:h ]?(\d{2})?$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] || 0);
  if (h > 23 || mi > 59) return null;
  const now = ms(maintenant);
  for (let jour = 0; jour < 2; jour += 1) {
    const [y, mo, d] = jourParis(new Date(now + jour * 86400000).toISOString()).split("-").map(Number);
    const local = Date.UTC(y, mo - 1, d, h, mi);
    let t = local - decalageParis(new Date(local)) * 60000;
    t = local - decalageParis(new Date(t)) * 60000;
    if (t > now + 60000) return t - now > 14 * 3600000 ? null : new Date(t).toISOString();
  }
  return null;
}

// Heure proposée quand l'artisan se rend disponible : 20:00, ou une heure
// plus tard (arrondie au quart d'heure) s'il est déjà plus de 19:00.
export function heureParDefaut(maintenant = new Date().toISOString()) {
  const h = Number(heureParis(maintenant).slice(0, 2));
  if (h < 19 && h >= 6) return "20:00";
  const t = new Date(Math.ceil((ms(maintenant) + 3600000) / 900000) * 900000).toISOString();
  return heureParis(t);
}

// --- Lieux ---------------------------------------------------------------
// Quartier montré avant la confirmation : arrondissement à Paris, Lyon,
// Marseille ; sinon la commune. Jamais la rue.
export function quartierDe({ city = "", postcode = "" } = {}) {
  const cp = String(postcode || "");
  const ar = (n) => `${n === 1 ? "1er" : `${n}e`}`;
  if (/^75\d{3}$/.test(cp)) { const n = cp === "75116" ? 16 : Number(cp.slice(3)); if (n >= 1 && n <= 20) return `Paris ${ar(n)}`; }
  if (/^6900\d$/.test(cp)) { const n = Number(cp.slice(3)); if (n >= 1 && n <= 9) return `Lyon ${ar(n)}`; }
  if (/^130\d{2}$/.test(cp)) { const n = Number(cp.slice(3)); if (n >= 1 && n <= 16) return `Marseille ${ar(n)}`; }
  return String(city || "").trim();
}

export const positionQuartier = (lat, lon) => positionApprochee(lat, lon, MAILLE_QUARTIER);

// Temps de trajet estimé en ville (≈ 20 km/h et 3 min pour partir).
export function minutesTrajet(km) {
  return Math.max(5, Math.round(3 + (Number(km) || 0) * 3));
}
export const kmTexte = (km) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.round((Number(km) || 0) * 10) / 10)} km`;

// --- Réglages de l'artisan (db.urgencesPro[userId]) -----------------------
export function prixDe(reglages, categorie) {
  const p = Number(reglages?.prix?.[categorie]);
  return p > 0 ? r2(p) : 0;
}
export function demiHeureDe(reglages) {
  const p = Number(reglages?.demiHeure);
  return p > 0 ? r2(p) : 0;
}
export const zoneValide = (zone) => Boolean(zone && fini(zone.lat) && fini(zone.lon) && Number(zone.rayonKm) > 0);

export function dispoActive(reglages, maintenant = new Date().toISOString()) {
  return Boolean(reglages?.actif && ms(reglages.jusqua) > ms(maintenant) && zoneValide(reglages.zone) && demiHeureDe(reglages) > 0);
}

// Catégories qu'un artisan peut recevoir selon ses métiers déclarés.
export function categorieAutorisee(categorie, metiers = []) {
  const c = categorieDe(categorie);
  if (!c) return false;
  if (!c.metiers) return true;
  return (metiers || []).some((m) => c.metiers.includes(String(m)));
}

// Nettoie les réglages envoyés par l'artisan (prix TTC, rayon parmi RAYONS).
export function nettoyerReglages(corps = {}, metiers = []) {
  const prix = {};
  for (const c of CATEGORIES) {
    const v = Math.round(Number(String(corps.prix?.[c.id] ?? "").replace(",", ".")) * 100) / 100;
    if (v > 0 && v < 2000 && categorieAutorisee(c.id, metiers)) prix[c.id] = v;
  }
  const demiHeure = Math.round(Number(String(corps.demiHeure ?? "").replace(",", ".")) * 100) / 100;
  const rayonKm = RAYONS.includes(Number(corps.rayonKm)) ? Number(corps.rayonKm) : 8;
  return { prix, demiHeure: demiHeure > 0 && demiHeure < 1000 ? demiHeure : 0, rayonKm };
}

// --- Prix montré au particulier -------------------------------------------
// Avant qu'un artisan accepte : la fourchette des prix des artisans
// disponibles pour cette urgence à cette adresse (jamais un prix Koji).
// Après : le prix exact de l'artisan qui accepte, avant de confirmer.
export function fourchette(liste = []) {
  const d = liste.map((c) => Number(c.prix?.deplacement)).filter((x) => x > 0);
  const h = liste.map((c) => Number(c.prix?.demiHeure)).filter((x) => x > 0);
  if (!d.length || !h.length) return null;
  return { min: Math.min(...d), max: Math.max(...d), demiMin: Math.min(...h), demiMax: Math.max(...h), nombre: liste.length };
}
const plage = (a, b) => (a === b ? euros(a) : `${euros(a).replace(" €", "")} à ${euros(b)}`);
export function textePrix(f) {
  if (!f) return null;
  const unique = f.min === f.max && f.demiMin === f.demiMax;
  return {
    montant: `${plage(f.min, f.max)} TTC`,
    detail: `déplacement et première demi-heure${unique ? "" : " selon l'artisan"}, puis ${plage(f.demiMin, f.demiMax)} la demi-heure · les pièces sont sur devis, signé avant tout travail`,
    note: unique ? "" : "Vous voyez le prix exact de l'artisan qui accepte avant de confirmer."
  };
}
export function prixArtisanTexte(prix = {}) {
  return `${euros(prix.deplacement)} TTC, puis ${euros(prix.demiHeure)} la demi-heure`;
}

// --- Attribution ------------------------------------------------------------
// Artisans qui peuvent recevoir l'urgence, du plus proche au plus loin :
// disponibles, prix renseigné pour la catégorie, adresse dans leur rayon.
// [reglagesParPro] : { userId: réglages }.
export function candidats(urgence, reglagesParPro = {}, maintenant = new Date().toISOString()) {
  if (!fini(urgence?.lat) || !fini(urgence?.lon)) return [];
  const refuses = new Set((urgence.propositions || []).filter((p) => p.refuseeLe).map((p) => p.userId));
  const sortie = [];
  for (const [userId, r] of Object.entries(reglagesParPro || {})) {
    if (!dispoActive(r, maintenant) || refuses.has(userId) || userId === urgence.clientId) continue;
    const deplacement = prixDe(r, urgence.categorie);
    if (!deplacement) continue;
    const km = distanceKm(Number(r.zone.lat), Number(r.zone.lon), Number(urgence.lat), Number(urgence.lon));
    if (km > Number(r.zone.rayonKm)) continue;
    sortie.push({ userId, distanceKm: Math.round(km * 10) / 10, prix: { deplacement, demiHeure: demiHeureDe(r) } });
  }
  return sortie.sort((a, b) => a.distanceKm - b.distanceKm || a.userId.localeCompare(b.userId));
}

const debutRecherche = (u) => ms(u.rechercheDepuis || u.createdAt);
export const finProposition = (p) => ms(p.relanceeLe || p.le) + REGLES.fenetreS * 1000;
export function propositionActive(p, maintenant = new Date().toISOString(), grace = 0) {
  return Boolean(p && !p.refuseeLe && ms(maintenant) < finProposition(p) + grace * 1000);
}

// Fait avancer une urgence en recherche : nouvelles propositions dues à cet
// instant (vagues de 3, puis toute la zone), fin de recherche, délai de
// confirmation dépassé. Modifie [u] ; renvoie les propositions nouvelles
// (à notifier).
export function avancer(u, liste = [], maintenant = new Date().toISOString()) {
  const now = ms(maintenant);
  if (u.statut === "acceptee" && now > ms(u.artisan?.accepteLe) + REGLES.confirmationS * 1000) {
    u.statut = "expiree";
    u.expireeLe = maintenant;
    return [];
  }
  if (u.statut !== "recherche") return [];
  u.propositions = u.propositions || [];
  const ecoule = (now - debutRecherche(u)) / 1000;
  const elargie = ecoule >= REGLES.elargiS;
  const dus = elargie ? liste : liste.slice(0, REGLES.parVague * (Math.floor(ecoule / REGLES.vagueS) + 1));
  const nouvelles = [];
  for (const c of dus) {
    const p = u.propositions.find((x) => x.userId === c.userId);
    if (!p) {
      const n = { userId: c.userId, distanceKm: c.distanceKm, le: maintenant, refuseeLe: "", relanceeLe: "" };
      u.propositions.push(n);
      nouvelles.push(n);
    } else if (elargie && !p.refuseeLe && !p.relanceeLe && ms(p.le) < debutRecherche(u) + REGLES.elargiS * 1000 && !propositionActive(p, maintenant)) {
      p.relanceeLe = maintenant;
      nouvelles.push(p);
    }
  }
  if (ecoule >= REGLES.rechercheS && !u.propositions.some((p) => propositionActive(p, maintenant))) {
    u.statut = "sans_artisan";
    u.sansArtisanLe = maintenant;
  }
  return nouvelles;
}

// Combien d'artisans ont reçu l'urgence dans la vague de cet artisan.
export function nombreProposes(u) {
  return (u.propositions || []).length;
}

// L'artisan accepte : le premier gagne. Renvoie "" ou un message d'erreur.
export function accepter(u, { userId, minutes, prix, maintenant = new Date().toISOString() }) {
  if (u.statut !== "recherche") return u.artisan?.userId === userId ? "" : "Cette urgence a déjà été prise par un autre artisan.";
  const p = (u.propositions || []).find((x) => x.userId === userId);
  if (!p || !propositionActive(p, maintenant, REGLES.graceS)) return "Le délai pour accepter cette urgence est passé.";
  const min = Math.max(5, Math.min(180, Math.round(Number(minutes) || minutesTrajet(p.distanceKm))));
  u.statut = "acceptee";
  u.artisan = { userId, accepteLe: maintenant, minutes: min, arriveeVers: arriveeVers(min, maintenant), prix: { deplacement: r2(prix?.deplacement), demiHeure: r2(prix?.demiHeure) }, distanceKm: p.distanceKm };
  return "";
}

export function refuser(u, userId, maintenant = new Date().toISOString()) {
  const p = (u.propositions || []).find((x) => x.userId === userId);
  if (p && !p.refuseeLe) p.refuseeLe = maintenant;
}

// L'artisan qui a accepté se retire avant la confirmation : la recherche
// repart sans lui.
export function retirer(u, userId, maintenant = new Date().toISOString()) {
  if (u.statut !== "acceptee" || u.artisan?.userId !== userId) return "Rien à retirer.";
  refuser(u, userId, maintenant);
  u.retraits = [...(u.retraits || []), { userId, le: maintenant }];
  relancer(u, maintenant);
  return "";
}

// Nouvelle recherche (après « aucun artisan », un délai dépassé ou un
// retrait) : les refus restent, les autres reçoivent à nouveau l'urgence.
export function relancer(u, maintenant = new Date().toISOString()) {
  u.statut = "recherche";
  u.artisan = null;
  u.rechercheDepuis = maintenant;
  u.propositions = (u.propositions || []).filter((p) => p.refuseeLe);
  u.relances = (u.relances || 0) + 1;
}

// --- Vue du particulier -----------------------------------------------------
export function titreUrgence(u = {}) {
  const c = categorieDe(u.categorie);
  if (!c) return "Urgence";
  const premiere = u.reponses?.[c.questions[0].id];
  return premiere ? `${c.label} · ${minuscule(premiere)}` : c.label;
}
export function detailsUrgence(u = {}) {
  const c = categorieDe(u.categorie);
  if (!c) return [];
  return c.questions.filter((q) => u.reponses?.[q.id]).map((q) => ({ libelle: q.court, valeur: minuscule(u.reponses[q.id]) }));
}
export function nettoyerReponses(categorie, reponses = {}) {
  const c = categorieDe(categorie);
  const sortie = {};
  if (!c) return sortie;
  for (const q of c.questions) if (q.options.includes(reponses?.[q.id])) sortie[q.id] = reponses[q.id];
  return sortie;
}

// État vu par le particulier, d'après l'urgence et l'intervention (PRO-17.1)
// qui la suit une fois confirmée.
export function etatClient(u = {}, i = null) {
  if (u.statut !== "confirmee") return u.statut || "recherche";
  if (i?.annuleeLe) return "annulee";
  if (i?.termineeLe) return "terminee";
  if (i?.devis?.signeLe) return "devis_signe";
  if (i?.arriveLe) return "sur_place";
  if (i?.enRouteLe) return "en_route";
  return "confirmee";
}

// Les 4 étapes du suivi (maquette D) : Confirmée, En route, Sur place, Facture.
export function etapesSuivi(etat) {
  const rang = { confirmee: 1, en_route: 2, sur_place: 3, devis_signe: 3, terminee: 4 }[etat] || 0;
  return ["Confirmée", "En route", "Sur place", "Facture"].map((libelle, k) => ({ libelle, fait: k < rang }));
}

export function minutesRestantes(hhmmIso, maintenant = new Date().toISOString()) {
  const fin = ms(hhmmIso);
  if (!fin) return null;
  return Math.max(0, Math.round((fin - ms(maintenant)) / 60000));
}

// Ce que dit l'écran au particulier, selon l'état.
export function messageClient(etat, artisanPrenom = "L'artisan") {
  return {
    recherche: "Nous prévenons les artisans disponibles les plus proches. Le premier qui accepte vous est proposé ; vous confirmez ensuite.",
    acceptee: "Confirmez pour qu'il parte. Vous pouvez aussi annuler sans frais.",
    confirmee: `${artisanPrenom} a reçu votre adresse et vous prévient quand il part.`,
    en_route: `${artisanPrenom} est en route.`,
    sur_place: `${artisanPrenom} est sur place. Il vous fera signer un devis avant de commencer.`,
    devis_signe: "Devis signé, l'intervention est en cours.",
    terminee: "Intervention terminée.",
    annulee: "Urgence annulée, sans frais.",
    sans_artisan: "Aucun artisan disponible n'a pu accepter pour l'instant.",
    expiree: "Le délai pour confirmer est passé ; l'artisan a été libéré."
  }[etat] || "";
}

export const actionsClient = (etat, i = null) => ({
  confirmer: etat === "acceptee",
  annuler: ["recherche", "acceptee", "sans_artisan", "expiree"].includes(etat) || (["confirmee", "en_route"].includes(etat) && !i?.arriveLe),
  relancer: ["sans_artisan", "expiree"].includes(etat)
});

// Nom court de l'artisan montré au particulier : « Karim B. » si le prénom
// est connu, sinon le nom de l'entreprise.
export function nomCourt({ prenom = "", nom = "", entreprise = "" } = {}) {
  const p = String(prenom).trim();
  const n = String(nom).trim();
  if (p) return n ? `${p} ${n.charAt(0).toUpperCase()}.` : p;
  return String(entreprise || "").trim() || "L'artisan";
}
export function initiales(texte = "") {
  const mots = String(texte).replace(/[^\p{L}\s-]/gu, " ").split(/[\s-]+/).filter(Boolean);
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : (mots[0] || "K").slice(0, 2)).toUpperCase();
}
// « Mme L., Paris 10e » côté artisan, dans la liste des interventions.
export function clientCourt(nomClient = "", quartier = "") {
  const mots = String(nomClient).trim().split(/\s+/).filter(Boolean);
  const court = mots.length > 1 ? `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.` : mots[0] || "";
  return [court, quartier].filter(Boolean).join(", ");
}

// --- Chiffres du jour de l'artisan -----------------------------------------
// [miennes] : urgences confirmées de l'artisan ; [interventions] et
// [factures] : ses données (pour l'heure d'arrivée et le montant facturé).
export function chiffresDuJour(miennes = [], interventions = [], factures = [], maintenant = new Date().toISOString()) {
  const jour = jourParis(maintenant);
  const duJour = miennes.filter((u) => u.confirmeeLe && jourParis(u.confirmeeLe) === jour);
  const parId = new Map(interventions.map((i) => [i.id, i]));
  const facturesParId = new Map(factures.map((f) => [f.id, f]));
  let facture = 0;
  const arrivees = [];
  for (const u of duJour) {
    const i = parId.get(u.interventionId);
    if (!i || i.annuleeLe) continue;
    const f = i.invoiceId ? facturesParId.get(i.invoiceId) : null;
    if (f) facture += Number(f.amountTtc) || 0;
    if (i.arriveLe) arrivees.push((ms(i.arriveLe) - ms(u.confirmeeLe)) / 60000);
  }
  const moyenne = arrivees.length ? Math.round(arrivees.reduce((a, b) => a + b, 0) / arrivees.length) : null;
  return { urgences: duJour.filter((u) => !parId.get(u.interventionId)?.annuleeLe).length, facture: r2(facture), factureTexte: euros(facture), arriveeMoyenne: moyenne, arriveeTexte: moyenne === null ? "—" : `${moyenne} min` };
}

// « 10:18 », « Hier 18:40 », « 28 oct. ».
export function quandListe(iso, maintenant = new Date().toISOString()) {
  if (!iso) return "";
  const j = jourParis(iso);
  const auj = jourParis(maintenant);
  const ecart = Math.round((Date.parse(auj) - Date.parse(j)) / 86400000);
  if (ecart <= 0) return heureParis(iso);
  if (ecart === 1) return `Hier ${heureParis(iso)}`;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(new Date(iso));
}

// Étiquette de la liste des interventions (maquette ordinateur).
export function statutListe(u = {}, i = null, f = null) {
  if (u.statut === "annulee" || i?.annuleeLe) return { texte: u.annuleePar === "artisan" ? "Annulée" : "Annulée par le client", genre: "muet" };
  if (i?.termineeLe) return f?.status === "Payee" ? { texte: "Payé", genre: "valide" } : { texte: "À encaisser", genre: "attente" };
  if (i?.devis?.signeLe || i?.arriveLe) return { texte: "Sur place", genre: "encours" };
  if (i?.enRouteLe) return { texte: "En route", genre: "encours" };
  return { texte: "Confirmée", genre: "encours" };
}

// --- Photo du particulier ---------------------------------------------------
// Retire d'un JPEG les blocs APP1 à APP15 et les commentaires : la position
// GPS d'une photo de téléphone ne doit pas révéler l'adresse avant la
// confirmation. Renvoie null si ce n'est pas un JPEG lisible.
export function sansExif(octets) {
  const b = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const morceaux = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marqueur = b[i + 1];
    if (marqueur === 0xd9) { morceaux.push(b.subarray(i, i + 2)); i += 2; break; }
    const longueur = (b[i + 2] << 8) | b[i + 3];
    if (longueur < 2 || i + 2 + longueur > b.length) return null;
    const fin = i + 2 + longueur;
    if (marqueur === 0xda) { morceaux.push(b.subarray(i)); i = b.length; break; }
    const aRetirer = (marqueur >= 0xe1 && marqueur <= 0xef) || marqueur === 0xfe;
    if (!aRetirer) morceaux.push(b.subarray(i, fin));
    i = fin;
  }
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  const sortie = new Uint8Array(total);
  let k = 0;
  for (const m of morceaux) { sortie.set(m, k); k += m.length; }
  return sortie;
}
