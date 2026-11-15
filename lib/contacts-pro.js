// Contacts Koji Pro (maquettes PRO-10 à 10.3) : un carnet unique (clients,
// sous-traitants, fournisseurs, prescripteurs), une prochaine action par
// fiche, documents de vigilance des sous-traitants, argent du client,
// historique rempli seul. Logique pure, testée dans
// tests/unit/contacts-pro.test.js ; l'app lit les mêmes calculs par l'API.
import { normalizeEmail, normalizePhone, normalizeSiret, contactDisplayName } from "./contacts.js";
import { encaisse, resteDu } from "./encaissements.js";

const n = (v, d = 0) => {
  const x = Number(typeof v === "string" ? v.replace(/[\s  ]/g, "").replace(",", ".") : v);
  return Number.isFinite(x) ? x : d;
};
const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const jour = (iso) => String(iso || "").slice(0, 10);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const jourCourt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${Number(m[3])} ${MOIS[Number(m[2]) - 1]}` : ""; };
const plusMois = (iso, mois) => { const d = new Date(`${jour(iso)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + mois); return d.toISOString().slice(0, 10); };
const ecartJours = (a, b) => Math.round((Date.parse(`${jour(b)}T12:00:00Z`) - Date.parse(`${jour(a)}T12:00:00Z`)) / 86400000);

// --- Types ---------------------------------------------------------------

export const TYPES = {
  client: "Client",
  prospect: "Prospect",
  sous_traitant: "Sous-traitant",
  fournisseur: "Fournisseur",
  architecte: "Prescripteur",
  donneur_ordre: "Donneur d'ordre",
  equipe: "Équipe",
  autre: "Autre"
};
export const GENRES_CLIENT = { particulier: "particulier", entreprise: "entreprise", syndic: "syndic" };
const ORDRE = ["client", "sous_traitant", "fournisseur", "architecte", "prospect", "donneur_ordre", "equipe", "autre"];

export function typeContact(c = {}) {
  const roles = Array.isArray(c.roles) ? c.roles : [];
  const cle = ORDRE.find((r) => roles.includes(r)) || (roles[0] || "autre");
  const genre = cle === "client" ? (c.genreClient || (c.type === "societe" ? "entreprise" : "particulier")) : "";
  return { cle, label: TYPES[cle] || "Autre", genre, pro: !["client", "prospect"].includes(cle) };
}

export function initiales(nom = "") {
  const mots = String(nom).replace(/^(mme|mr|m\.|mlle)\s+/i, "").split(/[\s·-]+/).filter((m) => /^[A-Za-zÀ-ÿ]/.test(m));
  return ((mots[0]?.[0] || "") + (mots[1]?.[0] || mots[0]?.[1] || "")).toUpperCase();
}

// --- Documents de vigilance (PRO-10.1) ----------------------------------

// Seuil de la vigilance : contrat d'au moins 5 000 € HT (C. trav. L8222-1, D8222-5).
export const SEUIL_VIGILANCE = 5000;
export const DOCS_VIGILANCE = [
  { cle: "urssaf", nom: "Attestation de vigilance URSSAF", aide: "obligatoire au-delà de 5 000 € HT par contrat, à renouveler tous les 6 mois", validiteMois: 6, bloquant: true },
  { cle: "kbis", nom: "Extrait Kbis ou avis de situation", aide: "moins de 3 mois au moment du contrat", validiteMois: 3, bloquant: true },
  { cle: "decennale", nom: "Assurance décennale", aide: "attestation de l'année, activité couverte", validiteMois: 0 },
  { cle: "rcpro", nom: "Responsabilité civile professionnelle", aide: "attestation de l'année", validiteMois: 0 },
  { cle: "etrangers", nom: "Liste des salariés étrangers", aide: "si l'entreprise emploie des salariés étrangers", validiteMois: 0, facultatif: true }
];

// État d'un document : validité lue (validJusqu) ou calculée depuis la date
// du document ; échéance un mois avant (31 jours) ; « non concerné » possible.
export function etatDocument(doc = null, def, aujourdhui = new Date().toISOString().slice(0, 10)) {
  if (doc?.nonConcerne) return { etat: "ok", texte: `non concerné${doc.date ? ` · déclaré le ${jourCourt(doc.date)}` : ""}` };
  if (!doc || (!doc.date && !doc.validJusqu)) return { etat: "manquant", texte: doc?.demandeLe ? `manquante · demandée le ${jourCourt(doc.demandeLe)}` : "manquante" };
  const fin = doc.validJusqu || (def.validiteMois ? plusMois(doc.date, def.validiteMois) : "");
  if (fin && fin < aujourdhui) return { etat: "expire", texte: `manquante · expirée le ${jourCourt(fin)}` };
  if (fin && ecartJours(aujourdhui, fin) <= 31) return { etat: "echeance", texte: `expire le ${jourCourt(fin)} · dans ${ecartJours(aujourdhui, fin)} jours` };
  if (doc.validJusqu) return { etat: "ok", texte: `valable jusqu'au ${jourCourt(doc.validJusqu)}${doc.validJusqu.slice(0, 4) !== aujourdhui.slice(0, 4) ? ` ${doc.validJusqu.slice(0, 4)}` : ""}` };
  return { etat: "ok", texte: `reçu le ${jourCourt(doc.date)}` };
}

export function vigilance(contact = {}, { cumulHt = 0, aujourdhui } = {}) {
  const docs = DOCS_VIGILANCE.map((def) => ({ ...def, doc: contact.vigilance?.[def.cle] || null, ...etatDocument(contact.vigilance?.[def.cle], def, aujourdhui) }));
  const exige = n(cumulHt) >= SEUIL_VIGILANCE || Boolean(contact.vigilanceExigee);
  const manquants = docs.filter((d) => !d.facultatif && (d.etat === "manquant" || d.etat === "expire"));
  const bloquant = exige ? manquants.find((d) => d.bloquant) || null : null;
  const echeances = docs.filter((d) => d.etat === "echeance");
  return { docs, exige, bloquant, manquants, echeances };
}

// --- Client : argent et factures échues ---------------------------------

// Devis et factures d'un contact : lien direct, sinon même e-mail ou téléphone.
export function correspondAuContact(contact = {}, o = {}) {
  const { contactId = "" } = o;
  const email = o.email || o.clientEmail || "";
  const phone = o.phone || o.clientPhone || "";
  if (contactId && contactId === contact.id) return true;
  const e = normalizeEmail(contact.email);
  if (e && normalizeEmail(email) === e) return true;
  const t = normalizePhone(contact.phone);
  return Boolean(t && t.length >= 9 && normalizePhone(phone) === t);
}

const signe = (q) => q.status === "Signe" || q.signatureStatus === "Signe";
const EMISES = new Set(["Emise", "Partielle", "Payee"]);
export function libelleFacture(inv = {}) {
  const t = `${inv.type || ""} ${inv.notes || ""}`;
  if (/acompte/i.test(t)) return "acompte";
  if (/situation/i.test(t)) return "situation";
  return "facture";
}

export function argentClient({ quotes = [], invoices = [], aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const signes = quotes.filter(signe);
  const emises = invoices.filter((i) => i.kind !== "avoir" && EMISES.has(i.status) && !i.archived);
  const echues = emises.filter((i) => i.status !== "Payee" && i.dueDate && i.dueDate < aujourdhui && resteDu(i) > 0)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  return {
    signeHt: r2(signes.reduce((s, q) => s + n(q.totalHt), 0)),
    factureTtc: r2(emises.reduce((s, i) => s + n(i.amountTtc), 0)),
    paye: r2(emises.reduce((s, i) => s + encaisse(i), 0)),
    retard: r2(echues.reduce((s, i) => s + resteDu(i), 0)),
    echue: echues[0] || null
  };
}

// --- Prochaine action et « À faire » ------------------------------------

// Une seule action jaune par fiche : la prochaine chose à faire.
export function prochaineAction(contact = {}, { argent = null, vig = null, aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const t = typeContact(contact);
  if (argent?.echue) {
    const f = argent.echue;
    const quoi = libelleFacture(f);
    return {
      urgent: true, cle: "relancer", label: `Relancer ${quoi === "facture" ? "la facture" : `l'${quoi}`.replace("l'situation", "la situation")}`,
      texte: `${quoi === "acompte" ? "Acompte" : quoi === "situation" ? "Situation" : "Facture"} de ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(resteDu(f))} échu${quoi === "facture" || quoi === "situation" ? "e" : ""} depuis le ${jourCourt(f.dueDate)}`,
      flag: `${quoi} échu${quoi === "facture" || quoi === "situation" ? "e" : ""}`, invoiceId: f.id
    };
  }
  if (t.cle === "sous_traitant" && vig?.bloquant) {
    return { urgent: true, cle: "vigilance", label: `Demander ${vig.bloquant.cle === "urssaf" ? "l'attestation" : "le document"}`, texte: `${vig.bloquant.nom} manquante`, flag: `${vig.bloquant.cle === "urssaf" ? "URSSAF" : "Kbis"} manquant${vig.bloquant.cle === "urssaf" ? "e" : ""}`, doc: vig.bloquant.cle };
  }
  if (t.cle === "sous_traitant" && vig?.echeances?.length) {
    const d = vig.echeances[0];
    return { urgent: false, cle: "vigilance", label: "Demander le document à jour", texte: `${d.nom} : ${d.texte}`, flag: `${d.nom.split(" ")[0].toLowerCase()} expire bientôt`, doc: d.cle };
  }
  if (contact.nextAction?.label) {
    const due = contact.nextAction.date && contact.nextAction.date <= aujourdhui;
    return { urgent: Boolean(due), cle: "note", label: contact.nextAction.label, texte: contact.nextAction.date ? `prévu le ${jourCourt(contact.nextAction.date)}` : "", flag: due ? contact.nextAction.label.toLowerCase() : "" };
  }
  return null;
}

// --- Historique (rempli seul) --------------------------------------------

export function historiqueContact({ contact = {}, quotes = [], invoices = [], visites = [] } = {}) {
  const l = [];
  for (const e of contact.journal || []) l.push({ type: e.kind === "appel" ? "appels" : "appels", quand: e.at, titre: e.kind === "appel" ? "Appel" : "Note", texte: `« ${e.text} »${e.dictee ? " · noté par dictée" : ""}`, id: e.id });
  for (const q of quotes) {
    const num = q.quoteNumber || "";
    if (signe(q)) l.push({ type: "documents", quand: q.signedAt || q.updatedAt, titre: "Devis", texte: `Devis ${num} signé · ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n(q.totalHt))} HT`, id: `q-${q.id}` });
    else if (q.sentAt || q.status === "Envoye") l.push({ type: "documents", quand: q.sentAt || q.updatedAt, titre: "Devis", texte: `Devis ${num} envoyé`, id: `q-${q.id}` });
  }
  for (const i of invoices) {
    if (!EMISES.has(i.status) && i.status !== "Annulee") continue;
    const quoi = libelleFacture(i);
    const echue = i.status !== "Payee" && i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10) && resteDu(i) > 0;
    l.push({ type: "documents", quand: i.issuedAt || i.createdAt, titre: "Facture", texte: `${quoi === "facture" ? "Facture" : quoi[0].toUpperCase() + quoi.slice(1)} ${i.invoiceNumber || ""}${echue ? " échue" : i.status === "Payee" ? " payée" : ""} · ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n(i.amountTtc))}`, id: `f-${i.id}` });
  }
  for (const v of visites) l.push({ type: "documents", quand: v.date || v.createdAt, titre: "Visite", texte: `Visite technique${v.photos?.length ? ` · ${v.photos.length} photos` : ""}`, id: `v-${v.id}` });
  for (const m of contact.messages || []) l.push({ type: "messages", quand: m.at, titre: "Message", texte: `« ${m.text} »`, id: m.id });
  return l.filter((x) => x.quand).sort((a, b) => String(b.quand).localeCompare(String(a.quand)));
}

export const dernierEchange = (hist = [], contact = {}) => jour(hist[0]?.quand || contact.updatedAt || contact.createdAt);

// --- Ajouter : doublons, fichier ------------------------------------------

// Même SIREN, téléphone ou e-mail : « Compléter la fiche existante » par défaut.
export function doublon(contacts = [], saisie = {}) {
  const siren = normalizeSiret(saisie.siret).slice(0, 9);
  const tel = normalizePhone(saisie.phone);
  const email = normalizeEmail(saisie.email);
  for (const c of contacts) {
    if (c.archived) continue;
    if (siren.length === 9 && normalizeSiret(c.siret).slice(0, 9) === siren) return { contact: c, par: "même SIREN" };
    if (tel.length >= 9 && normalizePhone(c.phone) === tel) return { contact: c, par: "même téléphone" };
    if (email && normalizeEmail(c.email) === email) return { contact: c, par: "même e-mail" };
  }
  return null;
}

// Fichier CSV ou export Excel en CSV : en-têtes reconnus en français ou en anglais.
const COLONNES = {
  nom: ["nom", "name", "last name", "lastname", "nom de famille"],
  prenom: ["prénom", "prenom", "first name", "firstname"],
  societe: ["entreprise", "société", "societe", "raison sociale", "company", "organisation"],
  telephone: ["téléphone", "telephone", "tel", "tél", "mobile", "phone", "portable"],
  email: ["e-mail", "email", "mail", "courriel"],
  adresse: ["adresse", "address", "rue"],
  siret: ["siret", "siren"],
  type: ["type", "rôle", "role", "catégorie", "categorie"]
};
export function lireCsvContacts(texte = "") {
  const lignes = String(texte).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const sep = (lignes[0].match(/;/g) || []).length >= (lignes[0].match(/,/g) || []).length ? ";" : ",";
  const cellules = (l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const tete = cellules(lignes[0]).map((h) => h.toLowerCase());
  const idx = Object.fromEntries(Object.entries(COLONNES).map(([k, noms]) => [k, tete.findIndex((h) => noms.includes(h))]));
  const roleDe = (t) => {
    const s = String(t || "").toLowerCase();
    if (/sous/.test(s)) return "sous_traitant";
    if (/fourn/.test(s)) return "fournisseur";
    if (/archi|prescri/.test(s)) return "architecte";
    if (/prospect/.test(s)) return "prospect";
    return "client";
  };
  return lignes.slice(1).map(cellules).map((c) => {
    const get = (k) => (idx[k] >= 0 ? c[idx[k]] || "" : "");
    const societe = get("societe");
    return {
      type: societe ? "societe" : "particulier",
      firstName: get("prenom"), lastName: get("nom"), companyName: societe,
      phone: get("telephone"), email: get("email"), address: get("adresse"), siret: get("siret"),
      roles: [roleDe(get("type"))]
    };
  }).filter((x) => x.lastName || x.companyName || x.firstName).slice(0, 500);
}

// --- Sous-traitant : prix constatés et chantiers (PRO-10.1) -------------

// Pièces de dépenses de ce sous-traitant (même SIREN ou même nom).
export function piecesDuPro(contact = {}, pieces = []) {
  const nom = String(contact.companyName || contactDisplayName(contact) || "").toLowerCase().split(/\s+/).filter((m) => m.length > 2).slice(0, 2).join(" ");
  return pieces.filter((p) => p.contactId === contact.id || (nom && String(p.fournisseur || "").toLowerCase().includes(nom)));
}

export function prixConstates(pieces = []) {
  const parLigne = new Map();
  for (const p of pieces) for (const l of p.lignes || []) {
    const q = n(l.quantite);
    if (!(q > 0) || !(n(l.montantHt) > 0) || !l.designation) continue;
    const cle = String(l.designation).toLowerCase().replace(/\s+/g, " ").slice(0, 60);
    if (!parLigne.has(cle)) parLigne.set(cle, { designation: l.designation, unite: l.unite || "", prix: [] });
    parLigne.get(cle).prix.push(n(l.montantHt) / q);
  }
  return [...parLigne.values()].map((x) => ({ designation: x.designation, unite: x.unite, prixHt: r2(x.prix.reduce((s, v) => s + v, 0) / x.prix.length), fois: x.prix.length })).slice(0, 6);
}

export function chantiersDuPro(pieces = [], titres = new Map(), annee = new Date().getFullYear()) {
  const g = new Map();
  for (const p of pieces.filter((x) => x.statut === "rangee" && x.projectId)) {
    const c = g.get(p.projectId) || { projectId: p.projectId, title: titres.get(p.projectId) || p.projectTitle || "Chantier", lot: p.lot || "", ht: 0, autoliquidation: false };
    c.ht = r2(c.ht + n(p.ht));
    c.autoliquidation = c.autoliquidation || Boolean(p.autoliquidation);
    g.set(p.projectId, c);
  }
  const annuel = r2(pieces.filter((p) => p.statut === "rangee" && String(p.date).startsWith(String(annee))).reduce((s, p) => s + n(p.ht), 0));
  return { chantiers: [...g.values()], cumulAnnee: annuel, autoliquidation: [...g.values()].some((c) => c.autoliquidation) };
}
