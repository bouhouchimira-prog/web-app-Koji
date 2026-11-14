// Signature et rétractation (maquette PRO-03.7) : ce que Koji applique
// selon le lieu de signature, pour un client particulier. Mêmes règles dans
// l'app Koji Pro (mobile/lib/apps/entreprise/devis/signature_lieu.dart,
// mêmes exemples dans les tests). Textes à faire relire par un avocat.
//
// Hors établissement (au domicile) : 14 jours de rétractation à partir de
// la signature (C. consom. L221-18), information et formulaire obligatoires,
// aucun paiement avant 7 jours (L221-10), démarrage anticipé sur demande
// expresse (L221-25). En ligne (à distance) : 14 jours aussi, paiement
// possible. Dans les locaux de l'entreprise : pas de rétractation. Client
// professionnel : pas de rétractation. Un délai qui finit un samedi, un
// dimanche ou un jour férié est reporté au jour ouvrable suivant.
import { estOuvre } from "./planning-chantier.js";

export const LIEUX_SIGNATURE = [
  { id: "en-ligne", label: "En ligne" },
  { id: "domicile", label: "Chez le client" },
  { id: "locaux", label: "Dans vos locaux" }
];

export const RETRACTATION_JOURS = 14;
export const SANS_PAIEMENT_JOURS = 7;

const JOUR = 86400000;
const jourDe = (v) => String(v || "").slice(0, 10);

export function plusJours(jour, n) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() + n * JOUR).toISOString().slice(0, 10) : "";
}

function long(jour) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" }).format(d) : "";
}

function court(jour) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

export const estProfessionnel = (clientType) => clientType === "societe";

// Règles par lieu (tableau « Ce que Koji applique selon le lieu »).
export function reglesSignature(lieu, clientType = "particulier") {
  if (estProfessionnel(clientType)) {
    return { retractation: false, paiementAvant7Jours: "possible", formulaire: false, demarrageAvantFin: "libre" };
  }
  if (lieu === "locaux") return { retractation: false, paiementAvant7Jours: "possible", formulaire: false, demarrageAvantFin: "libre" };
  if (lieu === "domicile") return { retractation: true, paiementAvant7Jours: "interdit", formulaire: true, demarrageAvantFin: "demande-expresse" };
  return { retractation: true, paiementAvant7Jours: "possible", formulaire: true, demarrageAvantFin: "demande-expresse" };
}

// Dernier jour pour se rétracter (inclus), ou "".
export function finRetractation(jourSignature, lieu, clientType = "particulier") {
  if (!reglesSignature(lieu, clientType).retractation || !jourSignature) return "";
  let fin = plusJours(jourSignature, RETRACTATION_JOURS);
  for (let i = 0; i < 10 && !estOuvre(fin); i += 1) fin = plusJours(fin, 1);
  return fin;
}

// Premier jour où l'acompte peut être demandé, ou "" s'il n'y a pas
// d'attente (signé au domicile : aucun paiement avant 7 jours).
export function acompteAPartirDu(jourSignature, lieu, clientType = "particulier") {
  if (reglesSignature(lieu, clientType).paiementAvant7Jours !== "interdit" || !jourSignature) return "";
  return plusJours(jourSignature, SANS_PAIEMENT_JOURS + 1);
}

export function demarrageAvantFin(debut, fin) {
  return Boolean(debut && fin && jourDe(debut) <= fin);
}

// « Décaler au lundi 16 nov. » : premier lundi après la fin du délai.
export function lundiApres(fin) {
  let j = plusJours(fin, 1);
  for (let i = 0; i < 7 && new Date(`${j}T12:00:00Z`).getUTCDay() !== 1; i += 1) j = plusJours(j, 1);
  return j;
}

export function libelleLundi(jour) {
  return `lundi ${court(jour)}`;
}

// Textes lus par le client avant de signer.
export function texteRetractation(fin) {
  return `Vous pouvez annuler sans motif jusqu'au ${long(fin)} inclus, avec le formulaire joint ou depuis votre espace Koji. Les sommes versées sont remboursées sous 14 jours.`;
}

export function texteDemandeExpresse(debut) {
  return `Je demande que les travaux commencent le ${long(debut)}, avant la fin du délai de rétractation. Si je me rétracte ensuite, je paierai les travaux déjà réalisés.`;
}

export function texteAcompte(pct, montantTtc, aPartirDu) {
  const centimes = Math.round(Math.abs(Number(montantTtc) || 0) * 100);
  const m = `${String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${String(centimes % 100).padStart(2, "0")} €`;
  return `Acompte ${pct} % : ${m}${aPartirDu ? `, demandé à partir du ${long(aPartirDu)}` : ""}`;
}

// « s••••.k@••••.fr » : l'e-mail lisible par le client, masqué à l'écran.
export function masquerEmail(email) {
  const [nom, domaine] = String(email || "").split("@");
  if (!nom || !domaine) return "";
  const ext = domaine.includes(".") ? domaine.slice(domaine.lastIndexOf(".")) : "";
  const finNom = nom.length > 2 ? nom.slice(-2) : "";
  return `${nom[0]}••••${finNom}@••••${ext}`;
}

export const INFORMATION_RETRACTATION = "Droit de rétractation : vous disposez d'un délai de quatorze jours à compter de la signature du présent devis pour exercer votre droit de rétractation, sans avoir à motiver votre décision ni à supporter d'autres coûts que ceux prévus par la loi. Pour l'exercer, notifiez-nous votre décision par une déclaration dénuée d'ambiguïté, par exemple au moyen du formulaire ci-dessous. Les sommes versées vous seront remboursées au plus tard quatorze jours après réception de votre décision. Si vous avez demandé que les travaux commencent pendant le délai, vous paierez un montant proportionnel aux travaux réalisés jusqu'à votre rétractation.";

export function formulaireRetractation({ entreprise = "", adresse = "", email = "" } = {}) {
  return [
    "Formulaire de rétractation",
    "(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)",
    `À l'attention de ${[entreprise, adresse, email].filter(Boolean).join(", ") || "l'entreprise"} :`,
    "Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous :",
    "Devis n° : ..................   Signé le : ..................",
    "Nom du client : ..................",
    "Adresse du client : ..................",
    "Signature du client (uniquement en cas de notification sur papier) :",
    "Date : .................."
  ];
}
