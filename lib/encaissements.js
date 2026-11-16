// Encaissements (maquette PRO-06.3) : marquer payée (tout ou partie, date,
// moyen, référence), reste dû recalculé, rapprochement d'un relevé bancaire
// (Koji n'est pas relié à la banque : il propose, l'entrepreneur confirme).
// Mêmes règles dans l'app Koji Pro.

export const MOYENS = { virement: "Virement", carte: "Carte (en ligne)", cheque: "Chèque", especes: "Espèces" };
const MOYEN_COURT = { virement: "virement", carte: "carte", cheque: "chèque", especes: "espèces" };
// Plafond légal d'un paiement en espèces entre un professionnel et un
// particulier (CGI art. 1649 quater B, D. 112-3 C. mon. fin., à vérifier).
export const PLAFOND_ESPECES = 1000;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const jourDe = (iso) => String(iso || "").slice(0, 10);
const court = (iso) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(new Date(`${jourDe(iso)}T12:00:00Z`));
const date = (jour) => new Date(`${jourDe(jour)}T12:00:00Z`);

// Paiements d'une facture. Une facture marquée payée avant PRO-06.3 n'a pas
// de paiement enregistré : un paiement implicite du montant, à paidAt.
export function paiementsDe(invoice) {
  const liste = Array.isArray(invoice?.payments) ? invoice.payments : [];
  if (liste.length || invoice?.status !== "Payee") return liste;
  return [{ id: "implicite", amount: r2(invoice.amountTtc), date: jourDe(invoice.paidAt || invoice.updatedAt), moyen: "", implicite: true }];
}

export const encaisse = (invoice) => r2(paiementsDe(invoice).reduce((s, p) => s + Number(p.amount || 0), 0));

// Reste dû : montant − avoirs − paiements.
export const resteDu = (invoice, credite = 0) => r2(Math.max(0, Number(invoice?.amountTtc || 0) - credite - encaisse(invoice)));

// Ajoute un paiement ; renvoie le paiement et si la facture est soldée.
export function ajouterPaiement(invoice, { amount, date: jour, moyen = "virement", reference = "", id }, credite = 0) {
  const du = resteDu(invoice, credite);
  const montant = r2(amount === undefined || amount === "" || amount === null ? du : amount);
  if (!(montant > 0)) throw new Error("Le montant reçu doit être supérieur à zéro.");
  if (montant > du + 0.01) throw new Error(`Le montant dépasse le reste dû (${du.toFixed(2).replace(".", ",")} €).`);
  const paiement = {
    id: id || `pay-${Date.now().toString(36)}`,
    amount: montant,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(jour || "")) ? jour : new Date().toISOString().slice(0, 10),
    moyen: MOYENS[moyen] ? moyen : "virement",
    reference: String(reference || "").trim().slice(0, 140)
  };
  invoice.payments = [...(Array.isArray(invoice.payments) ? invoice.payments : []), paiement];
  const solde = resteDu(invoice, credite) <= 0.01;
  return { paiement, solde };
}

// Colonne « Paiement » de la maquette.
export function etatPaiement(invoice, { aujourdhui = new Date().toISOString().slice(0, 10), avoirs = [] } = {}) {
  if (invoice.status === "Annulee" || avoirs.length) {
    const av = avoirs[0];
    return { etat: "Annulée", texte: av ? `annulée par avoir ${av.invoiceNumber}` : "annulée" };
  }
  const paiements = paiementsDe(invoice);
  const dernier = paiements[paiements.length - 1];
  const libelle = (p) => (p.moyen === "virement" ? `virement reçu le ${court(p.date)}` : p.moyen ? `${MOYEN_COURT[p.moyen]} · ${court(p.date)}` : `payée le ${court(p.date)}`);
  if (invoice.status === "Payee") return { etat: "Payée", texte: dernier ? libelle(dernier) : "payée" };
  if (invoice.status === "Brouillon") return { etat: "Brouillon", texte: "pas encore envoyée" };
  const retard = invoice.dueDate ? Math.round((date(aujourdhui) - date(invoice.dueDate)) / 86400000) : 0;
  const relances = Array.isArray(invoice.reminders) ? invoice.reminders.length : 0;
  const partiel = dernier ? ` · ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(encaisse(invoice))} reçus` : "";
  if (retard > 0) return { etat: "En retard", texte: `échue depuis ${retard} j${relances ? ` · relance ${relances} envoyée` : ""}${partiel}` };
  return { etat: "À encaisser", texte: `${invoice.dueDate ? `échéance ${court(invoice.dueDate)}` : "sans échéance"}${partiel}` };
}

// Les trois chiffres de l'onglet : encaissé ce mois, à encaisser, prochaine échéance.
export function chiffresEncaissements(invoices = [], { aujourdhui = new Date().toISOString().slice(0, 10), credits = () => 0 } = {}) {
  const mois = aujourdhui.slice(0, 7);
  const paiementsMois = [];
  for (const f of invoices) {
    if (f.kind === "avoir" || f.status === "Annulee") continue;
    for (const p of paiementsDe(f)) if (jourDe(p.date).slice(0, 7) === mois) paiementsMois.push({ ...p, invoice: f });
  }
  const dues = invoices.filter((f) => f.kind !== "avoir" && f.status === "Emise" && !f.archived && resteDu(f, credits(f)) > 0.01);
  const enRetard = dues.filter((f) => f.dueDate && jourDe(f.dueDate) < aujourdhui);
  const prochaine = dues.filter((f) => f.dueDate && jourDe(f.dueDate) >= aujourdhui).sort((a, b) => jourDe(a.dueDate).localeCompare(jourDe(b.dueDate)))[0] || null;
  return {
    encaisseMois: r2(paiementsMois.reduce((s, p) => s + Number(p.amount || 0), 0)),
    paiementsMois,
    aEncaisser: r2(dues.reduce((s, f) => s + resteDu(f, credits(f)), 0)),
    duesCount: dues.length,
    retardCount: enRetard.length,
    prochaine
  };
}

// --- Rapprochement d'un relevé bancaire (CSV) -------------------------------

function nombre(texte) {
  const t = String(texte || "").replace(/[\s  €]/g, "").replace(/^\+/, "");
  if (!t) return null;
  // 1.234,56 / 1234,56 / 1234.56 / -1 234,56
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function jourReleve(texte) {
  const t = String(texte || "").trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function decouper(ligne, sep) {
  const cases = [];
  let cur = "";
  let guillemets = false;
  for (const c of ligne) {
    if (c === '"') guillemets = !guillemets;
    else if (c === sep && !guillemets) { cases.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  cases.push(cur.trim());
  return cases;
}

// Lit un relevé CSV : colonnes date, libellé et montant (ou débit / crédit),
// détectées par l'en-tête ; séparateur ; ou , ou tabulation. Ne garde que
// les entrées d'argent (crédits).
export function lireReleveCsv(texte) {
  const lignes = String(texte || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return { lignes: [], total: 0 };
  const sep = [";", "\t", ","].map((s) => [s, lignes[0].split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const tete = decouper(lignes[0], sep).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const col = (...noms) => tete.findIndex((h) => noms.some((n) => h.includes(n)));
  const iDate = col("date");
  const iLib = col("libelle", "label", "description", "operation", "intitule", "detail");
  const iCredit = col("credit");
  const iDebit = col("debit");
  const iMontant = col("montant", "amount", "valeur");
  const sorties = [];
  let total = 0;
  for (const l of lignes.slice(1)) {
    const c = decouper(l, sep);
    if (c.length < 2) continue;
    total += 1;
    const credit = iCredit >= 0 ? nombre(c[iCredit]) : null;
    const montant = credit ?? (iMontant >= 0 ? nombre(c[iMontant]) : null);
    if (iDebit >= 0 && credit === null && iMontant < 0) continue;
    if (!(montant > 0)) continue;
    sorties.push({ date: jourReleve(c[iDate >= 0 ? iDate : 0]), libelle: (c[iLib >= 0 ? iLib : 1] || "").replace(/\s+/g, " ").trim(), montant: r2(montant) });
  }
  return { lignes: sorties, total };
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Propose une facture par ligne : même montant que le reste dû, départagé
// par le numéro de facture ou le nom du client dans le libellé. Une facture
// n'est proposée qu'une fois.
export function rapprocher(lignes = [], invoices = [], credits = () => 0) {
  const dues = invoices.filter((f) => f.kind !== "avoir" && f.status === "Emise" && !f.archived && resteDu(f, credits(f)) > 0.01);
  const prises = new Set();
  return lignes.map((ligne) => {
    const lib = norm(ligne.libelle);
    const score = (f) => {
      let s = 0;
      const numero = norm(f.invoiceNumber);
      if (numero && lib.includes(numero)) s += 3;
      const chiffres = String(f.invoiceNumber || "").match(/\d+$/)?.[0];
      if (chiffres && chiffres.length >= 3 && lib.split(" ").includes(chiffres)) s += 2;
      const mots = norm(f.client).split(" ").filter((m) => m.length >= 3 && !["mme", "mr", "sci", "sas", "sarl", "madame", "monsieur"].includes(m));
      if (mots.some((m) => lib.includes(m))) s += 1;
      return s;
    };
    const candidates = dues
      .filter((f) => !prises.has(f.id) && Math.abs(resteDu(f, credits(f)) - ligne.montant) <= 0.01)
      .map((f) => ({ f, s: score(f) }))
      .sort((a, b) => b.s - a.s);
    const choix = candidates.length === 1 || (candidates.length > 1 && candidates[0].s > candidates[1].s) ? candidates[0].f : null;
    if (choix) prises.add(choix.id);
    return { ...ligne, invoiceId: choix?.id || "", invoiceNumber: choix?.invoiceNumber || "", certitude: choix ? (candidates[0].s > 0 ? "forte" : "montant") : "" };
  });
}
