// PRO-01.2 : les trois chiffres du mois de l'accueil (Facturé HT, Encaissé
// TTC, Reste à encaisser TTC) et la ligne « depuis janvier ».
//
// Tout vient des factures existantes, rien n'est saisi à part :
// - une facture compte dès qu'elle est émise (Emise / Payee), à sa date
//   d'émission ; les brouillons et les factures annulées ne comptent pas ;
// - un avoir (kind "avoir", montant négatif) vient en déduction du facturé ;
// - les factures ne stockent qu'un montant TTC : le HT est déduit du devis
//   rattaché (totalHt / totalTtc). Sans devis (intervention, saisie libre),
//   on applique la TVA à 20 % et on le signale (`htEstimes`).

const TVA_PAR_DEFAUT = 1.2;
const EMISES = new Set(["Emise", "Payee", "Partielle"]);
const A_ENCAISSER = new Set(["Emise", "Partielle"]);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function cleMois(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Date ISO (UTC) → mois/année locaux, pour qu'une facture émise le 31 au soir
// reste dans le bon mois.
function dateLocale(valeur) {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dansPeriode(valeur, periode) {
  const date = dateLocale(valeur);
  if (!date) return false;
  if (periode.type === "annee") return date.getFullYear() === periode.annee;
  return cleMois(date) === periode.mois;
}

// Les trois choix du sélecteur : mois précédent, mois en cours, année.
export function periodesDisponibles(aujourdhui = new Date()) {
  const courant = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
  const precedent = new Date(courant.getFullYear(), courant.getMonth() - 1, 1);
  const mois = (date) => ({
    cle: cleMois(date),
    type: "mois",
    mois: cleMois(date),
    annee: date.getFullYear(),
    label: majuscule(MOIS[date.getMonth()]),
    titre: `${majuscule(MOIS[date.getMonth()])} ${date.getFullYear()}`
  });
  return [
    mois(precedent),
    mois(courant),
    { cle: `annee-${courant.getFullYear()}`, type: "annee", annee: courant.getFullYear(), label: "Année", titre: `Année ${courant.getFullYear()}` }
  ];
}

function estSigne(quote) {
  return quote.status === "Signe" || quote.signatureStatus === "Signe";
}

// Devis de référence d'un chantier : le signé, sinon le plus récent
// (même règle que Comptabilité › Coût des chantiers).
export function devisDuChantier(projectId, quotes = []) {
  const lies = quotes.filter((quote) => quote.projectId === projectId);
  return lies.find(estSigne)
    || [...lies].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0]
    || null;
}

// Montant HT d'une facture et si ce HT est estimé (pas de devis exploitable).
export function montantHt(invoice, quotesParId) {
  const ttc = Number(invoice.amountTtc || 0);
  const quote = invoice.quoteId ? quotesParId.get(invoice.quoteId) : null;
  const ht = Number(quote?.totalHt || 0);
  const totalTtc = Number(quote?.totalTtc || 0);
  if (ht > 0 && totalTtc > 0) return { ht: ttc * (ht / totalTtc), estime: false };
  return { ht: ttc / TVA_PAR_DEFAUT, estime: true };
}

function joursEntre(debut, fin) {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000);
}

function dateIsoLocale(date) {
  return `${cleMois(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function factureHt(invoices, periode, quotesParId) {
  let total = 0;
  let factures = 0;
  let avoirs = 0;
  let htEstimes = 0;
  for (const invoice of invoices) {
    if (invoice.archived || !EMISES.has(invoice.status)) continue;
    if (!dansPeriode(invoice.issuedAt, periode)) continue;
    const { ht, estime } = montantHt(invoice, quotesParId);
    total += ht;
    if (estime) htEstimes += 1;
    if (invoice.kind === "avoir") avoirs += 1;
    else factures += 1;
  }
  return { total, factures, avoirs, htEstimes };
}

// Marge moyenne pondérée des chantiers qui ont des dépenses saisies :
// (devis HT − dépenses) / devis HT. Un chantier sans aucune dépense
// afficherait 100 % de marge, il est donc laissé de côté.
export function margeMoyenne({ projects = [], quotes = [], expenses = [] }) {
  let devisHt = 0;
  let depense = 0;
  let chantiers = 0;
  for (const project of projects) {
    const spent = expenses
      .filter((expense) => expense.projectId === project.id)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    if (spent <= 0) continue;
    const ht = Number(devisDuChantier(project.id, quotes)?.totalHt || 0);
    if (ht <= 0) continue;
    devisHt += ht;
    depense += spent;
    chantiers += 1;
  }
  if (!chantiers) return null;
  return { taux: (devisHt - depense) / devisHt, chantiers };
}

export function chiffresDuMois({ invoices = [], quotes = [], projects = [], expenses = [], periode, aujourdhui = new Date() }) {
  const quotesParId = new Map(quotes.map((quote) => [quote.id, quote]));
  const actives = invoices.filter((invoice) => !invoice.archived);

  const facture = factureHt(actives, periode, quotesParId);

  let encaisse = 0;
  let paiements = 0;
  for (const invoice of actives) {
    if (invoice.kind === "avoir" || invoice.status !== "Payee") continue;
    if (!dansPeriode(invoice.paidAt, periode)) continue;
    encaisse += Number(invoice.amountTtc || 0);
    paiements += 1;
  }

  // Reste à encaisser : état à ce jour, quelle que soit la période choisie.
  // Les avoirs émis sur une facture impayée réduisent ce qu'elle doit encore.
  const credits = new Map();
  for (const invoice of actives) {
    if (invoice.kind !== "avoir" || invoice.status === "Annulee" || !invoice.refInvoiceId) continue;
    credits.set(invoice.refInvoiceId, (credits.get(invoice.refInvoiceId) || 0) - Number(invoice.amountTtc || 0));
  }
  const jour = dateIsoLocale(aujourdhui);
  let reste = 0;
  let impayees = 0;
  let echues = 0;
  let retardMax = 0;
  for (const invoice of actives) {
    if (invoice.kind === "avoir" || !A_ENCAISSER.has(invoice.status)) continue;
    const du = Number(invoice.amountTtc || 0) - (credits.get(invoice.id) || 0);
    if (du <= 0.005) continue;
    reste += du;
    impayees += 1;
    const echeance = String(invoice.dueDate || "").slice(0, 10);
    if (echeance && echeance < jour) {
      echues += 1;
      retardMax = Math.max(retardMax, joursEntre(echeance, jour));
    }
  }

  const annee = { type: "annee", annee: aujourdhui.getFullYear() };
  const depuisJanvier = factureHt(actives, annee, quotesParId).total;

  return {
    facture,
    encaisse: { total: encaisse, paiements },
    reste: { total: reste, impayees, echues, retardMax },
    depuisJanvier,
    marge: margeMoyenne({ projects, quotes, expenses })
  };
}
