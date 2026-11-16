// Après l'envoi (maquette PRO-03.3) : suivi Envoyé → Vu → Signé → Chantier
// lancé, la note sous le suivi, les conditions envoyées et la version lue.
// Mêmes règles dans l'app Koji Pro (mobile/lib/apps/entreprise/devis/
// devis_suivi.dart, mêmes exemples dans les tests). Pas de relance
// automatique : Koji indique le jour où relancer (7 jours après l'envoi ou
// la dernière relance), l'entreprise relance d'un clic.
import { RELANCE_JOURS, finValidite, statutDevis } from "./devis-liste.js";
import { libelleReglement, soldeDe } from "./devis-envoi.js";
import { finRetractation } from "./signature-lieu.js";

export const RETRACTATION_JOURS = 14;

const JOUR = 86400000;
const jourDe = (v) => String(v || "").slice(0, 10);

function plus(jour, n) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() + n * JOUR).toISOString().slice(0, 10) : "";
}

function court(jour) {
  const d = new Date(`${jourDe(jour)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(d) : "";
}

function partsParis(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: `${Number(p.hour)} h ${p.minute}` };
}

// « 28 oct., 19 h 50 » (heure de Paris).
export function quandParis(iso) {
  const p = partsParis(iso);
  return p ? `${court(p.jour)}, ${p.heure}` : "";
}

// « hier à 21 h 12 », « aujourd'hui à 9 h 04 », « le 28 oct. à 21 h 12 ».
export function quandRelatif(iso, aujourdhui) {
  const p = partsParis(iso);
  if (!p) return "";
  if (p.jour === aujourdhui) return `aujourd'hui à ${p.heure}`;
  if (plus(p.jour, 1) === aujourdhui) return `hier à ${p.heure}`;
  return `le ${court(p.jour)} à ${p.heure}`;
}

function euros(n) {
  const centimes = Math.round(Math.abs(Number(n) || 0) * 100);
  return `${String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${String(centimes % 100).padStart(2, "0")} €`;
}

const pourcent = (n) => `${String(Number(n) || 0).replace(".", ",")} %`;
// Une phrase finie par une date abrégée (« 30 oct. ») ne prend pas un 2e point.
const point = (t) => (t.endsWith(".") ? t : `${t}.`);
const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";
const enLigne = (q) => q.signatureProvider !== "manuel" && q.signatureProvider !== "sur-place";
const surPlace = (q) => q.signatureProvider === "sur-place";
const lieuSurPlace = (q) => (q.signatureLieu === "locaux" ? "dans vos locaux" : "chez le client");

// Jour où relancer : 7 jours après l'envoi ou la dernière relance.
export function prochaineRelance(q) {
  const derniere = (q.relances || []).map((r) => jourDe(r.le)).sort().at(-1) || jourDe(q.sentAt);
  return derniere ? plus(derniere, RELANCE_JOURS) : "";
}

// Particulier qui a signé à distance (en ligne) : 14 jours pour se
// rétracter à compter de la signature. Le cas signé au domicile arrive
// avec PRO-03.7.
export function retractationJusquau(q) {
  // Date enregistrée à la signature (PRO-03.7, report au jour ouvrable).
  if (q.retractationJusquau) return q.retractationJusquau;
  if (!estSigne(q) || !q.signedAt || !enLigne(q) || q.clientType === "societe") return "";
  return finRetractation(partsParis(q.signedAt)?.jour || q.signedAt, "en-ligne", q.clientType);
}

export function etapesSuivi(q, { aujourdhui, chantierLance = false } = {}) {
  const signe = estSigne(q);
  const statut = statutDevis(q, aujourdhui);
  const fin = finValidite(q);
  const relance = prochaineRelance(q);
  let signature;
  if (signe) {
    const comment = enLigne(q) || surPlace(q)
      ? `${surPlace(q) ? lieuSurPlace(q) : "en ligne"}${q.mentionTva ? ", mention TVA certifiée" : ""}`
      : q.acceptanceReason === "acompte" ? "accord noté, acompte reçu" : "accord noté";
    signature = { cle: "signature", label: "Signé", etat: "done", detail: [quandParis(q.signedAt), comment].filter(Boolean).join(" · ") };
  } else if (statut.id === "expire") {
    signature = { cle: "signature", label: "Signature en attente", etat: "now", detail: `validité dépassée le ${court(fin)}` };
  } else {
    const suite = !relance ? "" : statut.id === "relancer" ? "à relancer" : `relance conseillée le ${court(relance)}`;
    signature = { cle: "signature", label: "Signature en attente", etat: "now", detail: [fin ? `valable jusqu'au ${court(fin)}` : "", suite].filter(Boolean).join(" · ") };
  }
  return [
    { cle: "envoye", label: "Envoyé", etat: q.sentAt || signe ? "done" : "todo", detail: quandParis(q.sentAt) },
    { cle: "vu", label: "Vu par le client", etat: q.viewedAt || signe ? "done" : "todo", detail: q.viewedAt ? quandParis(q.viewedAt) : "" },
    signature,
    { cle: "chantier", label: "Chantier lancé", etat: chantierLance ? "done" : signe ? "now" : "todo", detail: "" }
  ];
}

// Note sous le suivi.
export function noteSuivi(q, { aujourdhui, messages = 0 } = {}) {
  if (estSigne(q)) {
    const retract = retractationJusquau(q);
    return [
      point(`${surPlace(q) ? `Signé ${lieuSurPlace(q)}` : enLigne(q) ? "Signé en ligne" : "Accord noté"} le ${court(partsParis(q.signedAt)?.jour || q.signedAt)}`),
      q.mentionTva ? `Mention TVA ${pourcent(q.vatRate)} certifiée.` : "",
      retract ? point(`Rétractation possible jusqu'au ${court(retract)}`) : ""
    ].filter(Boolean).join(" ");
  }
  const vu = q.viewedAt ? `Ouvert par le client ${quandRelatif(q.viewedAt, aujourdhui)}.` : "Pas encore ouvert par le client.";
  const questions = messages > 0 ? `${messages} message${messages > 1 ? "s" : ""} du client.` : "Aucune question posée.";
  return `${vu} ${questions}`;
}

const CANAUX = [["kojiClient", "Koji Client"], ["email", "e-mail"], ["sms", "SMS"]];

// Conditions envoyées : ce que le client a reçu.
export function conditionsEnvoyees(q) {
  const jours = Number(q.validityDays) || 30;
  const fin = finValidite(q);
  const jalons = Array.isArray(q.paymentMilestones) ? q.paymentMilestones : [];
  const acompte = jalons.length ? Number(jalons[0]?.percent) || 0 : 0;
  const taux = Number(q.vatRate ?? 20);
  const lignes = [
    ["Validité", `${jours} jours${fin ? `, jusqu'au ${court(fin)}` : ""}`],
    ["Acompte", acompte > 0 ? `${pourcent(acompte)} à la signature · ${euros(Number(q.totalTtc || 0) * acompte / 100)} TTC` : "Sans acompte"],
    ["Règlement", libelleReglement(jalons[1]?.label || `Solde — ${soldeDe("")}`)],
    ["TVA", q.autoliquidation ? "Autoliquidation, sans TVA" : taux === 10 || taux === 5.5 ? `${pourcent(taux)}, mention certifiée à la signature` : pourcent(taux)]
  ];
  const canaux = CANAUX.filter(([cle]) => q.envoi?.[cle]).map(([, nom]) => nom);
  if (canaux.length) lignes.push(["Canaux", canaux.join(", ").replace(/^./, (c) => c.toUpperCase())]);
  return lignes;
}

// Version lue : « 2 · envoyée le 28 oct. » / « Lecture seule · v1 du 26
// oct. remplacée ».
export function versionDevis(q) {
  const versions = Array.isArray(q.versions) ? q.versions : [];
  const derniere = versions.at(-1);
  const precedente = versions.length > 1 ? versions.at(-2) : null;
  const numero = Number(derniere?.number || q.versionNumber || 1);
  const envoi = derniere?.sentAt || q.sentAt;
  return {
    titre: `${numero}${envoi ? ` · envoyée le ${court(envoi)}` : ""}`,
    detail: precedente ? `Lecture seule · v${Number(precedente.number)} du ${court(precedente.sentAt)} remplacée` : "Lecture seule"
  };
}
