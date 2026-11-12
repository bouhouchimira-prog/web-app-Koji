// Réception et clôture d'un chantier (maquette PRO-02.4) : six étapes
// préparées par Koji — réception (PV signé sur place), réserves levées,
// facture de solde, dossier de fin de chantier, avis du client, retenue de
// garantie —, le bilan et les garanties datées à partir de la réception.
// Mêmes règles dans l'app Koji Pro (mobile/lib/apps/entreprise/chantiers/
// cloture.dart), testées sur les mêmes exemples.

import { heuresLigne, joursOuvresEntre } from "./planning-chantier.js";
import { reservesNonLevees } from "./reserves.js";

// Retenue de garantie : 5 % au plus (loi n° 71-584 du 16 juillet 1971),
// seulement si elle est prévue pour ce chantier.
export const TAUX_RETENUE = 5;
// Type de facture du solde dans Factures (PRO-06).
export const TYPE_FACTURE_SOLDE = "Facture finale";
const FACTURES_ACTIVES = new Set(["Brouillon", "Emise", "Payee"]);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function euro(n, decimales = 2) {
  const texte = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(Number(n) || 0);
  return `${texte.replace(/[  ]/g, " ")} €`;
}

function pourcent(n) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)} %`;
}

// Date de Paris (AAAA-MM-JJ) d'un instant ISO.
export function jourDeParis(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function heureParis(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d) : "";
}

const dateMidi = (jour) => new Date(`${String(jour).slice(0, 10)}T12:00:00Z`);

// « 4 déc. » ou « 4 déc. 2027 ».
export function dateCourte(jour, avecAnnee = false) {
  const d = dateMidi(jour);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", ...(avecAnnee ? { year: "numeric" } : {}) }).format(d);
}

export function plusAns(jour, ans) {
  const [a, m, j] = String(jour).slice(0, 10).split("-").map(Number);
  if (!a) return "";
  // 29 février → 28 février les années non bissextiles.
  const fin = new Date(Date.UTC(a + ans, m - 1, 1));
  const dernier = new Date(Date.UTC(a + ans, m, 0)).getUTCDate();
  fin.setUTCDate(Math.min(j, dernier));
  return fin.toISOString().slice(0, 10);
}

// Garanties légales à partir de la réception (C. civ. art. 1792 à 1792-6).
export function garanties(receptionLe) {
  const jour = receptionLe ? jourDeParis(receptionLe) : "";
  const jusqua = (ans) => (jour ? `jusqu'au ${dateCourte(plusAns(jour, ans), true)}` : "à partir de la réception");
  return [
    { id: "parfait", titre: "Parfait achèvement", duree: "1 an", jusqua: jusqua(1), objet: "tout désordre signalé par le client" },
    { id: "fonctionnement", titre: "Bon fonctionnement", duree: "2 ans", jusqua: jusqua(2), objet: "équipements posés : robinetterie, appareils, éclairage" },
    { id: "decennale", titre: "Décennale", duree: "10 ans", jusqua: jusqua(10), objet: "étanchéité, solidité de l'ouvrage" }
  ];
}

// Factures du chantier qui comptent dans « déjà facturé » (comme l'API des
// factures : brouillons, émises, payées ; avoirs en négatif).
export function facturesDuChantier(factures, { projectId, quoteId }) {
  return (factures || []).filter((f) => FACTURES_ACTIVES.has(f.status) && ((projectId && f.projectId === projectId) || (quoteId && f.quoteId === quoteId)));
}

// Note de la facture qui libère la retenue de garantie (même type « Facture
// finale », reconnue par sa note).
export const NOTE_LIBERATION_RETENUE = "Libération de la retenue de garantie (loi n° 71-584).";
const estLiberation = (f) => String(f.notes || "").startsWith("Libération de la retenue");
const parDate = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export function factureDeSolde(factures, ids) {
  return facturesDuChantier(factures, ids).filter((f) => f.type === TYPE_FACTURE_SOLDE && Number(f.amountTtc) > 0 && !estLiberation(f)).sort(parDate)[0] || null;
}

export function factureDeRetenue(factures, ids) {
  return facturesDuChantier(factures, ids).filter((f) => Number(f.amountTtc) > 0 && estLiberation(f)).sort(parDate)[0] || null;
}

// Facture de solde = travaux (devis + avenants signés) − déjà facturé −
// retenue de garantie. Les factures sont en TTC : le HT s'en déduit avec le
// taux de TVA moyen des travaux.
export function montantsSolde({ devis, avenants = [], factures = [], tauxRetenue = 0 }) {
  const signes = avenants.filter((a) => a.status === "Signe");
  const travauxHt = r2(Number(devis?.totalHt || 0) + signes.reduce((n, a) => n + Number(a.totalHtDelta || 0), 0));
  const travauxTtc = r2(Number(devis?.totalTtc || devis?.totalHt || 0) + signes.reduce((n, a) => n + Number(a.totalTtcDelta || 0), 0));
  const ratio = travauxHt > 0 && travauxTtc > 0 ? travauxTtc / travauxHt : 1;
  const dejaTtc = r2(factures.filter((f) => f.type !== TYPE_FACTURE_SOLDE || Number(f.amountTtc) < 0).reduce((n, f) => n + Number(f.amountTtc || 0), 0));
  const taux = Number(tauxRetenue) || 0;
  const retenueTtc = r2((travauxTtc * taux) / 100);
  const soldeTtc = r2(Math.max(0, travauxTtc - dejaTtc - retenueTtc));
  return {
    avenants: signes.map((a) => a.numero).filter(Boolean),
    travauxHt,
    travauxTtc,
    dejaTtc,
    dejaHt: r2(dejaTtc / ratio),
    tauxRetenue: taux,
    retenueHt: r2((travauxHt * taux) / 100),
    retenueTtc,
    soldeTtc,
    soldeHt: r2(soldeTtc / ratio)
  };
}

export function detailSolde(s) {
  const retenue = s.tauxRetenue ? ` − retenue ${euro(s.retenueHt)}` : "";
  return `travaux ${euro(s.travauxHt)} HT − déjà facturé ${euro(s.dejaHt)}${retenue} = ${euro(s.soldeHt)} HT · ${euro(s.soldeTtc)} TTC`;
}

// Note de la facture de solde (reprise sur la facture et le PV).
export function noteSolde(s, receptionLe) {
  if (!s.tauxRetenue) return "Facture de solde des travaux.";
  const jour = receptionLe ? jourDeParis(receptionLe) : "";
  const quand = jour ? `libérable le ${dateCourte(plusAns(jour, 1), true)}` : "libérable un an après la réception";
  return `Facture de solde. Retenue de garantie ${s.tauxRetenue} % : ${euro(s.retenueTtc)} TTC, ${quand} si aucune réserve n'est en cours (loi n° 71-584).`;
}

const numeros = (liste) => liste.map((r) => r.numero).join(", ");

function etapeReception(pv) {
  if (!pv?.signeLe) {
    return { id: "reception", titre: "Réception", ok: false, detail: "procès-verbal à faire signer sur place, à la fin des travaux", court: "PV à faire signer sur place", action: { id: "signer_pv", label: "Faire signer le PV" } };
  }
  const inscrites = pv.reserves || [];
  const quand = `le ${dateCourte(jourDeParis(pv.signeLe))}`;
  const reserves = inscrites.length ? `${inscrites.length} réserve${inscrites.length > 1 ? "s" : ""} inscrite${inscrites.length > 1 ? "s" : ""} (${numeros(inscrites)})` : "sans réserve";
  const court = inscrites.length ? `${inscrites.length} réserve${inscrites.length > 1 ? "s" : ""} (${numeros(inscrites)})` : "sans réserve";
  return {
    id: "reception",
    titre: "Réception",
    ok: true,
    detail: `PV signé par ${pv.signataire || "le client"} ${quand} à ${heureParis(pv.signeLe)} · ${reserves}`,
    court: `PV signé ${quand} · ${court}`,
    action: { id: "voir_pv", label: "Voir le PV" }
  };
}

function etapeReserves(reserves) {
  const ouvertes = reservesNonLevees(reserves);
  const levees = reserves.filter((r) => r.statut === "levee");
  if (!reserves.length) return { id: "reserves", titre: "Réserves levées", ok: true, detail: "aucune réserve sur ce chantier", court: "aucune réserve", action: null };
  if (!ouvertes.length) {
    const derniere = [...levees].sort((a, b) => String(b.leveeLe || "").localeCompare(String(a.leveeLe || "")))[0];
    const quand = derniere?.leveeLe ? ` · ${derniere.numero} le ${dateCourte(jourDeParis(derniere.leveeLe))}` : "";
    return { id: "reserves", titre: "Réserves levées", ok: true, detail: `${numeros(levees)} levée${levees.length > 1 ? "s" : ""}${quand}`, court: `${levees.length} levée${levees.length > 1 ? "s" : ""} sur ${reserves.length}`, action: { id: "reserves", label: "Voir" } };
  }
  const premiere = [...ouvertes].sort((a, b) => String(a.pourLe || "9999").localeCompare(String(b.pourLe || "9999")))[0];
  const suite = premiere.pourLe ? `${premiere.numero} avant le ${dateCourte(premiere.pourLe)}` : `${premiere.numero} à lever`;
  const texte = `${levees.length} levée${levees.length > 1 ? "s" : ""} sur ${reserves.length} · ${suite}`;
  return { id: "reserves", titre: "Réserves levées", ok: false, detail: texte, court: texte, action: { id: "reserves", label: "Voir" }, reserve: premiere };
}

function etapeSolde(solde, facture) {
  if (facture) {
    return { id: "solde", titre: "Facture de solde", ok: true, detail: `${facture.invoiceNumber || "facture"} · ${euro(facture.amountTtc)} TTC${facture.status === "Brouillon" ? " · brouillon" : ""}`, court: `${euro(facture.amountTtc)} TTC · ${facture.status === "Payee" ? "payée" : facture.status === "Brouillon" ? "brouillon" : "émise"}`, action: { id: "facture", label: "Voir" } };
  }
  if (solde.travauxTtc > 0 && solde.soldeTtc <= 0.01) {
    return { id: "solde", titre: "Facture de solde", ok: true, detail: "travaux déjà entièrement facturés", court: "déjà facturé", action: null };
  }
  if (!(solde.travauxTtc > 0)) {
    return { id: "solde", titre: "Facture de solde", ok: false, detail: "pas de devis signé sur ce chantier", court: "pas de devis signé", action: null };
  }
  return { id: "solde", titre: "Facture de solde", ok: false, detail: detailSolde(solde), court: `${euro(solde.soldeTtc)} TTC · prête`, action: { id: "emettre_solde", label: "Émettre", principal: true } };
}

function etapeRetenue(solde, cloture, pv, facture, factureRetenue, aujourdhui) {
  const retenue = cloture?.retenue || {};
  if (!solde.tauxRetenue) {
    return { id: "retenue", titre: "Retenue de garantie", ok: true, detail: "pas de retenue de garantie sur ce chantier", court: "aucune", action: facture ? null : { id: "retenue_on", label: `Prévoir ${TAUX_RETENUE} %` } };
  }
  const montant = `${euro(solde.retenueTtc)} TTC`;
  if (factureRetenue) return { id: "retenue", titre: "Retenue de garantie", ok: true, detail: `${montant} · facturée (${factureRetenue.invoiceNumber || "facture"})`, court: "libérée", action: { id: "facture_retenue", label: "Voir" } };
  if (retenue.libereeLe) return { id: "retenue", titre: "Retenue de garantie", ok: true, detail: `${montant} · libérée le ${dateCourte(jourDeParis(retenue.libereeLe), true)}`, court: "libérée", action: null };
  if (!pv?.signeLe) {
    return { id: "retenue", titre: "Retenue de garantie", ok: false, detail: `${montant} · libérable un an après la réception si aucune réserve en cours`, court: montant, action: facture ? null : { id: "retenue_off", label: "Retirer" } };
  }
  const liberable = plusAns(jourDeParis(pv.signeLe), 1);
  if (aujourdhui >= liberable) {
    return { id: "retenue", titre: "Retenue de garantie", ok: false, du: true, detail: `${montant} · libérable depuis le ${dateCourte(liberable, true)} si aucune réserve en cours`, court: `${montant} · à libérer`, action: { id: "facturer_retenue", label: "Facturer la retenue" } };
  }
  return {
    id: "retenue",
    titre: "Retenue de garantie",
    ok: false,
    detail: `${montant} · libérable le ${dateCourte(liberable, true)} si aucune réserve en cours · Koji vous le rappelle`,
    court: `${montant} · le ${dateCourte(liberable, true)}`,
    action: retenue.rappelId ? { id: null, label: "Rappel prévu" } : { id: "rappel", label: "Prévoir le rappel" }
  };
}

// Les six étapes, dans l'ordre de la maquette ; la première non faite est
// « cur » (la retenue ne le devient qu'à sa date).
export function etapesCloture({ cloture = null, reserves = [], solde, factureSolde = null, factureRetenue = null, aujourdhui = new Date().toISOString().slice(0, 10) }) {
  const pv = cloture?.pv || null;
  const avisDemande = Boolean(cloture?.avis?.demandeLe);
  const avisProgramme = Boolean(cloture?.avis?.programme);
  const etapes = [
    etapeReception(pv),
    etapeReserves(reserves),
    etapeSolde(solde, factureSolde),
    { id: "dossier", titre: "Dossier de fin de chantier", ok: Boolean(cloture?.dossier?.remisLe), detail: cloture?.dossier?.remisLe ? `remis au client le ${dateCourte(jourDeParis(cloture.dossier.remisLe))}` : "photos après, factures, attestation décennale, notices et garanties", court: cloture?.dossier?.remisLe ? "remis" : "à préparer", action: { id: "dossier", label: cloture?.dossier?.remisLe ? "Voir" : "Préparer" } },
    { id: "avis", titre: "Avis du client", ok: avisDemande, detail: avisDemande ? `demandé le ${dateCourte(jourDeParis(cloture.avis.demandeLe))} · publié sur votre KojiPage` : "demandé à l'envoi de la facture de solde · publié sur votre KojiPage", court: avisDemande ? "demandé" : avisProgramme ? "programmé après le solde" : "demandé après le solde", action: avisDemande ? null : avisProgramme ? { id: "avis_off", label: "Programmé" } : { id: "avis_on", label: "Programmer" } },
    etapeRetenue(solde, cloture, pv, factureSolde, factureRetenue, aujourdhui)
  ];
  let cur = false;
  return etapes.map((e) => {
    if (e.ok) return { ...e, etat: "ok" };
    if (!cur && (e.id !== "retenue" || e.du)) {
      cur = true;
      return { ...e, etat: "cur" };
    }
    return { ...e, etat: "todo" };
  });
}

// « Travaux réceptionnés : 4 lots · devis 2026-041 et avenant AV-1 ».
export function travauxReceptionnes(devis, nbLots, avenants = []) {
  const lots = nbLots ? `${nbLots} lot${nbLots > 1 ? "s" : ""} · ` : "";
  const av = avenants.length ? ` et avenant${avenants.length > 1 ? "s" : ""} ${avenants.join(", ")}` : "";
  return `${lots}devis ${devis?.quoteNumber || ""}${av}`.trim();
}

const heures = (h) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(h)} h`;

// Bilan : travaux, dépensé, marge (prévue d'après le budget estimé), durée
// réelle en jours ouvrés, et ce que Koji a appris (temps pointés au-delà du
// devis, sinon rien).
export function bilanChantier({ solde, depenses = [], budgetEstime = 0, taches = [], devis = null, receptionLe = "", aujourdhui = new Date().toISOString().slice(0, 10) }) {
  const depense = r2(depenses.reduce((n, d) => n + Number(d.amount || 0), 0));
  const lignes = [];
  lignes.push({ id: "travaux", label: solde.avenants.length ? `Devis + avenant${solde.avenants.length > 1 ? "s" : ""} ${solde.avenants.join(", ")}` : "Devis", valeur: `${euro(solde.travauxHt)} HT` });
  lignes.push({ id: "depense", label: "Dépensé", valeur: depenses.length ? `${euro(depense, 0)} · ${depenses.length} dépense${depenses.length > 1 ? "s" : ""}` : "aucune dépense saisie" });
  if (solde.travauxHt > 0 && depenses.length) {
    const marge = ((solde.travauxHt - depense) / solde.travauxHt) * 100;
    const prevue = budgetEstime > 0 ? ` · prévue ${pourcent(((solde.travauxHt - budgetEstime) / solde.travauxHt) * 100)}` : "";
    lignes.push({ id: "marge", label: "Marge", valeur: `${pourcent(marge)}${prevue}` });
  }
  const debuts = taches.map((t) => String(t.startDate || "").slice(0, 10)).filter(Boolean).sort();
  const finsPrevues = taches.map((t) => String(t.endDate || t.dueDate || "").slice(0, 10)).filter(Boolean).sort();
  if (debuts.length) {
    const fin = receptionLe ? jourDeParis(receptionLe) : aujourdhui;
    const reel = joursOuvresEntre(debuts[0], fin);
    const prevu = finsPrevues.length ? joursOuvresEntre(debuts[0], finsPrevues.at(-1)) : 0;
    const jours = (n) => `${n} jour${n > 1 ? "s" : ""} ouvré${n > 1 ? "s" : ""}`;
    // Pas encore commencé : seulement la durée prévue.
    if (reel > 0) lignes.push({ id: "duree", label: "Durée", valeur: `${jours(reel)}${receptionLe ? "" : " à ce jour"}${prevu ? ` · prévu ${prevu}` : ""}` });
    else if (prevu) lignes.push({ id: "duree", label: "Durée prévue", valeur: jours(prevu) });
  }
  return { lignes, appris: appris(taches, devis) };
}

function appris(taches, devis) {
  const items = devis?.items || [];
  let pire = null;
  for (const t of taches) {
    const fait = Number(t.consumedMinutes || 0) / 60;
    if (!(fait > 0)) continue;
    const ligne = items.find((l, i) => `${l.roomId || l.room || "chantier"}-${l.taskId || l.code || i}` === t.quoteItemId) || items.find((l) => l.label === t.label);
    const prevu = ligne ? heuresLigne(ligne) : Number(t.durationHours || t.estimatedHours || 0);
    if (!(prevu > 0) || fait < prevu * 1.2 || fait - prevu < 1) continue;
    if (!pire || fait / prevu > pire.fait / pire.prevu) pire = { label: t.label || ligne?.label || "Ouvrage", fait, prevu };
  }
  if (!pire) return null;
  return `${pire.label} : ${heures(pire.fait)} pour ${heures(pire.prevu)} prévues. Mettre à jour dans Mes prix ?`;
}
