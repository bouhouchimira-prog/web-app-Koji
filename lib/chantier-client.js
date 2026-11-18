import { avancementChantier, estASigner, estSigne, montant, nomEntreprise, titreChantier } from "./projets-client.js";
import { ecartsVersions, libelleEcart } from "./devis-versions.js";
import { encaisse, paiementsDe, resteDu } from "./encaissements.js";
import { TYPE_FACTURE_SOLDE, montantsSolde, plusAns } from "./cloture-chantier.js";
import { dateTache, estAffectee, tachesParLot } from "./taches-chantier.js";
import { verifications } from "./kojipage.js";
import { finValidite } from "./devis-liste.js";
import { computeSurchargeBreakdown, libelleMajoration } from "./quote-calculations.js";
import { itemTotalHt, lignesTvaDocument, quoteTotals, vatRateFromQuote } from "./document-generator/shared.js";
import { regleSignature } from "./signature-devis.js";

// Koji Client · « signer, suivre, payer » (maquette CLI-02) : la page d'un
// devis ou d'un chantier du particulier, en quatre onglets (Devis, Chantier,
// Paiements, Documents). Règles pures, partagées par le site et l'app Koji :
// le serveur fabrique les libellés, les deux écrans les affichent tels quels.
// Rien n'est inventé : une donnée absente n'apparaît pas.
//
// Pas de paiement en ligne (aucun prestataire choisi) : les factures se
// téléchargent et se règlent par virement, avec les coordonnées de la facture.

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const jourDe = (v) => String(v || "").slice(0, 10);
const valide = (j) => /^\d{4}-\d{2}-\d{2}$/.test(j);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// Jour de Paris (AAAA-MM-JJ) d'un instant ISO, ou le jour tel quel.
export function jourParis(iso) {
  const texte = String(iso || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) return texte;
  const d = new Date(texte);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d) : "";
}

// « 9 nov. », « 9 nov. 2026 », « 20 décembre ».
export function dateCourte(iso, avecAnnee = false) {
  const j = jourParis(iso);
  if (!valide(j)) return "";
  return `${Number(j.slice(8, 10))} ${MOIS[Number(j.slice(5, 7)) - 1]}${avecAnnee ? ` ${j.slice(0, 4)}` : ""}`;
}
export function dateLongue(iso, avecAnnee = false) {
  const j = jourParis(iso);
  if (!valide(j)) return "";
  return `${Number(j.slice(8, 10))} ${MOIS_LONGS[Number(j.slice(5, 7)) - 1]}${avecAnnee ? ` ${j.slice(0, 4)}` : ""}`;
}
// « 3 nov. 2026 à 09:12 » (heure de Paris).
export function dateHeure(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${dateCourte(iso, true)} à ${heure}`;
}

const tauxTexte = (t) => `${String(r2(t)).replace(".", ",")} %`;

// ─── Devis ────────────────────────────────────────────────────────────

const MOTIFS_TVA = { 10: "logement de plus de 2 ans", 5.5: "amélioration énergétique" };
const UNITES_MUETTES = new Set(["", "u", "u.", "unite", "unité", "forfait", "ft", "ens", "ens."]);

function quantiteTexte(item) {
  const q = Number(item.quantity);
  if (!Number.isFinite(q) || q <= 0) return "";
  const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(q).replace(/ /g, " ");
  const unite = String(item.unit || "").trim();
  return UNITES_MUETTES.has(unite.toLowerCase()) ? nombre : `${nombre} ${unite}`;
}

function numeroVersion(q) {
  const versions = Array.isArray(q.versions) ? q.versions : [];
  const derniere = versions[versions.length - 1];
  const n = Number(derniere?.number) || Number(q.versionNumber) || 1;
  return n > 0 ? n : 1;
}

// Lignes du devis telles que sur le PDF : variantes et lignes hors total signalées.
export function lignesDevis(q = {}) {
  return (q.items || []).map((item, i) => {
    const fournitures = item.showMaterialsToClient !== false && Array.isArray(item.materialLines)
      ? item.materialLines.map((m) => m.productName || m.category).filter(Boolean).join(", ")
      : "";
    return {
      cle: `${item.room || ""}-${item.code || item.label || ""}-${i}`,
      libelle: String(item.label || "Ouvrage"),
      lot: String(item.room || ""),
      quantite: quantiteTexte(item),
      montantHt: montant(itemTotalHt(item)),
      note: [item.variante ? "variante, hors total" : item.horsTotal ? "hors total" : "", fournitures ? `fournitures : ${fournitures}` : ""].filter(Boolean).join(" · ")
    };
  });
}

// Totaux : majorations montrées au client, HT, TVA par taux avec son motif, TTC.
export function totauxDevis(q = {}) {
  const vatRate = vatRateFromQuote(q);
  const totals = quoteTotals(q, vatRate);
  const itemsHt = (q.items || []).filter((i) => !i.variante && !i.horsTotal).reduce((s, i) => s + itemTotalHt(i), 0);
  const majorations = computeSurchargeBreakdown(itemsHt, q.surcharges || []).lines
    .filter((s) => s.mode === "client" || (!s.mode && s.showToClient))
    .map((s) => ({ libelle: libelleMajoration(s), montant: montant(s.amount) }));
  const tva = lignesTvaDocument(q, vatRate).map((l) => {
    if (q.autoliquidation) return { libelle: "TVA · autoliquidation par le preneur", montant: montant(0) };
    const t = Number(String(l.label).replace(/[^0-9,.]/g, "").replace(",", "."));
    const motif = MOTIFS_TVA[t] && q.tva?.local !== "professionnel" && q.tva?.local !== "logement-neuf" ? ` · ${MOTIFS_TVA[t]}` : "";
    return { libelle: `TVA ${tauxTexte(t)}${motif}`, montant: montant(l.montant) };
  });
  return [
    ...majorations,
    { libelle: "Total HT", montant: montant(totals.totalHt) },
    ...tva,
    { libelle: q.autoliquidation ? "Net à payer" : "Total TTC", montant: montant(totals.totalTtc), fort: true }
  ];
}

// « Ce qui change depuis la version 1 : − 236,28 € TTC » (PRO-03.6).
export function changementsVersion(q = {}) {
  const versions = Array.isArray(q.versions) ? q.versions : [];
  if (versions.length < 2) return null;
  const avant = versions[versions.length - 2];
  const apres = versions[versions.length - 1];
  const e = ecartsVersions(avant, apres, { tauxTva: q.vatRate || 0 });
  const ecart = e.totalTtc.ecart;
  const signeEcart = ecart > 0 ? `+ ${montant(ecart)}` : ecart < 0 ? `− ${montant(-ecart)}` : "même total";
  const premiere = e.lignes[0];
  const quoi = premiere ? `, ${premiere.label} ${premiere.kind === "del" ? "retiré" : premiere.kind === "add" ? "ajouté" : "modifié"}${e.lignes.length > 1 ? ` et ${pluriel(e.lignes.length - 1, "autre changement", "autres changements")}` : ""}` : "";
  return {
    texte: `Ce qui change depuis la version ${Number(avant.number) || versions.length - 1} : ${signeEcart}${ecart ? " TTC" : ""}${quoi}`,
    lignes: e.lignes.map((l) => ({
      type: libelleEcart(l.kind),
      libelle: l.labelAvant ? `${l.label} au lieu de ${l.labelAvant}` : l.label,
      ecart: l.ecartTtc > 0 ? `+ ${montant(l.ecartTtc)}` : l.ecartTtc < 0 ? `− ${montant(-l.ecartTtc)}` : montant(0)
    })),
    avant: { titre: `Version ${Number(avant.number) || versions.length - 1}`, total: montant(e.totalTtc.avant), lignes: (avant.lines || []).map((l) => ({ libelle: l.label, montantHt: montant(l.totalHt) })) },
    note: "La version précédente reste consultable mais ne peut plus être signée."
  };
}

// Acompte demandé à la signature, d'après l'échéancier du devis.
export function acompteDevis(q = {}) {
  const jalons = (Array.isArray(q.paymentMilestones) ? q.paymentMilestones : []).filter((m) => Number(m.percent) > 0);
  if (!jalons.length) return null;
  const premier = jalons[0];
  const pct = Number(premier.percent);
  if (pct >= 100) return null;
  const total = Number(q.totalTtc) || 0;
  const suite = jalons.slice(1).map((m) => String(m.label || "").trim().toLowerCase()).filter(Boolean);
  const reste = suite.length ? ` · le reste en ${pluriel(suite.length, "fois", "fois")} (${suite.join(", ")})` : "";
  return {
    titre: "À régler à la signature",
    montant: montant((total * pct) / 100),
    pourcent: tauxTexte(pct),
    detail: `${String(premier.label || "acompte").trim().toLowerCase()} ${tauxTexte(pct)}${reste}`
  };
}

// Identité de l'entreprise lue sur le devis : forme, SIREN, décennale.
export function identiteEntreprise(entreprise = {}, maintenant = new Date().toISOString()) {
  const siren = String(entreprise.siren || String(entreprise.siret || "").replace(/\s/g, "").slice(0, 9)).replace(/\s/g, "");
  const sirenTexte = /^\d{9}$/.test(siren) ? `SIREN ${siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}` : "";
  const dec = entreprise.decennale || {};
  const jusqua = jourDe(dec.jusqua);
  const verif = verifications(entreprise.business || {}, maintenant).items.find((i) => i.id === "decennale");
  const enCours = !jusqua || jusqua >= jourParis(maintenant);
  const decennale = dec.assureur
    ? `décennale ${dec.assureur}${jusqua ? `, ${enCours ? "valable jusqu'au" : "expirée le"} ${dateCourte(jusqua, true)}` : ""}`
    : verif?.ok ? `décennale déclarée${jusqua ? `, valable jusqu'au ${dateCourte(jusqua, true)}` : ""}` : "";
  return {
    nom: String(entreprise.nom || "").trim() || "Votre entreprise",
    detail: [entreprise.forme, sirenTexte, decennale].filter(Boolean).join(" · "),
    decennale: decennale ? decennale.replace(/^décennale /, "") : "",
    decennaleJusqua: jusqua
  };
}

export function etatDevis(q = {}) {
  if (q.retracteLe) return "retracte";
  if (estSigne(q)) return "signe";
  if (estASigner(q)) return "a_signer";
  if (["Annule", "Annulee"].includes(q.status)) return "annule";
  if (q.status === "Refuse") return "refuse";
  return "autre";
}

const TITRES_DEVIS = { a_signer: "Devis à signer", signe: "Devis signé", retracte: "Devis annulé", annule: "Devis annulé", refuse: "Devis refusé", autre: "Devis" };

export function vueDevis(q = {}, { entreprise = {}, maintenant = new Date().toISOString(), pdf = "" } = {}) {
  const etat = etatDevis(q);
  const version = numeroVersion(q);
  const numero = String(q.quoteNumber || "").trim();
  const fin = finValidite(q);
  const id = identiteEntreprise(entreprise, maintenant);
  const signature = etat === "a_signer" ? regleSignature(q, { aujourdhui: jourParis(maintenant) }) : null;
  const local = q.tva?.local === "logement-ancien" ? "logement de plus de 2 ans" : q.tva?.local === "logement-neuf" ? "logement neuf" : "";
  return {
    etat,
    titreEcran: TITRES_DEVIS[etat],
    numero,
    version,
    titre: `Devis ${numero || ""}${version > 1 ? ` · version ${version}` : ""}`.replace("Devis  ·", "Devis ·").trim(),
    date: dateCourte(q.quoteDate || q.createdAtIso || q.sentAt || q.createdAt, true),
    validite: etat === "a_signer" && fin ? `valable jusqu'au ${dateCourte(fin)}` : "",
    entreprise: id,
    objet: [String(q.workDescription || (typeof q.project === "string" ? q.project : "") || "").trim(), String(q.chantierAddress || "").trim(), local].filter(Boolean).join(" · "),
    lignes: lignesDevis(q),
    totaux: totauxDevis(q),
    totalTtc: montant(q.totalTtc),
    changements: changementsVersion(q),
    acompte: acompteDevis(q),
    signeLe: etat === "signe" || etat === "retracte" ? (q.signedAt ? dateHeure(q.signedAt) : "") : "",
    signataire: String(q.signerName || "").trim(),
    retractation: retractationDevis(q, maintenant),
    pdf,
    signature
  };
}

// Délai de rétractation d'un devis signé (PRO-03.7).
export function retractationDevis(q = {}, maintenant = new Date().toISOString()) {
  if (q.retracteLe) return { etat: "retracte", texte: `Vous vous êtes rétracté le ${dateLongue(q.retracteLe, true)} : le devis est annulé.` };
  const fin = jourDe(q.retractationJusquau);
  if (!estSigne(q) || !valide(fin)) return null;
  if (fin < jourParis(maintenant)) return { etat: "termine", fin, texte: `Délai de rétractation terminé le ${dateLongue(fin)}.` };
  return {
    etat: "ouvert",
    fin,
    texte: `Vous pouvez annuler sans motif jusqu'au ${dateLongue(fin)} inclus, avec le formulaire joint au devis signé.${q.demarrageDemande ? ` Début des travaux le ${dateLongue(q.demarrageDemande)}, à votre demande.` : ""}`
  };
}

// ─── Chantier ─────────────────────────────────────────────────────────

const finTache = (t) => jourDe(t.validatedAt || t.finishedAt || t.endDate || t.dueDate || t.startDate);
const finPrevueTache = (t) => jourDe(t.endDate || t.dueDate || t.startDate);
const nomEquipe = (t) => (/^(equipe|équipe)$/i.test(String(t.assignedTo || "").trim()) ? "l'équipe" : String(t.assignedTo || "").trim());

function etapeTache(t) {
  if (t.done) return 3;
  if (t.clientValidationStatus === "Valide" || t.status === "Valide par client") return 2;
  if (t.pendingValidation || t.startedAt || t.status === "En cours" || t.status === "Terminee (a valider)") return 1;
  return 0;
}
const ETIQUETTES_TACHE = ["À venir", "En cours", "Validé", "Terminé"];

function etapeLot(lot, aujourdhui) {
  const taches = lot.taches;
  if (taches.length && taches.every((t) => t.done)) {
    const fin = taches.map(finTache).filter(valide).sort().pop();
    return { titre: lot.nom, etat: "fait", detail: fin ? `terminé le ${dateCourte(fin)}` : "terminé" };
  }
  const commence = taches.some((t) => t.done || etapeTache(t) > 0 || (valide(dateTache(t)) && dateTache(t) <= aujourdhui));
  if (commence) {
    const equipe = [...new Set(taches.filter((t) => !t.done && estAffectee(t)).map(nomEquipe))].slice(0, 2).join(", ");
    return { titre: lot.nom, etat: "en_cours", detail: `en cours${equipe ? ` · ${equipe}` : ""}` };
  }
  const debut = taches.map(dateTache).filter(valide).sort()[0];
  return { titre: lot.nom, etat: "a_venir", detail: debut ? `à partir du ${dateCourte(debut)}` : "à planifier" };
}

export function vueChantier(q = {}, { cloture = null, maintenant = new Date().toISOString() } = {}) {
  if (!estSigne(q) || q.retracteLe) return null;
  const aujourdhui = jourParis(maintenant);
  const taches = Array.isArray(q.tasks) ? q.tasks : [];
  const receptionLe = q.finChantier?.receptionLe || cloture?.pv?.signeLe || "";
  const avancement = avancementChantier({ ...q, finChantier: { ...(q.finChantier || {}), receptionLe } }, maintenant);
  const lots = tachesParLot(taches, q);
  const etapes = lots.map((lot) => etapeLot(lot, aujourdhui));
  const finPrevue = taches.map(finPrevueTache).filter(valide).sort().pop() || "";
  if (etapes.length || receptionLe) {
    etapes.push(receptionLe
      ? { titre: "Réception", etat: "fait", detail: `procès-verbal signé le ${dateCourte(receptionLe)}` }
      : { titre: "Réception", etat: "a_venir", detail: `${finPrevue ? `${dateLongue(finPrevue)} · ` : ""}vous signez le procès-verbal` });
  }
  const faites = taches.filter((t) => t.done).length;
  const pourcent = receptionLe ? 100 : taches.length ? Math.round((faites / taches.length) * 100) : 0;
  const lotsFaits = etapes.filter((e) => e.etat === "fait" && e.titre !== "Réception").length;
  const enCours = etapes.filter((e) => e.etat === "en_cours").map((e) => e.titre);
  const resume = receptionLe
    ? `Chantier terminé · réceptionné le ${dateLongue(receptionLe)}`
    : lots.length
      ? [
        `${pluriel(lotsFaits, "étape terminée", "étapes terminées")} sur ${lots.length}`,
        enCours.length ? `${enCours.join(", ")} en cours` : "",
        finPrevue ? `fin prévue le ${dateLongue(finPrevue)}` : ""
      ].filter(Boolean).join(" · ")
      : "L'entreprise n'a pas encore partagé le planning des travaux.";
  // Prochaine étape : la prochaine tâche datée, pas encore commencée.
  const prochaine = taches
    .filter((t) => !t.done && etapeTache(t) === 0 && valide(dateTache(t)) && dateTache(t) > aujourdhui)
    .sort((a, b) => dateTache(a).localeCompare(dateTache(b)))[0];
  const garantie = receptionLe ? plusAns(jourParis(receptionLe), 1) : "";
  const signaler = receptionLe
    ? (garantie >= aujourdhui ? { mode: "reserve", sousTitre: "photo et message · l'entreprise le reçoit comme une réserve et vous répond" } : null)
    : { mode: "alerte", sousTitre: "message à l'entreprise, sur un ouvrage ou tout le chantier · elle vous répond" };
  const titre = avancement.etat === "termine"
    ? "Votre chantier · terminé"
    : avancement.texte.startsWith("chantier en cours · ")
      ? `Votre chantier · ${avancement.texte.replace("chantier en cours · ", "")}`
      : avancement.etat === "a_venir" && /^début/.test(avancement.texte) ? `Votre chantier · ${avancement.texte}` : "Votre chantier";
  return {
    titre,
    etat: avancement.etat,
    avancement: { pourcent, texte: resume },
    etapes,
    prochaine: prochaine ? { titre: "Prochaine étape", texte: `${prochaine.label || prochaine.name || "Ouvrage"} · à partir du ${dateLongue(dateTache(prochaine))}` } : null,
    // Aucune route ne montre encore au client les photos « après » choisies
    // par l'entreprise (PRO-02.2) : pas de photo plutôt qu'une photo de travail.
    photo: null,
    taches: taches.map((t) => {
      const etape = etapeTache(t);
      const date = t.validatedAt || t.finishedAt ? `terminé le ${dateCourte(t.validatedAt || t.finishedAt)}` : valide(dateTache(t)) ? `prévu le ${dateCourte(dateTache(t))}` : "";
      return {
        id: t.id,
        libelle: String(t.label || t.name || "Ouvrage"),
        lot: String(t.room || ""),
        etape,
        etiquette: ETIQUETTES_TACHE[etape],
        detail: [date, estAffectee(t) ? nomEquipe(t) : ""].filter(Boolean).join(" · "),
        aValider: etape === 1 && Boolean(t.pendingValidation || t.status === "Terminee (a valider)")
      };
    }),
    signaler,
    receptionLe: receptionLe ? jourParis(receptionLe) : "",
    note: "Seules les informations partagées par l'entreprise apparaissent ici ; ses photos de travail restent chez elle."
  };
}

// ─── Paiements ────────────────────────────────────────────────────────

const estLiberation = (f) => String(f.notes || "").startsWith("Libération de la retenue");

function titreFacture(f) {
  const type = String(f.type || "").trim();
  let nom = type || "Facture";
  if (type === TYPE_FACTURE_SOLDE) nom = estLiberation(f) ? "Libération de la retenue" : "Facture de solde";
  else if (/acompte/i.test(type)) nom = "Facture d'acompte";
  else if (/^facture intermediaire$/i.test(type)) nom = "Facture intermédiaire";
  else if (/devis transforme/i.test(type)) nom = "Facture";
  return `${nom} ${f.invoiceNumber || ""}`.trim();
}

const facturesDuDevis = (q, factures = []) => factures.filter((f) => !f.archived && ((q.id && f.quoteId === q.id) || (q.projectId && f.projectId === q.projectId)));

// Montant des avoirs (actifs) qui corrigent une facture.
function creditDe(f, factures) {
  return r2(factures.filter((a) => a.kind === "avoir" && a.refInvoiceId === f.id && a.status !== "Annulee").reduce((s, a) => s + Math.abs(Number(a.amountTtc) || 0), 0));
}

function datePaiement(f) {
  const liste = paiementsDe(f);
  return jourDe(liste[liste.length - 1]?.date || f.paidAt || f.updatedAt);
}

export const lienFacture = (f) => `/api/client/factures/${encodeURIComponent(f.id)}/pdf`;

// Une ligne de paiement : payé, à payer ; null pour un brouillon, un avoir
// ou une facture annulée.
export function lignePaiement(f, factures = [], aujourdhui = jourParis(new Date().toISOString())) {
  if (f.kind === "avoir" || ["Brouillon", "Annulee"].includes(f.status)) return null;
  const credit = creditDe(f, factures);
  // Annulée entièrement par un avoir : plus rien à payer, elle reste dans Documents.
  if (credit > 0 && credit >= Number(f.amountTtc || 0) - 0.01) return null;
  const du = resteDu(f, credit);
  const titre = titreFacture(f);
  if (f.status === "Payee" || du <= 0.01) {
    const le = datePaiement(f);
    return { id: f.id, titre, etat: "paye", detail: le ? `payée le ${dateCourte(le)}` : "payée", montant: montant(r2(Number(f.amountTtc) - credit)), pdf: lienFacture(f) };
  }
  const echeance = jourDe(f.dueDate);
  const recu = encaisse(f);
  const quand = valide(echeance) ? (echeance < aujourdhui ? `échue le ${dateCourte(echeance)}` : `à payer avant le ${dateCourte(echeance)}`) : "à payer";
  return {
    id: f.id, titre, etat: "a_payer", echeance: valide(echeance) ? echeance : "",
    detail: recu > 0 ? `${montant(recu)} reçus · reste ${quand}` : quand,
    montant: montant(du), du, pdf: lienFacture(f), note: String(f.notes || "").trim()
  };
}

export const NOTE_PAIEMENT = "Réglez par virement avec les coordonnées indiquées sur la facture. Koji ne reçoit pas les paiements.";

export function vuePaiements(q = {}, { factures = [], cloture = null, avenants = [], maintenant = new Date().toISOString() } = {}) {
  const aujourdhui = jourParis(maintenant);
  const duDevis = facturesDuDevis(q, factures);
  const lignes = duDevis
    .map((f) => ({ f, l: lignePaiement(f, factures, aujourdhui) }))
    .filter((x) => x.l)
    .sort((a, b) => String(a.f.issuedAt || a.f.createdAt || "").localeCompare(String(b.f.issuedAt || b.f.createdAt || "")))
    .map((x) => x.l);
  // Ce qui reste à facturer, d'après le devis et les avenants signés.
  const receptionLe = q.finChantier?.receptionLe || cloture?.pv?.signeLe || "";
  if (estSigne(q) && !q.retracteLe) {
    const actives = duDevis.filter((f) => ["Emise", "Payee"].includes(f.status));
    const soldeFait = actives.some((f) => f.type === TYPE_FACTURE_SOLDE && Number(f.amountTtc) > 0 && !estLiberation(f));
    const taux = Number(cloture?.pv?.retenue?.taux || cloture?.retenue?.taux || 0);
    const s = montantsSolde({ devis: q, avenants: avenants.filter((a) => a.quoteId === q.id), factures: actives, tauxRetenue: taux });
    if (!soldeFait && s.soldeTtc > 0.01) {
      lignes.push({ id: "a-venir", titre: "Reste à facturer", etat: "a_venir", detail: receptionLe ? "facture de solde à venir" : "situations et solde, selon l'avancement", montant: montant(s.soldeTtc), pdf: null });
    }
  }
  const dues = lignes.filter((l) => l.etat === "a_payer").sort((a, b) => (a.echeance || "9999").localeCompare(b.echeance || "9999"));
  const premiere = dues[0] || null;
  const retenue = texteRetenue(cloture, receptionLe);
  return {
    lignes: lignes.map(({ du, echeance, note, ...l }) => l),
    aPayer: premiere
      ? {
        titre: premiere.echeance ? (premiere.echeance < aujourdhui ? `À payer, échue le ${dateLongue(premiere.echeance)}` : `À payer avant le ${dateLongue(premiere.echeance)}`) : "À payer",
        montant: premiere.montant,
        detail: [premiere.titre, premiere.note].filter(Boolean).join(" · "),
        pdf: premiere.pdf,
        factureId: premiere.id
      }
      : null,
    retenue,
    vide: lignes.length ? "" : estSigne(q) ? "Aucune facture pour le moment. Elles arrivent ici dès que l'entreprise les envoie." : "Les factures arrivent ici après la signature du devis.",
    note: NOTE_PAIEMENT
  };
}

// Retenue de garantie (loi n° 71-584) : 5 % au plus, gardés par le client
// un an après la réception, puis facturés par l'entreprise.
export function texteRetenue(cloture, receptionLe) {
  const pv = cloture?.pv?.retenue;
  if (pv?.taux && !cloture?.retenue?.libereeLe && receptionLe) {
    return `Retenue de garantie : ${montant(pv.montantTtc)} (${tauxTexte(pv.taux)}) que vous gardez jusqu'au ${dateLongue(plusAns(jourParis(receptionLe), 1), true)}, au cas où une réserve ne serait pas levée. L'entreprise vous la facture ensuite.`;
  }
  if (!receptionLe && cloture?.retenue?.taux) {
    return `Une retenue de garantie de ${tauxTexte(cloture.retenue.taux)} est prévue : vous la gardez un an après la réception, au cas où une réserve ne serait pas levée.`;
  }
  return "";
}

// ─── Documents ────────────────────────────────────────────────────────

export function vueDocuments(q = {}, { factures = [], cloture = null, entreprise = {}, decennaleFichier = "", maintenant = new Date().toISOString() } = {}) {
  const docs = [];
  const signe = estSigne(q);
  const version = numeroVersion(q);
  const pdfDevis = `/api/client/quotes/${encodeURIComponent(q.id)}/pdf`;
  docs.push({
    id: "devis",
    titre: `${signe ? "Devis signé" : "Devis"}${version > 1 ? `, version ${version}` : ""}`,
    detail: [signe && q.signedAt ? dateCourte(q.signedAt) : "", `${montant(q.totalTtc)} TTC`, signe ? "preuve de signature" : estASigner(q) ? "à signer" : ""].filter(Boolean).join(" · "),
    lien: pdfDevis
  });
  const retr = retractationDevis(q, maintenant);
  if (retr?.etat === "ouvert") {
    docs.push({ id: "retractation", titre: "Formulaire de rétractation", detail: `à renvoyer avant le ${dateCourte(retr.fin)} inclus si vous changez d'avis · dernière page du devis signé`, lien: pdfDevis });
  }
  const id = identiteEntreprise(entreprise, maintenant);
  if (decennaleFichier) docs.push({ id: "decennale", titre: "Attestation décennale", detail: `${id.nom}${id.decennale ? ` · ${id.decennale}` : ""}`, lien: decennaleFichier });
  else if (id.decennale) docs.push({ id: "decennale", titre: "Assurance décennale", detail: `${id.nom} · ${id.decennale} · déclarée par l'entreprise`, lien: null });
  for (const f of facturesDuDevis(q, factures).filter((x) => x.status !== "Brouillon").sort((a, b) => String(a.issuedAt || a.createdAt || "").localeCompare(String(b.issuedAt || b.createdAt || "")))) {
    if (f.kind === "avoir") {
      docs.push({ id: f.id, titre: `Avoir ${f.invoiceNumber || ""}`.trim(), detail: `${montant(Math.abs(Number(f.amountTtc) || 0))}${f.refInvoiceNumber ? ` · corrige la facture ${f.refInvoiceNumber}` : ""}`, lien: lienFacture(f) });
      continue;
    }
    const l = lignePaiement(f, factures, jourParis(maintenant));
    const avoir = factures.find((a) => a.kind === "avoir" && a.refInvoiceId === f.id && a.status !== "Annulee");
    const etat = f.status === "Annulee" ? "annulée" : !l && avoir ? `annulée par l'avoir ${avoir.invoiceNumber || ""}`.trim() : l?.etat === "paye" ? "payée" : l?.detail || "";
    docs.push({ id: f.id, titre: titreFacture(f), detail: [dateCourte(f.issuedAt || f.createdAt), montant(f.amountTtc), etat].filter(Boolean).join(" · "), lien: lienFacture(f) });
  }
  if (q.finChantier?.dossierFinLe || cloture?.dossier?.remisLe) {
    docs.push({ id: "dossier", titre: "Dossier de fin de chantier", detail: `remis le ${dateCourte(q.finChantier?.dossierFinLe || cloture.dossier.remisLe)} · PV, factures, photos, notices, garanties`, lien: `/api/client/quotes/${encodeURIComponent(q.id)}/dossier` });
  }
  if (cloture?.pv?.signeLe) {
    docs.push({ id: "pv", titre: "Procès-verbal de réception", detail: `signé le ${dateCourte(cloture.pv.signeLe)}${cloture.pv.numero ? ` · ${cloture.pv.numero}` : ""}`, lien: `/api/client/chantier/${encodeURIComponent(q.id)}/pv` });
  } else if (signe && !q.retracteLe) {
    docs.push({ id: "pv", titre: "Procès-verbal de réception", detail: "signé avec l'entreprise à la fin des travaux", lien: null });
  }
  return docs;
}

export const NOTE_DOCUMENTS = "Tout reste téléchargeable ici après la fin du chantier. L'entreprise conserve aussi ses factures pendant la durée légale.";

// ─── La page entière ──────────────────────────────────────────────────

// « Écrire à l'entreprise » : la conversation de la demande Radar si le
// devis en vient, sinon l'e-mail de l'entreprise inscrit sur le devis.
export function contactEntreprise(q = {}, entreprise = {}) {
  const nom = String(entreprise.nom || nomEntreprise(q)).trim();
  if (q.chantierOffreId && q.userId) {
    return { lien: `/client/radar/${encodeURIComponent(q.chantierOffreId)}?entreprise=${encodeURIComponent(q.userId)}`, externe: false, sousTitre: `${nom} · conversation de votre demande` };
  }
  const email = String(entreprise.email || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const sujet = encodeURIComponent(`Devis ${q.quoteNumber || ""}`.trim());
    return { lien: `mailto:${email}?subject=${sujet}`, externe: true, sousTitre: `${nom} · par e-mail, ${email}` };
  }
  return null;
}

export const ONGLETS = ["devis", "chantier", "paiements", "documents"];

export function vueChantierClient(q = {}, { entreprise = {}, factures = [], cloture = null, avenants = [], decennaleFichier = "", maintenant = new Date().toISOString() } = {}) {
  const nom = String(entreprise.nom || nomEntreprise(q)).trim();
  const titre = titreChantier(q);
  const devis = vueDevis(q, { entreprise: { ...entreprise, nom }, maintenant, pdf: `/api/client/quotes/${encodeURIComponent(q.id)}/pdf` });
  const chantier = vueChantier(q, { cloture, maintenant });
  return {
    id: q.id,
    titre,
    entreprise: nom,
    surTitre: `${titre} · ${nom}`,
    etat: devis.etat,
    ongletParDefaut: devis.etat === "a_signer" || !chantier ? "devis" : "chantier",
    devis,
    chantier,
    paiements: vuePaiements(q, { factures, cloture, avenants, maintenant }),
    documents: { liste: vueDocuments(q, { factures, cloture, entreprise: { ...entreprise, nom }, decennaleFichier, maintenant }), note: NOTE_DOCUMENTS },
    contact: contactEntreprise(q, { ...entreprise, nom }),
    projectId: q.projectId || "",
    finChantier: q.finChantier || null
  };
}

// Page publique de signature (maquette CLI-07) : le devis, les règles de
// signature et, une fois signé, « Et maintenant » en trois étapes.
export function vueLienSignature(q = {}, { entreprise = {}, pdf = "", maintenant = new Date().toISOString() } = {}) {
  const nom = String(entreprise.nom || nomEntreprise(q)).trim();
  const devis = vueDevis(q, { entreprise: { ...entreprise, nom }, maintenant, pdf });
  const email = emailMasque(q.signerEmail || q.clientEmail);
  const signe = devis.etat === "signe";
  const etapes = [];
  if (signe) {
    etapes.push(devis.acompte
      ? { titre: "Acompte", texte: `${nom} vous envoie la facture d'acompte (${devis.acompte.pourcent} · ${devis.acompte.montant}).` }
      : { titre: "Factures", texte: `${nom} vous envoie ses factures selon les conditions du devis.` });
    const debut = jourDe(q.startDate);
    etapes.push({
      titre: "Date de début",
      texte: q.demarrageDemande
        ? `le ${dateLongue(q.demarrageDemande)}, à votre demande, avant la fin du délai de rétractation.`
        : valide(debut) ? `prévue le ${dateLongue(debut)} dans le devis ; l'entreprise vous la confirme.` : "l'entreprise vous propose une date."
    });
    etapes.push({ titre: "Suivre le chantier", texte: "avancement, factures et documents dans Koji Client ; vos accès arrivent par e-mail." });
  }
  return {
    devis,
    nom: String(q.signerName || q.client || "").trim(),
    emailMasque: email,
    intro: `Vous recevez ce devis par un lien envoyé par ${nom}. Pas de compte à créer : vérifiez, signez, vous recevez votre exemplaire par e-mail.`,
    apres: signe
      ? {
        texte: `Signé le ${devis.signeLe}.${email ? ` Votre exemplaire${q.retractationJusquau ? " et le formulaire de rétractation partent" : " part"} à ${email}.` : ""}`,
        etapes
      }
      : null,
    contact: contactEntreprise(q, { ...entreprise, nom })
  };
}

// « s••••@••••.fr » : l'adresse n'est pas réaffichée en entier.
export function emailMasque(email) {
  const [local, domaine] = String(email || "").split("@");
  if (!local || !domaine) return "";
  const ext = domaine.includes(".") ? domaine.slice(domaine.lastIndexOf(".")) : "";
  return `${local[0]}••••@••••${ext}`;
}

// « Paiements » du menu : tous les chantiers du particulier, regroupés.
export function paiementsDuClient(devis = [], { factures = [], clotures = [], avenants = [], maintenant = new Date().toISOString() } = {}) {
  const groupes = devis
    .filter((q) => estSigne(q) && !q.retracteLe)
    .map((q) => {
      const cloture = clotures.find((c) => c.projectId && c.projectId === q.projectId) || null;
      return {
        id: q.id,
        titre: titreChantier(q),
        entreprise: nomEntreprise(q),
        lien: `/client/chantier/${encodeURIComponent(q.id)}?onglet=paiements`,
        paiements: vuePaiements(q, { factures, cloture, avenants, maintenant })
      };
    })
    .filter((g) => g.paiements.lignes.length);
  const dues = groupes.flatMap((g) => g.paiements.aPayer ? [{ ...g.paiements.aPayer, chantier: g.titre }] : []);
  return {
    groupes,
    aPayer: dues.length ? dues.length : 0,
    vide: groupes.length ? "" : "Aucune facture pour le moment. Les factures de vos chantiers arrivent ici dès que l'entreprise les envoie.",
    note: NOTE_PAIEMENT
  };
}
