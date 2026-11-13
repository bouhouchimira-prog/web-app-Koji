// Liste des devis (maquette PRO-03) : statut, dernière action, action de la
// ligne, onglets et badge du menu. Un devis envoyé sans réponse passe « À
// relancer » après 7 jours ; à la fin de sa validité (30 jours par défaut)
// il passe « Expiré » et se duplique. Mêmes règles dans l'app Koji Pro
// (mobile/lib/apps/entreprise/devis/devis_liste.dart).

export const RELANCE_JOURS = 7;
export const VALIDITE_JOURS = 30;

export const ONGLETS_DEVIS = [
  { id: "tous", label: "Tous" },
  { id: "brouillon", label: "Brouillons" },
  { id: "envoye", label: "Envoyés" },
  { id: "signe", label: "Signés" },
  { id: "termine", label: "Expirés, refusés" }
];

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

function heureParis(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit" }).format(d).replace(":", " h ");
}

const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";
const estEnvoye = (q) => q.status === "Envoye" && !estSigne(q);

// Dernier jour de validité d'un devis envoyé.
export function finValidite(q) {
  const depart = jourDe(q.sentAt || q.quoteDate || q.createdAt);
  return depart ? plus(depart, Number(q.validityDays) || VALIDITE_JOURS) : "";
}

export function estExpire(q, aujourdhui) {
  const fin = finValidite(q);
  return estEnvoye(q) && Boolean(fin) && fin < aujourdhui;
}

export function aRelancer(q, aujourdhui) {
  if (!estEnvoye(q) || estExpire(q, aujourdhui) || !q.sentAt) return false;
  const derniere = (q.relances || []).map((r) => jourDe(r.le)).sort().at(-1) || jourDe(q.sentAt);
  return plus(derniere, RELANCE_JOURS) <= aujourdhui;
}

// Onglet du devis : brouillon, envoye, signe, termine (expiré ou refusé).
export function ongletDevis(q, aujourdhui) {
  if (estSigne(q)) return "signe";
  if (q.status === "Refuse" || q.status === "Annule") return "termine";
  if (estEnvoye(q)) return estExpire(q, aujourdhui) ? "termine" : "envoye";
  return "brouillon";
}

// Statut affiché et son ton (maquette : contour, graphite, sceau, gris).
export function statutDevis(q, aujourdhui) {
  if (estSigne(q)) return { id: "signe", label: "Signé", ton: "sceau" };
  if (q.status === "Refuse") return { id: "refuse", label: "Refusé", ton: "gris" };
  if (q.status === "Annule") return { id: "annule", label: "Annulé", ton: "gris" };
  if (estEnvoye(q)) {
    if (estExpire(q, aujourdhui)) return { id: "expire", label: "Expiré", ton: "gris" };
    if (aRelancer(q, aujourdhui)) return { id: "relancer", label: "À relancer", ton: "contour" };
    return { id: "envoye", label: "Envoyé", ton: "graphite" };
  }
  if (q.status === "Pret a envoyer") return { id: "pret", label: "Prêt à envoyer", ton: "contour" };
  return { id: "brouillon", label: "Brouillon", ton: "contour" };
}

// « Modifié à 19 h 42 », « Envoyé le 27 oct. · vu par le client »,
// « Envoyé le 14 oct. · sans réponse », « Signé le 9 oct. · chantier en
// cours », « Validité dépassée le 20 oct. ».
export function derniereAction(q, aujourdhui, { chantierEnCours = false } = {}) {
  const s = statutDevis(q, aujourdhui);
  if (s.id === "signe") return [q.signedAt ? `Signé le ${court(q.signedAt)}` : "Signé", chantierEnCours ? "chantier en cours" : ""].filter(Boolean).join(" · ");
  if (s.id === "refuse") return q.refusedAt ? `Refusé le ${court(q.refusedAt)}` : "Refusé par le client";
  if (s.id === "annule") return "Annulé";
  if (s.id === "expire") return `Validité dépassée le ${court(finValidite(q))}`;
  if (s.id === "envoye" || s.id === "relancer") {
    const relances = q.relances || [];
    const envoi = relances.length ? `Relancé le ${court(relances.at(-1).le)}` : q.sentAt ? `Envoyé le ${court(q.sentAt)}` : "Envoyé";
    const suite = q.viewedAt ? "vu par le client" : s.id === "relancer" ? "sans réponse" : "";
    return [envoi, suite].filter(Boolean).join(" · ");
  }
  const modif = q.updatedAt || q.createdAtIso;
  if (!modif) return "";
  return jourDe(modif) === aujourdhui ? `Modifié à ${heureParis(modif)}` : `Modifié le ${court(modif)}`;
}

// Action de la ligne : Reprendre (brouillon), Relancer, Voir, Dupliquer.
export function actionDevis(q, aujourdhui) {
  const s = statutDevis(q, aujourdhui);
  if (s.id === "brouillon" || s.id === "pret") return { id: "reprendre", label: "Reprendre" };
  if (s.id === "relancer") return { id: "relancer", label: "Relancer" };
  if (s.id === "expire" || s.id === "refuse") return { id: "dupliquer", label: "Dupliquer" };
  return { id: "voir", label: "Voir" };
}

export function compterDevis(devis, aujourdhui) {
  const c = { tous: devis.length, brouillon: 0, envoye: 0, signe: 0, termine: 0, relancer: 0, aReprendre: 0 };
  for (const q of devis) {
    const onglet = ongletDevis(q, aujourdhui);
    c[onglet] += 1;
    if (aRelancer(q, aujourdhui)) c.relancer += 1;
    // Brouillon « à reprendre » : pas touché aujourd'hui.
    if (onglet === "brouillon" && jourDe(q.updatedAt || q.createdAtIso) < aujourdhui) c.aReprendre += 1;
  }
  // Badge du menu : brouillons à reprendre + devis à relancer.
  c.badge = c.aReprendre + c.relancer;
  return c;
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// « 7 devis · 3 envoyés en attente · 1 à relancer · 1 brouillon ».
export function resumeDevis(c, { avecTotal = true } = {}) {
  return [
    avecTotal ? `${c.tous} devis` : "",
    c.envoye ? `${pluriel(c.envoye, "envoyé")}${avecTotal ? " en attente" : ""}` : "",
    c.relancer ? `${c.relancer} à relancer` : "",
    c.brouillon ? pluriel(c.brouillon, "brouillon") : ""
  ].filter(Boolean).join(" · ");
}

const point = (t) => (t.endsWith(".") ? t : `${t}.`);

// Message de relance proposé (modifiable avant l'envoi).
export function messageRelance(q, { entreprise = "" } = {}) {
  const fin = finValidite(q);
  return [
    `Bonjour${q.client ? ` ${q.client}` : ""},`,
    "",
    [point(`Je reviens vers vous au sujet du devis ${q.quoteNumber}${q.project ? ` (${q.project})` : ""}${q.sentAt ? `, envoyé le ${court(q.sentAt)}` : ""}`), fin ? point(`Il reste valable jusqu'au ${court(fin)}`) : ""].filter(Boolean).join(" "),
    "Avez-vous des questions ? Je peux l'ajuster si besoin.",
    "",
    "Bien cordialement,",
    entreprise
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
}
