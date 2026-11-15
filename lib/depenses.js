// Dépenses Koji Pro (maquettes PRO-09 à 09.4) : pièces à ranger (tickets,
// factures), chantier proposé par Koji, doublons, coût réel d'un chantier
// par lot, marge prévue et estimée, journaux pour le comptable. Logique
// pure, testée dans tests/unit/depenses.test.js ; l'app porte les règles
// d'affichage en Dart.
import { computeQuoteItem } from "./quote-calculations.js";
import { besoinsChantier } from "./fournitures-chantier.js";
import { paiementsDe } from "./encaissements.js";
import { cleLigne } from "./chantiers-liste.js";

const n = (v, d = 0) => {
  if (v === null || v === undefined || v === "") return d;
  const x = Number(typeof v === "string" ? v.replace(/[\s  ]/g, "").replace(",", ".") : v);
  return Number.isFinite(x) ? x : d;
};
export const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const jour = (iso) => String(iso || "").slice(0, 10);

export const CATEGORIES = ["Fournitures", "Sous-traitance", "Location", "Carburant", "Outillage", "Frais généraux"];
// Ce qui ne va jamais sur un chantier : rangé d'office en frais généraux.
const SANS_CHANTIER = new Set(["Carburant", "Frais généraux"]);
export const SOURCES = { photo: "photo", pdf: "facture PDF", commande: "commande Koji", manuel: "saisie", csv: "fichier" };

// Pièce au format courant ; les dépenses saisies avant PRO-09 (label,
// amount, category) sont des pièces déjà rangées, montant = HT.
export function normaliserPiece(p = {}) {
  const ancien = p.statut === undefined;
  const ht = r2(p.ht ?? p.amount);
  const tva = r2(p.tva ?? 0);
  return {
    ...p,
    statut: ancien ? "rangee" : p.statut,
    type: p.type || "ticket",
    source: p.source && SOURCES[p.source] ? p.source : ancien ? "manuel" : "photo",
    fournisseur: p.fournisseur || p.label || "",
    date: jour(p.date || p.createdDate || p.createdAt),
    numero: p.numero || "",
    lignes: Array.isArray(p.lignes) ? p.lignes : [],
    ht,
    tva,
    ttc: r2(p.ttc ?? ht + tva),
    tauxTva: p.tauxTva ?? (ht > 0 && tva > 0 ? Math.round((tva / ht) * 1000) / 10 : 0),
    autoliquidation: Boolean(p.autoliquidation),
    categorie: p.categorie || (CATEGORIES.includes(p.category) ? p.category : "Fournitures"),
    projectId: p.projectId || "",
    lot: p.lot || "",
    fraisGeneraux: Boolean(p.fraisGeneraux),
    ancien
  };
}

// --- Doublons et chantier proposé (PRO-09) ------------------------------

const MOTS_VIDES = new Set(["sas", "sarl", "sa", "eurl", "agence", "magasin", "france", "pro", "paris", "les", "des", "and"]);
export function cleFournisseur(nom = "") {
  return sansAccents(nom).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((m) => m.length > 1 && !MOTS_VIDES.has(m))[0] || "";
}
const ecartJours = (a, b) => Math.abs(Date.parse(`${jour(a)}T12:00:00Z`) - Date.parse(`${jour(b)}T12:00:00Z`)) / 86400000;

// Même fournisseur et même numéro, ou même fournisseur, même montant TTC à
// 15 jours d'écart : probablement la même pièce reçue deux fois.
export function doublonDe(piece, pieces = []) {
  const f = cleFournisseur(piece.fournisseur);
  if (!f) return null;
  return pieces.find((x) => x.id !== piece.id && cleFournisseur(x.fournisseur) === f && (
    (piece.numero && x.numero && piece.numero === x.numero)
    || (Math.abs(n(x.ttc) - n(piece.ttc)) < 0.01 && n(piece.ttc) > 0 && ecartJours(x.date, piece.date) <= 15)
  )) || null;
}

const mots = (s) => new Set(sansAccents(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((m) => m.length > 3));
function correspond(ligne, besoin) {
  const a = mots(ligne);
  const b = mots(besoin);
  if (!a.size || !b.size) return false;
  const communs = [...a].filter((m) => b.has(m) || [...b].some((x) => x.length > 5 && m.length > 5 && (x.startsWith(m.slice(0, 6)) || m.startsWith(x.slice(0, 6))))).length;
  return communs >= Math.min(2, b.size);
}

// chantiers : [{ projectId, title, besoins: [{ name, lots }], bons: [numero] }]
export function proposerChantier(piece = {}, chantiers = []) {
  if (SANS_CHANTIER.has(piece.categorie)) {
    return { fraisGeneraux: true, sur: true, raison: `${piece.categorie.toLowerCase()}, aucun chantier`, autres: [] };
  }
  const texte = `${piece.bonCommande || ""} ${(piece.lignes || []).map((l) => l.designation).join(" ")}`;
  for (const c of chantiers) {
    const bon = (c.bons || []).find((num) => num && texte.includes(num));
    if (bon) return { projectId: c.projectId, title: c.title, lot: "", sur: true, raison: `commande ${bon}`, autres: [] };
  }
  const lignes = (piece.lignes || []).filter((l) => l.designation);
  const scores = chantiers.map((c) => {
    const lots = new Map();
    let score = 0;
    for (const l of lignes) {
      const b = (c.besoins || []).find((x) => correspond(l.designation, x.name));
      if (!b) continue;
      score += 1;
      for (const lot of b.lots || []) lots.set(lot, (lots.get(lot) || 0) + 1);
    }
    const lot = [...lots.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    return { c, score, lot };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  const autres = scores.slice(1, 3).map((s) => ({ projectId: s.c.projectId, title: s.c.title, raison: s.score ? `${s.score} article${s.score > 1 ? "s" : ""} correspondant${s.score > 1 ? "s" : ""}` : "aucun article correspondant" }));
  if (!best || best.score === 0) return null;
  const sur = best.score >= 2 && best.score * 2 >= lignes.length && (!second || second.score < best.score);
  return {
    projectId: best.c.projectId,
    title: best.c.title,
    lot: best.lot,
    sur,
    raison: `${best.score} article${best.score > 1 ? "s" : ""} sur ${lignes.length} prévu${best.score > 1 ? "s" : ""} au devis${best.lot ? ` (${best.lot})` : ""}`,
    autres
  };
}

// « Ranger les N sûres » : proposition sûre et pas de doublon.
export const estSure = (p) => p.statut === "a_ranger" && !p.doublonDe && Boolean(p.proposition?.sur);

// --- Coût d'un chantier (PRO-09.1, 09.2) --------------------------------

const lotDe = (item) => String(item.room || "Chantier").trim() || "Chantier";

// Prévu par lot : fournitures au prix d'achat (lignes et articles liés,
// comme la liste de fournitures du chantier) et heures de la bibliothèque.
export function prevuParLot({ quote = {}, avenants = [], articles = [] } = {}) {
  const lots = new Map();
  const lot = (nom) => {
    if (!lots.has(nom)) lots.set(nom, { lot: nom, fournitures: 0, heures: 0, lignes: 0, faites: 0 });
    return lots.get(nom);
  };
  for (const item of Array.isArray(quote.items) ? quote.items : []) {
    if (item.variante) continue;
    const l = lot(lotDe(item));
    l.lignes += 1;
    l.heures = r2(l.heures + n(computeQuoteItem(item, quote).correctedTimeHours));
  }
  for (const b of besoinsChantier({ quote, avenants, articles, parLot: true })) {
    const l = lot(b.lots[0] || "Chantier");
    l.fournitures = r2(l.fournitures + n(b.totalHt));
  }
  return [...lots.values()];
}

const signe = (a) => a.status === "Signe";

// Coût d'une heure pointée : taux du compagnon, sinon coût horaire moyen.
export function coutPointage(entree = {}, workers = [], coutHoraire = 0) {
  const minutes = n(entree.durationMinutes);
  if (minutes > 0) {
    const w = workers.find((x) => x.id === entree.workerId);
    return { heures: r2(minutes / 60), cout: r2((minutes / 60) * (n(w?.hourlyRate) || n(coutHoraire))) };
  }
  return { heures: 0, cout: r2(entree.amount) };
}

// Coût réel d'un chantier : dépensé (pièces rangées + heures pointées) et
// prévu (devis) par lot ; marge prévue et marge finale estimée « si les
// lots restants coûtent ce qui était prévu ». Sans coût horaire, pas de
// marge plutôt qu'une marge fausse.
export function coutChantier({ quote = null, avenants = [], articles = [], pieces = [], pointages = [], workers = [], taches = [], coutHoraire = 0, cloture = false } = {}) {
  const avenantsSignes = avenants.filter(signe);
  const devisHt = r2(quote?.totalHt);
  const avenantsHt = r2(avenantsSignes.reduce((s, a) => s + n(a.totalHtDelta), 0));
  const totalHt = r2(devisHt + avenantsHt);
  const prevus = quote ? prevuParLot({ quote, avenants: avenantsSignes, articles }) : [];
  // Avancement par lot : tâches faites sur les lignes du devis.
  (Array.isArray(quote?.items) ? quote.items : []).forEach((item, index) => {
    if (item.variante) return;
    const l = prevus.find((x) => x.lot === lotDe(item));
    const t = taches.find((x) => x.quoteItemId && x.quoteItemId === cleLigne(item, index)) || taches.find((x) => x.label === item.label && (x.room || "") === (item.room || ""));
    if (l && t?.done) l.faites += 1;
  });
  const rangees = pieces.filter((p) => p.statut === "rangee");
  const parLot = new Map();
  let autres = 0;
  for (const p of rangees) {
    if (p.lot && prevus.some((l) => l.lot === p.lot)) parLot.set(p.lot, r2((parLot.get(p.lot) || 0) + n(p.ht)));
    else autres = r2(autres + n(p.ht));
  }
  const suivi = pointages.length > 0;
  const mo = pointages.reduce((acc, e) => {
    const c = coutPointage(e, workers, coutHoraire);
    return { heures: r2(acc.heures + c.heures), cout: r2(acc.cout + c.cout) };
  }, { heures: 0, cout: 0 });
  const lignes = prevus.reduce((s, l) => s + l.lignes, 0);
  const faites = prevus.reduce((s, l) => s + l.faites, 0);
  const avancement = cloture ? 100 : lignes ? Math.round((faites / lignes) * 100) : 0;
  const lots = prevus.map((l) => {
    const depense = parLot.get(l.lot) || 0;
    const fait = cloture || (l.lignes > 0 && l.faites === l.lignes);
    const etat = fait ? "fait" : depense > 0 || l.faites > 0 ? "en_cours" : "a_venir";
    return { lot: l.lot, prevu: l.fournitures, depense, ecart: r2(depense - l.fournitures), etat, heures: l.heures, fait };
  });
  const heuresPrevues = r2(prevus.reduce((s, l) => s + l.heures, 0));
  const moPrevue = coutHoraire > 0 ? r2(heuresPrevues * coutHoraire) : null;
  const fournituresPrevues = r2(lots.reduce((s, l) => s + l.prevu, 0));
  const depense = r2(rangees.reduce((s, p) => s + n(p.ht), 0) + mo.cout);

  let margePrevue = null;
  let margeFinale = null;
  if (totalHt > 0 && moPrevue !== null) {
    const coutPrevu = fournituresPrevues + moPrevue;
    margePrevue = { euros: r2(totalHt - coutPrevu), pct: Math.round(((totalHt - coutPrevu) / totalHt) * 100) };
    // Lot fait : ce qu'il a coûté ; lot en cours ou à venir : au moins le prévu.
    const fournituresFinales = lots.reduce((s, l) => s + (l.fait ? l.depense : Math.max(l.depense, l.prevu)), 0) + autres;
    // Heures non pointées : main-d'œuvre comptée comme prévu.
    const moFinale = !suivi ? moPrevue : cloture ? mo.cout : Math.max(mo.cout, moPrevue);
    const euros = r2(totalHt - fournituresFinales - moFinale);
    margeFinale = { euros, pct: Math.round((euros / totalHt) * 100), delta: r2(euros - margePrevue.euros) };
  }
  const depasse = lots.filter((l) => l.prevu > 0 && l.depense > l.prevu * 1.1).sort((a, b) => b.ecart - a.ecart)[0] || null;
  let etat = "prevu";
  let phrase = "Dans le prévu";
  if (cloture) { etat = "cloture"; phrase = "Clôturé"; }
  else if (!quote) { etat = "sans_devis"; phrase = "Aucun devis rattaché"; }
  else if (margePrevue === null) { etat = "sans_cout"; phrase = "Coût horaire à renseigner pour voir la marge"; }
  else if (avancement < 25 && !depasse) { etat = "tot"; phrase = "Trop tôt pour juger"; }
  else if (depasse || margeFinale.pct < margePrevue.pct - 3) {
    etat = "regarder";
    phrase = depasse ? `${depasse.lot} : fournitures au-dessus du prévu` : "Marge en baisse";
  }
  return {
    devisHt, avenantsHt, totalHt, avancement, lots, autres,
    mo: { suivi, heures: mo.heures, depense: mo.cout, heuresPrevues, prevu: moPrevue },
    fournituresPrevues, depense, margePrevue, margeFinale, etat, phrase, depasse
  };
}

// Historique des dépenses d'un chantier (téléphone, PRO-09.2).
export function historiqueChantier({ pieces = [], pointages = [], workers = [], coutHoraire = 0, invoices = [] } = {}) {
  const lignes = [];
  for (const p of pieces.filter((x) => x.statut === "rangee")) {
    lignes.push({ type: p.categorie === "Fournitures" ? "fournitures" : "autres", date: p.date, titre: `${p.type === "facture" ? "Facture" : "Ticket"} ${p.fournisseur}`.trim(), detail: p.lot || p.categorie, montant: r2(p.ht), id: p.id });
  }
  for (const e of pointages) {
    const c = coutPointage(e, workers, coutHoraire);
    const h = Math.floor(c.heures);
    const m = Math.round((c.heures - h) * 60);
    lignes.push({ type: "heures", date: jour(e.date), titre: `Pointage ${e.workerName || ""}${c.heures ? ` · ${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : ""}`.trim(), detail: e.label || "", montant: c.cout, id: e.id });
  }
  for (const inv of invoices) {
    for (const pmt of paiementsDe(inv)) lignes.push({ type: "encaissements", date: jour(pmt.date), titre: `${/acompte/i.test(`${inv.type || ""} ${inv.notes || ""}`) ? "Acompte" : "Paiement"} reçu`, detail: inv.invoiceNumber || "", montant: -r2(pmt.amount), id: `${inv.id}-${pmt.id || pmt.date}` });
  }
  return lignes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// --- Export pour le comptable (PRO-09.4) --------------------------------

// « 2026-10 » (mois) ou « 2026-T4 » (trimestre) → bornes incluses.
export function bornesPeriode(periode = "") {
  const t = /^(\d{4})-T([1-4])$/.exec(periode);
  if (t) {
    const debutMois = (Number(t[2]) - 1) * 3 + 1;
    const fin = new Date(Date.UTC(Number(t[1]), debutMois + 2, 0)).toISOString().slice(0, 10);
    return { debut: `${t[1]}-${String(debutMois).padStart(2, "0")}-01`, fin };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return null;
  return { debut: `${periode}-01`, fin: new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10) };
}
const dans = (d, b) => Boolean(b) && jour(d) >= b.debut && jour(d) <= b.fin;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function libellePeriode(periode = "") {
  const t = /^(\d{4})-T([1-4])$/.exec(periode);
  if (t) return `${t[2]}${t[2] === "1" ? "er" : "e"} trimestre ${t[1]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  return m ? `${MOIS[Number(m[2]) - 1].replace(/^./, (c) => c.toUpperCase())} ${m[1]}` : periode;
}

const EMISES = new Set(["Emise", "Payee", "Partielle"]);
// HT et TVA d'une facture émise : taux de la facture, sinon rapport HT/TTC
// du devis, sinon 20 % (signalé).
export function venteHtTva(inv = {}, quotesParId = new Map()) {
  const ttc = r2(inv.amountTtc);
  const quote = inv.quoteId ? quotesParId.get(inv.quoteId) : null;
  let taux = inv.tauxTva !== undefined && inv.tauxTva !== null && inv.tauxTva !== "" ? n(inv.tauxTva) : null;
  let estime = false;
  if (taux === null && n(quote?.totalHt) > 0 && n(quote?.totalTtc) > 0) taux = Math.round((n(quote.totalTtc) / n(quote.totalHt) - 1) * 1000) / 10;
  if (taux === null) { taux = 20; estime = true; }
  const ht = r2(ttc / (1 + taux / 100));
  return { ht, tva: r2(ttc - ht), ttc, taux, estime };
}

export function journalVentes(invoices = [], quotesParId = new Map(), bornes) {
  return invoices
    .filter((inv) => !inv.archived && EMISES.has(inv.status) && dans(inv.issuedAt, bornes))
    .map((inv) => ({ date: jour(inv.issuedAt), numero: inv.invoiceNumber || "", client: inv.client || inv.clientName || "", libelle: inv.kind === "avoir" ? `Avoir sur ${inv.refInvoiceNumber || "facture"}` : inv.type || "Facture", avoir: inv.kind === "avoir", ...venteHtTva(inv, quotesParId) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero));
}

export function journalAchats(pieces = [], bornes, titres = new Map()) {
  return pieces
    .filter((p) => p.statut === "rangee" && dans(p.date, bornes))
    .map((p) => ({ date: p.date, fournisseur: p.fournisseur, numero: p.numero, type: p.type, categorie: p.categorie, chantier: p.fraisGeneraux ? "Frais généraux" : titres.get(p.projectId) || p.projectTitle || "", ht: r2(p.ht), tva: r2(p.tva), ttc: r2(p.ttc), taux: p.autoliquidation ? "autoliquidation" : p.tauxTva, justificatif: Boolean(p.fichier?.path), tvaEstimee: Boolean(p.tvaEstimee), id: p.id }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MOYENS = { virement: "virement", cb: "CB", carte: "CB", cheque: "chèque", especes: "espèces", lien: "lien de paiement" };
export function journalEncaissements(invoices = [], bornes) {
  const out = [];
  for (const inv of invoices) {
    if (inv.kind === "avoir" || inv.archived) continue;
    for (const p of paiementsDe(inv)) {
      if (!dans(p.date, bornes)) continue;
      out.push({ date: jour(p.date), numero: inv.invoiceNumber || "", client: inv.client || inv.clientName || "", moyen: MOYENS[p.moyen] || p.moyen || "virement", reference: p.reference || "", montant: r2(p.amount) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Numéros FAC-AAAA-NNNN de l'année : trous dans la série de l'entreprise.
export function numerotation(invoices = [], annee) {
  const nums = invoices
    .filter((i) => i.kind !== "avoir" && i.status !== "Brouillon")
    .map((i) => /^FAC-(\d{4})-(\d+)$/.exec(String(i.invoiceNumber || "")))
    .filter((m) => m && Number(m[1]) === Number(annee))
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);
  if (!nums.length) return { premier: null, dernier: null, trous: 0 };
  let trous = 0;
  for (let i = 1; i < nums.length; i += 1) trous += Math.max(0, nums[i] - nums[i - 1] - 1);
  const f = (x) => `FAC-${annee}-${String(x).padStart(4, "0")}`;
  return { premier: f(nums[0]), dernier: f(nums[nums.length - 1]), trous };
}

export function syntheseExport({ invoices = [], quotesParId = new Map(), pieces = [], periode, titres = new Map() }) {
  const bornes = bornesPeriode(periode);
  const ventes = journalVentes(invoices, quotesParId, bornes);
  const achats = journalAchats(pieces, bornes, titres);
  const encaissements = journalEncaissements(invoices, bornes);
  const somme = (l, k) => r2(l.reduce((s, x) => s + n(x[k]), 0));
  const tvaCollectee = somme(ventes, "tva");
  const tvaDeductible = somme(achats, "tva");
  const autoliquidees = achats.filter((a) => a.taux === "autoliquidation");
  const aRanger = pieces.filter((p) => p.statut === "a_ranger" && dans(p.date, bornes));
  const sansJustificatif = achats.filter((a) => !a.justificatif);
  const num = numerotation(invoices, Number(String(periode).slice(0, 4)));
  return {
    periode, libelle: libellePeriode(periode), bornes,
    ventes, achats, encaissements,
    totaux: {
      ventes: { factures: ventes.filter((v) => !v.avoir).length, avoirs: ventes.filter((v) => v.avoir).length, ht: somme(ventes, "ht"), tva: tvaCollectee, estimees: ventes.filter((v) => v.estime).length },
      achats: { factures: achats.filter((a) => a.type === "facture").length, tickets: achats.filter((a) => a.type !== "facture").length, ht: somme(achats, "ht"), tva: tvaDeductible, autoliquidees: autoliquidees.length, autoliquideesHt: somme(autoliquidees, "ht") },
      encaissements: { nombre: encaissements.length, ttc: somme(encaissements, "montant") }
    },
    tva: { collectee: tvaCollectee, deductible: tvaDeductible, solde: r2(tvaCollectee - tvaDeductible) },
    controles: [
      num.premier
        ? { ok: num.trous === 0, texte: num.trous === 0 ? `Numérotation continue : ${num.premier} à ${num.dernier}, aucun trou` : `Numérotation : ${num.trous} numéro${num.trous > 1 ? "s" : ""} manquant${num.trous > 1 ? "s" : ""} entre ${num.premier} et ${num.dernier}` }
        : { ok: true, texte: "Aucune facture numérotée cette année" },
      { ok: aRanger.length === 0, texte: aRanger.length ? `${aRanger.length} pièce${aRanger.length > 1 ? "s" : ""} encore à ranger` : "Toutes les pièces de la période sont rangées", lien: "a_ranger" },
      { ok: sansJustificatif.length === 0, texte: sansJustificatif.length ? `${sansJustificatif.length} pièce${sansJustificatif.length > 1 ? "s" : ""} sans justificatif dans Koji` : "Chaque pièce a son justificatif", ids: sansJustificatif.map((a) => a.id) },
      { ok: achats.every((a) => a.fournisseur && a.chantier), texte: achats.every((a) => a.fournisseur && a.chantier) ? "Chaque pièce a un fournisseur et un chantier" : "Des pièces n'ont pas de fournisseur ou de chantier" }
    ]
  };
}

// CSV pour le comptable : « ; », décimales à la virgule, BOM pour Excel.
export function csv(colonnes = [], lignes = []) {
  const cell = (v) => {
    const brut = typeof v === "number" ? String(r2(v)).replace(".", ",") : String(v ?? "");
    const s = /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut.split("-").reverse().join("/") : brut;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[colonnes.map((c) => cell(c.titre)).join(";"), ...lignes.map((l) => colonnes.map((c) => cell(l[c.cle])).join(";"))].join("\r\n")}\r\n`;
}
export const COLONNES = {
  ventes: [{ cle: "date", titre: "Date" }, { cle: "numero", titre: "Numéro" }, { cle: "client", titre: "Client" }, { cle: "libelle", titre: "Libellé" }, { cle: "ht", titre: "HT" }, { cle: "taux", titre: "Taux TVA" }, { cle: "tva", titre: "TVA" }, { cle: "ttc", titre: "TTC" }],
  achats: [{ cle: "date", titre: "Date" }, { cle: "fournisseur", titre: "Fournisseur" }, { cle: "numero", titre: "Numéro" }, { cle: "categorie", titre: "Catégorie" }, { cle: "chantier", titre: "Chantier" }, { cle: "ht", titre: "HT" }, { cle: "taux", titre: "Taux TVA" }, { cle: "tva", titre: "TVA" }, { cle: "ttc", titre: "TTC" }],
  encaissements: [{ cle: "date", titre: "Date" }, { cle: "numero", titre: "Facture" }, { cle: "client", titre: "Client" }, { cle: "moyen", titre: "Moyen" }, { cle: "reference", titre: "Référence" }, { cle: "montant", titre: "Montant TTC" }]
};

// Mois précédent (envoi automatique du 5).
export function moisPrecedent(aujourdhui = new Date().toISOString().slice(0, 10)) {
  const [a, m] = aujourdhui.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
