// Jetons et positions du Radar des chantiers (maquette PRO-04, décision du
// 14 novembre : jetons réels, achat par Stripe). Barème de la page Tarifs
// (app/entreprise/tarifs/TarifsPage.jsx) :
// - inclus chaque mois : Start 0, Pro 3, Business 10 ;
// - jeton supplémentaire : 15 / 10 / 8 € HT ;
// - prix d'un chantier selon son budget estimé par Koji : moins de 1 500 €
//   → 1 jeton, 1 500 à 8 000 € → 3, plus de 8 000 € → 6.
// Réservés au positionnement, débités seulement quand le client confirme un
// rendez-vous, rendus sinon (7 jours sans réponse du client, demande
// retirée ou expirée, position retirée, client qui choisit une autre
// entreprise). 3 entreprises au plus par chantier ; un chantier quitte le
// Radar 15 jours après sa publication.
import { hasConfirmedRdv } from "./rdv.js";

export const PLACES_MAX = 3;
export const REPONSE_JOURS = 7;
export const EXPIRATION_JOURS = 15;
export const JETONS_INCLUS = { start: 0, pro: 3, business: 10 };
export const PRIX_JETON_HT = { start: 15, pro: 10, business: 8 };
export const RAISONS_PAS_INTERESSE = ["Trop loin", "Prix trop bas", "Pas mon métier", "Pas disponible", "Accès difficile", "Autre"];

const JOUR = 86400000;
const t = (v) => new Date(v || 0).getTime();

// Palier des jetons : les anciens abonnés (active, subscribed) sont Pro.
export function palierJetons(plan, isAdmin = false) {
  if (isAdmin || plan === "business") return "business";
  if (plan === "pro" || plan === "active" || plan === "subscribed") return "pro";
  return "start";
}

// Prix d'un chantier en jetons, d'après le budget estimé par Koji (TTC).
// Sans estimation : barème du milieu.
export function jetonsPourMontant(ttc) {
  const m = Number(ttc) || 0;
  if (m <= 0) return 3;
  if (m < 1500) return 1;
  if (m <= 8000) return 3;
  return 6;
}

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Heure de Paris sans dépendre du serveur : été du dernier dimanche de
// mars au dernier dimanche d'octobre (1 h UTC).
function dernierDimanche(annee, mois) {
  const d = new Date(Date.UTC(annee, mois + 1, 0));
  return Date.UTC(annee, mois, d.getUTCDate() - d.getUTCDay(), 1);
}
export function paris(iso) {
  const ms = t(iso);
  const annee = new Date(ms).getUTCFullYear();
  const ete = ms >= dernierDimanche(annee, 2) && ms < dernierDimanche(annee, 9);
  return new Date(ms + (ete ? 2 : 1) * 3600000);
}
const heure = (d) => `${d.getUTCHours()} h${d.getUTCMinutes() ? ` ${String(d.getUTCMinutes()).padStart(2, "0")}` : ""}`;
export const jourCourt = (iso) => { const d = paris(iso); return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`; };
export const creneauCourt = (iso) => { const d = paris(iso); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${heure(d)}`; };
export const creneauLong = (iso) => { const d = paris(iso); return `${JOURS_LONGS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_LONGS[d.getUTCMonth()]}, ${heure(d)}`; };

// Le rendez-vous confirmé du fil : la proposition acceptée par le client.
export function rdvConfirme(messages, offerId, entrepriseUserId) {
  const fil = (messages || []).filter((m) => m.offerId === offerId && m.entrepriseUserId === entrepriseUserId);
  const reponse = fil.filter((m) => m.kind === "rdv_response" && m.rdvStatus === "accepted").sort((a, b) => t(a.createdAt) - t(b.createdAt))[0];
  if (!reponse) return null;
  const proposition = fil.find((m) => m.id === reponse.respondsToId);
  return { le: reponse.createdAt, rdvDate: proposition?.rdvDate || "" };
}

// Où en est une position, et ses jetons. Calculé à la lecture : aucune
// tâche planifiée, la date de retour se déduit des règles.
export function etatPosition(pos, { offre, messages = [], maintenant = new Date().toISOString() } = {}) {
  const n = Number(pos.jetons) || 0;
  const rdv = rdvConfirme(messages, pos.offerId, pos.entrepriseUserId);
  const proposeLe = pos.createdAt;
  if (rdv) {
    return {
      etat: "rdv", libelle: "RDV confirmé", termine: false, rdvDate: rdv.rdvDate,
      etape: rdv.rdvDate ? `Visite confirmée ${creneauCourt(rdv.rdvDate)}` : "Visite confirmée",
      jetons: { n, etat: "debites", le: rdv.le, texte: `${pluriel(n, "jeton débité", "jetons débités")}` }
    };
  }
  const rendu = (etat, libelle, etape, le) => ({
    etat, libelle, etape, termine: true,
    jetons: { n, etat: "rendus", le, texte: `${pluriel(n, "jeton rendu", "jetons rendus")}` }
  });
  if (pos.status === "Retiree") return rendu("retire", "Retirée", "Vous avez retiré votre position", pos.retireLe || proposeLe);
  if (offre?.status === "Retiree") return rendu("retiree", "Retirée", "Le client a retiré sa demande", offre.retireeLe || offre.updatedAt || proposeLe);
  if (offre?.attribueeA && offre.attribueeA !== pos.entrepriseUserId) {
    return rendu("non-retenu", "Non retenu", "Le client a choisi une autre entreprise", offre.attribueeLe || proposeLe);
  }
  const fil = (messages || []).filter((m) => m.offerId === pos.offerId && m.entrepriseUserId === pos.entrepriseUserId);
  const reponduLe = fil.filter((m) => m.senderType === "particulier" && t(m.createdAt) >= t(proposeLe)).map((m) => m.createdAt).sort()[0];
  const finReponse = t(proposeLe) + REPONSE_JOURS * JOUR;
  const finOffre = t(offre?.publishedAt || offre?.createdAt) + EXPIRATION_JOURS * JOUR;
  const now = t(maintenant);
  if (!reponduLe && now >= finReponse) {
    return rendu("expiree", "Expirée", "Expirée · aucune réponse du client", new Date(finReponse).toISOString());
  }
  if (offre && now >= finOffre) {
    return rendu("expiree", "Expirée", "Chantier expiré · aucun rendez-vous confirmé", new Date(finOffre).toISOString());
  }
  const vue = fil.some((m) => m.senderType === "particulier") || pos.vueLe;
  return {
    etat: "attente", libelle: "En attente", termine: false,
    etape: reponduLe ? "Le client a répondu · en attente d'un rendez-vous" : vue ? "Proposition vue · en attente" : `Proposition envoyée le ${jourCourt(proposeLe)} · en attente`,
    jetons: {
      n, etat: "reserves", le: proposeLe,
      rendusLe: reponduLe ? new Date(finOffre).toISOString() : new Date(finReponse).toISOString(),
      texte: `${pluriel(n, "jeton réservé", "jetons réservés")} · rendus le ${jourCourt(reponduLe ? new Date(finOffre).toISOString() : new Date(finReponse).toISOString())} sans ${reponduLe ? "rendez-vous" : "réponse"}`
    }
  };
}

// Positions de l'entreprise avec leur état.
export function positionsAvecEtat(db, entrepriseUserId, maintenant) {
  const offres = new Map((db.chantierOffres || []).map((o) => [o.id, o]));
  return (db.chantierPositionnements || [])
    .filter((p) => p.entrepriseUserId === entrepriseUserId && Number(p.jetons) > 0)
    .map((p) => ({ pos: p, offre: offres.get(p.offerId), ...etatPosition(p, { offre: offres.get(p.offerId), messages: db.chantierOffreMessages, maintenant }) }));
}

// Solde : jetons inclus du mois (débits du mois d'abord pris dessus), puis
// jetons achetés, moins les jetons réservés.
export function soldeJetons({ palier = "start", positions = [], achats = [], maintenant = new Date().toISOString() } = {}) {
  const inclus = JETONS_INCLUS[palier] ?? 0;
  const mois = (iso) => paris(iso).toISOString().slice(0, 7);
  const ceMois = mois(maintenant);
  const debitsParMois = new Map();
  let reserves = 0;
  for (const p of positions) {
    if (p.jetons?.etat === "debites") debitsParMois.set(mois(p.jetons.le), (debitsParMois.get(mois(p.jetons.le)) || 0) + p.jetons.n);
    if (p.jetons?.etat === "reserves") reserves += p.jetons.n;
  }
  const achetes = achats.reduce((s, a) => s + (Number(a.quantite) || 0), 0);
  let achetesUtilises = 0;
  for (const [m, d] of debitsParMois) achetesUtilises += Math.max(0, d - (m === ceMois || m < ceMois ? inclus : 0));
  const debitesMois = debitsParMois.get(ceMois) || 0;
  const inclusRestants = Math.max(0, inclus - debitesMois);
  const achetesRestants = Math.max(0, achetes - achetesUtilises);
  return {
    palier, inclus, achetes, reserves, debitesMois,
    solde: Math.max(0, inclusRestants + achetesRestants - reserves)
  };
}

// Places prises sur un chantier : positions en attente ou avec rendez-vous.
export function placesPrises(db, offre, maintenant) {
  return (db.chantierPositionnements || [])
    .filter((p) => p.offerId === offre.id && p.status === "Active")
    .map((p) => etatPosition(p, { offre, messages: db.chantierOffreMessages, maintenant }))
    .filter((e) => e.etat === "attente" || e.etat === "rdv").length;
}

export function offreExpiree(offre, maintenant) {
  return t(maintenant) >= t(offre.publishedAt || offre.createdAt) + EXPIRATION_JOURS * JOUR;
}

// Indicateurs de « Mes positions » : solde, réservés, débités, taux de visite.
export function indicateurs(positions, solde) {
  const total = positions.length;
  const visites = positions.filter((p) => p.etat === "rdv").length;
  return {
    solde: solde.solde,
    reserves: solde.reserves,
    debitesMois: solde.debitesMois,
    tauxVisite: total ? Math.round((visites / total) * 100) : 0,
    positionsMois: positions.filter((p) => paris(p.pos.createdAt).toISOString().slice(0, 7) === paris(new Date().toISOString()).toISOString().slice(0, 7)).length
  };
}

// Créneaux de visite proposés, tirés du calendrier : les prochains jours
// ouvrés (samedi compris), à des heures qui ne chevauchent aucun
// rendez-vous (1 h 30 autour).
const HEURES = [[14, 0], [8, 30], [17, 0], [10, 0]];
export function creneauxProposes(evenements = [], maintenant = new Date().toISOString(), combien = 4) {
  const occupes = evenements.map((e) => [t(e.startAt), t(e.endAt || e.startAt)]);
  const libre = (debut) => !occupes.some(([a, b]) => debut < b + 90 * 60000 && debut + 90 * 60000 > a);
  const out = [];
  const base = paris(maintenant);
  let jour = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  for (let i = 0; out.length < combien && i < 21; i += 1) {
    jour += JOUR;
    const d = new Date(jour);
    if (d.getUTCDay() === 0) continue;
    const [h, m] = HEURES[out.length % HEURES.length];
    // Heure de Paris → UTC.
    const local = jour + (h * 60 + m) * 60000;
    const decalage = paris(new Date(local).toISOString()).getTime() - local;
    const debut = local - decalage;
    if (libre(debut)) out.push(new Date(debut).toISOString());
  }
  return out;
}

// Message proposé au client (modifiable avant l'envoi).
export function messagePositionnement({ prenom = "", entreprise = "", metier = "", ville = "" } = {}) {
  const qui = [prenom ? `je suis ${prenom}` : "", entreprise ? `${prenom ? "d'" : "de l'entreprise "}${entreprise}` : ""].filter(Boolean).join(", ");
  const travaux = metier ? ` des travaux de ${metier.toLowerCase()}` : " des chantiers comme le vôtre";
  return `Bonjour${qui ? `, ${qui}` : ""}. Nous réalisons régulièrement${travaux}${ville ? ` à ${ville}` : ""}. Je vous propose une visite pour valider l'accès et l'état de l'existant, puis un devis détaillé sous 48 h.`;
}
