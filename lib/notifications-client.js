// Koji Client · notifications et messages (maquettes CLI-03, CLI-04).
// Règles pures : quelles notifications concernent le particulier, leur
// rangement par jour (heure de Paris), l'action réelle de chaque
// notification et les heures courtes des listes et des bulles.
// Aucun prix calculé par Koji n'est jamais ajouté (décision du 10 novembre).

// Ce que Koji envoie aujourd'hui au particulier (types ci-dessous) ; pas
// encore d'envoi par e-mail ni de notification sur le téléphone.
export const CE_QUE_KOJI_ENVOIE = "Une entreprise qui répond à votre demande, un message, une réponse sur votre chantier, son démarrage, un ouvrage à valider. Jamais de publicité.";
export const OU_LES_RETROUVER = "Ici et sur la cloche, en haut de l'écran. Koji ne les envoie pas encore par e-mail ni sur le téléphone.";

export const TYPES_CLIENT = new Set(["company.reply", "task.started", "task.pending_validation", "radar.message", "radar.positionnement"]);

export const estPourClient = (n = {}) => !n.archived && (TYPES_CLIENT.has(n.type) || n.accountType === "particulier");

const JOUR_MS = 86400000;
const jourParis = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
const heureParis = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const jourSemaine = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date(iso));
const jourMois = (iso, avecAnnee) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", ...(avecAnnee ? { year: "numeric" } : {}) }).format(new Date(iso));
const valide = (iso) => Boolean(iso) && !Number.isNaN(new Date(iso).getTime());

// Écart en jours calendaires (Paris) entre deux instants.
export function joursEcoules(iso, maintenant = new Date().toISOString()) {
  if (!valide(iso)) return Infinity;
  return Math.round((Date.parse(jourParis(maintenant)) - Date.parse(jourParis(iso))) / JOUR_MS);
}

// « Aujourd'hui », « Hier », « Cette semaine », « Plus ancien ».
export function libelleJour(iso, maintenant) {
  const n = joursEcoules(iso, maintenant);
  if (n <= 0) return "Aujourd'hui";
  if (n === 1) return "Hier";
  if (n < 7) return "Cette semaine";
  return "Plus ancien";
}

// Groupes dans l'ordre, du plus récent au plus ancien.
export function parJour(notifications = [], maintenant = new Date().toISOString()) {
  const tries = [...notifications].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const groupes = [];
  for (const n of tries) {
    const jour = libelleJour(n.createdAt, maintenant);
    const dernier = groupes[groupes.length - 1];
    if (dernier?.jour === jour) dernier.notifications.push(n);
    else groupes.push({ jour, notifications: [n] });
  }
  return groupes;
}

// Heure d'une ligne de notification : l'heure aujourd'hui et hier (le
// groupe dit déjà le jour), le jour de la semaine, puis la date.
export function heureNotification(iso, maintenant = new Date().toISOString()) {
  if (!valide(iso)) return "";
  const n = joursEcoules(iso, maintenant);
  if (n <= 1) return heureParis(iso);
  if (n < 7) return jourSemaine(iso);
  return jourMois(iso, jourParis(iso).slice(0, 4) !== jourParis(maintenant).slice(0, 4));
}

// Heure d'un fil dans la liste des messages : « 07:52 », « hier », « lun. », « 28 oct. ».
export function heureFil(iso, maintenant = new Date().toISOString()) {
  if (!valide(iso)) return "";
  const n = joursEcoules(iso, maintenant);
  if (n <= 0) return heureParis(iso);
  if (n === 1) return "hier";
  if (n < 7) return jourSemaine(iso);
  return jourMois(iso, jourParis(iso).slice(0, 4) !== jourParis(maintenant).slice(0, 4));
}

// Heure sous une bulle : « 07:52 », « hier 18:42 », « lun. 18:42 », « 28 oct. 18:42 ».
export function heureBulle(iso, maintenant = new Date().toISOString()) {
  if (!valide(iso)) return "";
  const n = joursEcoules(iso, maintenant);
  const h = heureParis(iso);
  if (n <= 0) return h;
  if (n === 1) return `hier ${h}`;
  if (n < 7) return `${jourSemaine(iso)} ${h}`;
  return `${jourMois(iso, jourParis(iso).slice(0, 4) !== jourParis(maintenant).slice(0, 4))} ${h}`;
}

// « 9 h 12 » aujourd'hui, « hier 18:30 »… pour le sous-titre du détail.
export function quandDetail(iso, maintenant = new Date().toISOString()) {
  if (!valide(iso)) return "";
  const n = joursEcoules(iso, maintenant);
  if (n <= 0) return `aujourd'hui ${heureParis(iso)}`;
  return heureBulle(iso, maintenant);
}

export const cleFil = (offerId, entrepriseUserId) => `${offerId || ""}:${entrepriseUserId || ""}`;

// Lien interne seulement (jamais une adresse externe venue des données).
const lienInterne = (url) => (typeof url === "string" && /^\/client(\/|$|\?)/.test(url) ? url : "");

// Ce que le détail propose : un bouton principal vers l'action réelle et,
// si un fil existe avec cette entreprise, « Poser une question ».
// filsExistants : Set des clés « offre:entreprise » des conversations.
export function actionsNotification(n = {}, filsExistants = new Set()) {
  const fil = n.offerId && n.entrepriseUserId ? cleFil(n.offerId, n.entrepriseUserId) : "";
  const avecFil = fil && filsExistants.has(fil);
  const question = avecFil ? { libelle: "Poser une question à l'entreprise", lien: `/client/messages?fil=${encodeURIComponent(fil)}` } : null;
  const propre = lienInterne(n.actionUrl);
  if (propre) return { principale: { libelle: n.actionLabel || "Ouvrir", lien: propre }, question };
  if (n.type === "radar.message" && avecFil) {
    return { principale: { libelle: "Lire le message", lien: `/client/messages?fil=${encodeURIComponent(fil)}` }, question: null };
  }
  if (n.type === "radar.positionnement" && n.offerId) {
    return { principale: { libelle: "Voir les propositions", lien: `/client/projet/${encodeURIComponent(n.offerId)}` }, question };
  }
  if (n.offerId) return { principale: { libelle: "Voir le projet", lien: `/client/projet/${encodeURIComponent(n.offerId)}` }, question };
  if (n.quoteId) {
    const libelle = n.type === "task.pending_validation" ? "Voir l'ouvrage à valider" : "Voir le chantier";
    return { principale: { libelle, lien: `/client/chantier/${encodeURIComponent(n.quoteId)}` }, question };
  }
  return { principale: { libelle: "Voir mes projets", lien: "/client" }, question };
}

// Libellé court de la barre du détail (téléphone).
export function titreCourt(n = {}) {
  if (n.type === "radar.message") return "Message";
  if (n.type === "radar.positionnement") return "Proposition";
  if (n.type === "company.reply") return "Réponse de l'entreprise";
  if (n.type === "task.started") return "Chantier";
  if (n.type === "task.pending_validation") return "À valider";
  return "Notification";
}

// Famille d'icône (tracés de la maquette).
export function iconeNotification(type = "") {
  if (type === "radar.message" || type === "company.reply") return "message";
  if (type === "radar.positionnement") return "lieu";
  if (type === "task.pending_validation") return "drapeau";
  if (type.startsWith("task.")) return "chantier";
  if (type.includes("paiement") || type.includes("facture")) return "paiement";
  if (type.includes("visite") || type.includes("rdv")) return "agenda";
  if (type.includes("devis")) return "devis";
  return "cloche";
}
