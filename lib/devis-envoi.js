// Envoyer le devis (maquette PRO-03.2) : les réglages du panneau et les
// textes proposés. Mêmes règles dans l'app Koji Pro
// (mobile/lib/apps/entreprise/devis/devis_envoi.dart, mêmes exemples dans
// les tests). Les valeurs viennent du devis (réglages du compte par défaut)
// et restent modifiables ici.

export const VALIDITES = [15, 30, 45, 60, 90];
export const ACOMPTES = [0, 10, 20, 30, 40, 50];
export const TAUX_TVA = [20, 10, 5.5];

// Règlement du solde : la fin du libellé « Solde — … » de la 2e échéance.
export const REGLEMENTS = [
  { solde: "à la réception des travaux", libelle: "Solde à la réception" },
  { solde: "par situations mensuelles, à 30 jours", libelle: "Situation mensuelle, 30 jours" },
  { solde: "à 30 jours après la réception", libelle: "Solde à 30 jours de la réception" }
];

const JOUR = 86400000;
const jourDe = (v) => String(v || "").slice(0, 10);

function plus(jour, n) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() + n * JOUR).toISOString().slice(0, 10) : "";
}

function date(jour, options) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(d) : "";
}

const court = (jour) => date(jour, { day: "numeric", month: "short" });
const long = (jour) => date(jour, { day: "numeric", month: "long" });

function euros(n) {
  const centimes = Math.round(Math.abs(Number(n) || 0) * 100);
  const entier = String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${entier},${String(centimes % 100).padStart(2, "0")} €`;
}

const pourcent = (n) => `${String(Number(n) || 0).replace(".", ",")} %`;

// « 30 jours · jusqu'au 27 nov. » (la validité court depuis l'envoi).
export function libelleValidite(jours, aujourdhui) {
  const n = Number(jours) || 30;
  const fin = plus(aujourdhui, n);
  return fin ? `${n} jours · jusqu'au ${court(fin)}` : `${n} jours`;
}

// « 30 % · 1 739,56 € TTC ».
export function libelleAcompte(pct, totalTtc) {
  const p = Number(pct) || 0;
  if (p <= 0) return "Sans acompte";
  return `${pourcent(p)} · ${euros((Number(totalTtc) || 0) * p / 100)} TTC`;
}

export function soldeDe(labelEcheance) {
  return String(labelEcheance || "").replace(/^Solde(\s*—\s*)?/i, "").trim() || REGLEMENTS[0].solde;
}

export function libelleReglement(labelEcheance) {
  const solde = soldeDe(labelEcheance);
  const connu = REGLEMENTS.find((r) => r.solde === solde);
  return connu ? connu.libelle : `Solde ${solde}`;
}

// TVA réduite : 10 % et 5,5 % demandent la mention certifiée par le client.
export function libelleTva(taux) {
  const t = Number(taux);
  if (t === 10 || t === 5.5) return `${pourcent(t)} · mention certifiée par le client`;
  if (t === 20) return "20 % · taux normal";
  return pourcent(t);
}

// « Devis_2026-041_Lefèvre.pdf » : le nom de famille du client.
export function nomFichierDevis(numero, client) {
  const mots = String(client || "").replace(/[\\/:*?"<>|]/g, " ").trim().split(/\s+/).filter(Boolean);
  const nom = mots.length ? mots[mots.length - 1] : "";
  return ["Devis", String(numero || "").replace(/[\\/:*?"<>|\s]+/g, "-"), nom].filter(Boolean).join("_") + ".pdf";
}

// Message proposé au client, modifiable.
export function messageEnvoi({ client = "", projet = "", debut = "" } = {}) {
  const bonjour = `Bonjour${client ? ` ${client}` : ""},`;
  const devis = `voici le devis${projet ? ` pour « ${projet} »` : ""}.`;
  const dispo = `Je reste disponible pour en parler${debut && long(debut) ? `, et je peux démarrer le ${long(debut)}` : ""}.`;
  return `${bonjour} ${devis} ${dispo}`;
}

export function resumePdf(lignes, lots) {
  const l = Number(lignes) || 0;
  const n = Number(lots) || 0;
  return `${l} ligne${l > 1 ? "s" : ""} · ${n} lot${n > 1 ? "s" : ""} · mentions légales et conditions de paiement`;
}

// Ce qui manque pour envoyer, ou "".
export function erreurEnvoi({ kojiClient, email, sms, adresse, telephone }) {
  if (!kojiClient && !email && !sms) return "Choisis au moins une façon d'envoyer le devis.";
  if (email && !String(adresse || "").trim()) return "Ajoute l'e-mail du client pour l'envoi par e-mail.";
  if (sms && !String(telephone || "").replace(/[^\d]/g, "")) return "Ajoute le téléphone du client pour le SMS.";
  if (kojiClient && !email && !sms) return "Le lien de signature part par e-mail ou par SMS : coche l'un des deux.";
  return "";
}

// Texte du SMS : le message, puis le lien et les identifiants de signature.
export function texteSms({ message = "", lien = "", identifiant = "", motDePasse = "", kojiClient = true } = {}) {
  return [
    message,
    kojiClient && lien ? `Lien : ${lien}` : "",
    kojiClient && identifiant ? `Identifiant : ${identifiant}${motDePasse ? ` · Mot de passe : ${motDePasse}` : ""}` : ""
  ].filter(Boolean).join("\n");
}
