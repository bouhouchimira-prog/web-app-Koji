// Relances et mise en demeure (maquette PRO-06.2) : J+3 rappel aimable,
// J+15 relance ferme, J+30 mise en demeure préparée (jamais envoyée seule,
// elle part en recommandé, envoyée par l'entrepreneur). Désactivable
// facture par facture. Mêmes règles dans l'app Koji Pro et la tâche
// quotidienne des relances automatiques.

export const PALIERS = [
  { level: "aimable", jours: 3, label: "rappel aimable" },
  { level: "ferme", jours: 15, label: "relance ferme" },
  { level: "demeure", jours: 30, label: "mise en demeure" }
];

const JOUR = 86400000;
const jourDe = (iso) => String(iso || "").slice(0, 10);
const date = (jour) => new Date(`${jourDe(jour)}T12:00:00Z`);
const court = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(new Date(iso));
const long = (iso, annee = false) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", ...(annee ? { year: "numeric" } : {}) }).format(new Date(iso));
const euro = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0).replace(/[  ]/g, " ");

export function aujourdhuiParis(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

export function joursRetard(invoice, aujourdhui = aujourdhuiParis()) {
  if (!invoice?.dueDate) return 0;
  return Math.max(0, Math.round((date(aujourdhui) - date(invoice.dueDate)) / JOUR));
}

const relancesDe = (invoice) => (Array.isArray(invoice?.reminders) ? invoice.reminders : []);

// Facture suivie dans les impayés : émise, échue, ni avoir ni corbeille.
// creditee : montant TTC déjà couvert par des avoirs.
export function estImpayee(invoice, aujourdhui = aujourdhuiParis(), creditee = 0) {
  if (!invoice || invoice.kind === "avoir" || invoice.status !== "Emise" || invoice.archived) return false;
  if (Number(invoice.amountTtc || 0) - creditee <= 0.01) return false;
  return jourDe(invoice.dueDate) !== "" && jourDe(invoice.dueDate) < aujourdhui;
}

// Prochaine relance due : le palier atteint qui n'a pas encore été fait.
// Pas de relance automatique sur une facture contestée ou un avoir en cours.
export function relanceDue(invoice, aujourdhui = aujourdhuiParis(), creditee = 0) {
  if (!estImpayee(invoice, aujourdhui, creditee) || invoice.remindersOff || invoice.contestee || creditee > 0) return null;
  const retard = joursRetard(invoice, aujourdhui);
  const faits = new Set(relancesDe(invoice).map((r) => r.level));
  if (invoice.demeurePrete) faits.add("demeure");
  const atteints = PALIERS.filter((p) => retard >= p.jours);
  const dernier = atteints[atteints.length - 1];
  return dernier && !faits.has(dernier.level) ? dernier.level : null;
}

// Étape affichée dans la liste (maquette : « 2e relance envoyée le 21 nov. »,
// « rappel aimable prévu demain »).
export function etapeRelance(invoice, aujourdhui = aujourdhuiParis()) {
  const relances = relancesDe(invoice);
  const demeure = relances.find((r) => r.level === "demeure");
  if (demeure) return `mise en demeure envoyée le ${court(demeure.at)}`;
  if (invoice.demeurePrete) return "mise en demeure prête";
  if (relances.length) {
    const derniere = relances[relances.length - 1];
    return `${relances.length === 1 ? "1re" : `${relances.length}e`} relance ${derniere.channel === "email" ? "envoyée" : "notée"} le ${court(derniere.at)}`;
  }
  if (invoice.remindersOff) return "relances désactivées";
  const retard = joursRetard(invoice, aujourdhui);
  const prochain = PALIERS.find((p) => retard < p.jours) || null;
  if (!prochain) return "à relancer";
  const dans = prochain.jours - retard;
  return `${prochain.label} prévu ${dans === 1 ? "demain" : `dans ${dans} jours`}`;
}

// Action principale de la ligne : mise en demeure après la relance ferme
// ou dès 30 jours, sinon relancer, sinon voir.
export function actionImpaye(invoice, aujourdhui = aujourdhuiParis()) {
  const retard = joursRetard(invoice, aujourdhui);
  const ferme = relancesDe(invoice).some((r) => r.level === "ferme");
  if (relancesDe(invoice).some((r) => r.level === "demeure")) return "voir";
  if (retard >= 30 || ferme || invoice.demeurePrete) return "demeure";
  if (retard >= PALIERS[0].jours) return "relancer";
  return "voir";
}

const estAcompte = (invoice) => /acompte/i.test(invoice?.type || "");
const nomFacture = (invoice) => (estAcompte(invoice) ? "la facture d'acompte" : /situation/i.test(invoice?.type || "") ? "la situation de travaux" : "la facture");

function civilite(client) {
  const c = String(client || "").trim();
  if (/^(mme|madame)\b/i.test(c)) return "Madame";
  if (/^(m\.|mr|monsieur)\b/i.test(c)) return "Monsieur";
  return "Madame, Monsieur";
}

// Textes préremplis, modifiables avant envoi. societe : ton et mentions
// d'un client professionnel (pénalités, indemnité forfaitaire de 40 €) ;
// particulier : intérêts au taux légal à compter de la mise en demeure.
export function texteRelance(level, invoice, { entreprise = "", societe = false, aujourdhui = aujourdhuiParis() } = {}) {
  const client = String(invoice?.client || "").trim();
  const montant = euro(invoice?.amountTtc);
  const echeance = invoice?.dueDate ? long(`${jourDe(invoice.dueDate)}T12:00:00Z`, true) : "";
  const emise = invoice?.issuedAt || invoice?.createdAt;
  const precedentes = relancesDe(invoice).filter((r) => r.level !== "demeure").map((r) => r.at);
  const signature = entreprise ? `\n\nCordialement,\n${entreprise}` : "\n\nCordialement,";
  if (level === "demeure") {
    const relances = precedentes.length
      ? `malgré ${precedentes.length > 1 ? "nos relances des" : "notre relance du"} ${listeJours(precedentes)}, `
      : "";
    const suite = societe
      ? "À défaut, nous saisirons la juridiction compétente. Des pénalités de retard et l'indemnité forfaitaire de 40 € pour frais de recouvrement sont dues de plein droit."
      : "À défaut, nous saisirons la juridiction compétente. Les sommes dues porteront intérêts au taux légal à compter de la présente mise en demeure.";
    return `Objet : mise en demeure de payer\n\n${civilite(client)}, ${relances}${nomFacture(invoice)} ${invoice.invoiceNumber}${emise ? ` du ${long(emise)}` : ""}, d'un montant de ${montant} TTC, reste impayée. Nous vous mettons en demeure de régler cette somme sous 8 jours à compter de la réception de ce courrier. ${suite}${entreprise ? `\n\n${entreprise}` : ""}`;
  }
  const nom = client || "Madame, Monsieur";
  if (level === "ferme") {
    const derniere = precedentes[precedentes.length - 1];
    return `Bonjour ${nom},\n\nMalgré notre précédent rappel${derniere ? ` du ${long(derniere)}` : ""}, ${nomFacture(invoice)} ${invoice.invoiceNumber} d'un montant de ${montant} TTC, échue le ${echeance}, reste impayée (${joursRetard(invoice, aujourdhui)} jours de retard).\n\nMerci de procéder au règlement sous 8 jours. La facture est jointe à ce message.${signature}`;
  }
  return `Bonjour ${nom},\n\nSauf erreur de notre part, ${nomFacture(invoice)} ${invoice.invoiceNumber} d'un montant de ${montant} TTC, arrivée à échéance le ${echeance}, n'a pas encore été réglée.\n\nPourriez-vous procéder au règlement ? Vous trouverez la facture en pièce jointe. Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.${signature}`;
}

// « 9 et 21 novembre », « 2, 9 et 21 novembre », mois répétés si différents.
function listeJours(isos) {
  const parts = isos.map((iso) => ({ j: new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric" }).format(new Date(iso)), m: new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", month: "long" }).format(new Date(iso)) }));
  const memeMois = parts.every((p) => p.m === parts[0].m);
  const mots = parts.map((p, i) => (memeMois && i < parts.length - 1 ? p.j : `${p.j} ${p.m}`));
  return mots.length > 1 ? `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}` : mots[0];
}

export function resumeImpayes(invoices = [], aujourdhui = aujourdhuiParis(), credits = () => 0) {
  const liste = invoices.filter((f) => estImpayee(f, aujourdhui, credits(f)))
    .sort((a, b) => joursRetard(b, aujourdhui) - joursRetard(a, aujourdhui));
  return { liste, total: Math.round(liste.reduce((s, f) => s + Number(f.amountTtc || 0) - credits(f), 0) * 100) / 100 };
}
