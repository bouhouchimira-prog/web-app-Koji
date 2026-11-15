import assert from "node:assert/strict";
import { bornesPeriode, coutChantier, csv, doublonDe, estSure, historiqueChantier, journalVentes, libellePeriode, moisPrecedent, normaliserPiece, numerotation, proposerChantier, syntheseExport } from "../../lib/depenses.js";

// Maquettes PRO-09 à 09.4.
const cedeo = { id: "p1", statut: "a_ranger", fournisseur: "Cedeo · Paris 19", date: "2026-10-28", ht: 386.2, tva: 77.24, ttc: 463.44, categorie: "Fournitures", lignes: [{ designation: "Mitigeur thermostatique douche" }, { designation: "Siphon de sol extra-plat" }, { designation: "Raccords PER 16 (lot)" }] };
const chantiers = [
  { projectId: "sdb", title: "Salle de bain, Paris 10e", besoins: [{ name: "Mitigeur thermostatique de douche", lots: ["Plomberie"] }, { name: "Siphon de sol extra-plat inox", lots: ["Plomberie"] }, { name: "Raccords PER 16", lots: ["Plomberie"] }], bons: [] },
  { projectId: "cau", title: "Appartement Caulaincourt", besoins: [{ name: "Grès cérame 60 × 60", lots: ["Carrelage"] }], bons: ["BC-2026-0417"] }
];

describe("Dépenses : ranger les pièces (PRO-09)", () => {
  it("propose le chantier dont le devis prévoit les articles", () => {
    const p = proposerChantier(cedeo, chantiers);
    assert.equal(p.projectId, "sdb");
    assert.equal(p.lot, "Plomberie");
    assert.equal(p.sur, true);
    assert.equal(p.raison, "3 articles sur 3 prévus au devis (Plomberie)");
    assert.deepEqual(p.autres.map((a) => a.raison), ["aucun article correspondant"]);
  });
  it("commande Koji et carburant : rangement sûr", () => {
    assert.equal(proposerChantier({ categorie: "Fournitures", bonCommande: "BC-2026-0417", lignes: [{ designation: "grès 60 × 60" }] }, chantiers).projectId, "cau");
    const essence = proposerChantier({ categorie: "Carburant", lignes: [] }, chantiers);
    assert.equal(essence.fraisGeneraux, true);
    assert.equal(essence.raison, "carburant, aucun chantier");
    assert.equal(proposerChantier({ categorie: "Fournitures", lignes: [{ designation: "Peinture acrylique" }] }, chantiers), null);
  });
  it("signale le doublon Point P (même montant, 3 jours d'écart)", () => {
    const a = { id: "a", fournisseur: "Point P", date: "2026-10-29", ttc: 1284.6 };
    const b = { id: "b", fournisseur: "POINT P · Paris 19", date: "2026-10-26", ttc: 1284.6 };
    assert.equal(doublonDe(b, [a, b])?.id, "a");
    assert.equal(doublonDe({ ...b, date: "2026-09-01" }, [a]), null);
    assert.equal(estSure({ statut: "a_ranger", proposition: { sur: true } }), true);
    assert.equal(estSure({ statut: "a_ranger", proposition: { sur: true }, doublonDe: "a" }), false);
  });
  it("une dépense saisie avant PRO-09 est une pièce rangée", () => {
    const p = normaliserPiece({ id: "exp-1", label: "Décennale", amount: 120, category: "Autres frais", createdAt: "2026-10-02T10:00:00Z" });
    assert.equal(p.statut, "rangee");
    assert.equal(p.ht, 120);
    assert.equal(p.date, "2026-10-02");
    assert.equal(p.categorie, "Fournitures");
  });
});

describe("Coût d'un chantier (PRO-09.1, 09.2)", () => {
  const quote = { totalHt: 10000, items: [
    { room: "Carrelage", label: "Poser la faïence", quantity: 1, normativeTime: 20, materialLines: [{ name: "Faïence 30 × 60", unitsToBuy: 100, purchasePriceInput: 31 }] },
    { room: "Plomberie", label: "Poser le receveur", quantity: 1, normativeTime: 30, materialLines: [{ name: "Receveur", unitsToBuy: 1, purchasePriceInput: 2000 }] }
  ] };
  const pieces = [
    { statut: "rangee", lot: "Carrelage", ht: 5400 },
    { statut: "rangee", lot: "Plomberie", ht: 500 },
    { statut: "a_ranger", lot: "Plomberie", ht: 999 }
  ];
  const taches = [{ label: "Poser la faïence", room: "Carrelage", done: true }];
  const pointages = [{ workerId: "rui", durationMinutes: 600 }];
  const workers = [{ id: "rui", hourlyRate: 40 }];

  it("prévu, dépensé, marges (lot fait au réel, lot en cours au moins le prévu)", () => {
    const c = coutChantier({ quote, pieces, taches, pointages, workers, coutHoraire: 40 });
    assert.deepEqual(c.lots.map((l) => [l.lot, l.prevu, l.depense, l.etat]), [["Carrelage", 3100, 5400, "fait"], ["Plomberie", 2000, 500, "en_cours"]]);
    assert.equal(c.avancement, 50);
    assert.deepEqual(c.mo, { suivi: true, heures: 10, depense: 400, heuresPrevues: 50, prevu: 2000 });
    assert.equal(c.depense, 6300);
    assert.deepEqual(c.margePrevue, { euros: 2900, pct: 29 });
    assert.deepEqual(c.margeFinale, { euros: 600, pct: 6, delta: -2300 });
    assert.equal(c.etat, "regarder");
    assert.equal(c.phrase, "Carrelage : fournitures au-dessus du prévu");
  });
  it("sans coût horaire : pas de marge plutôt qu'une marge fausse", () => {
    const c = coutChantier({ quote, pieces, taches, pointages: [], workers, coutHoraire: 0 });
    assert.equal(c.margePrevue, null);
    assert.equal(c.etat, "sans_cout");
  });
  it("heures non pointées : main-d'œuvre comptée comme prévu", () => {
    const c = coutChantier({ quote, pieces: [], taches: [], coutHoraire: 40 });
    assert.equal(c.margeFinale.pct, 29);
    assert.equal(c.etat, "tot");
  });
  it("historique : pièces, pointages, encaissements", () => {
    const h = historiqueChantier({ pieces: [{ id: "x", statut: "rangee", type: "facture", fournisseur: "Leroy Pro", date: "2026-10-28", ht: 480.4, categorie: "Fournitures", lot: "Carrelage" }], pointages: [{ id: "t", workerName: "Rui C.", date: "2026-10-30", durationMinutes: 465, workerId: "rui" }], workers, invoices: [{ id: "f", invoiceNumber: "FAC-2026-0115", notes: "Acompte sur devis", payments: [{ id: "1", amount: 1810.45, date: "2026-10-20" }] }] });
    assert.deepEqual(h.map((x) => [x.type, x.titre, x.montant]), [["heures", "Pointage Rui C. · 7 h 45", 310], ["fournitures", "Facture Leroy Pro", 480.4], ["encaissements", "Acompte reçu", -1810.45]]);
  });
});

describe("Export pour le comptable (PRO-09.4)", () => {
  it("périodes", () => {
    assert.deepEqual(bornesPeriode("2026-10"), { debut: "2026-10-01", fin: "2026-10-31" });
    assert.deepEqual(bornesPeriode("2026-T4"), { debut: "2026-10-01", fin: "2026-12-31" });
    assert.equal(libellePeriode("2026-10"), "Octobre 2026");
    assert.equal(libellePeriode("2026-T1"), "1er trimestre 2026");
    assert.equal(moisPrecedent("2026-11-05"), "2026-10");
    assert.equal(moisPrecedent("2027-01-05"), "2026-12");
  });
  it("ventes au taux de la facture, avoirs négatifs, numérotation", () => {
    const b = bornesPeriode("2026-10");
    const v = journalVentes([
      { invoiceNumber: "FAC-2026-0115", status: "Payee", issuedAt: "2026-10-03T09:00:00Z", amountTtc: 1100, tauxTva: 10 },
      { invoiceNumber: "AV-2026-001", kind: "avoir", status: "Emise", issuedAt: "2026-10-04T09:00:00Z", amountTtc: -110, tauxTva: 10, refInvoiceNumber: "FAC-2026-0115" },
      { invoiceNumber: "FAC-2026-0119", status: "Brouillon", issuedAt: "", amountTtc: 500 }
    ], new Map(), b);
    assert.deepEqual(v.map((x) => [x.numero, x.ht, x.tva, x.avoir]), [["FAC-2026-0115", 1000, 100, false], ["AV-2026-001", -100, -10, true]]);
    assert.deepEqual(numerotation(["0115", "0116", "0117", "0119", "0120", "0121"].map((x) => ({ invoiceNumber: `FAC-2026-${x}`, status: "Emise" })), 2026), { premier: "FAC-2026-0115", dernier: "FAC-2026-0121", trous: 1 });
  });
  it("synthèse : TVA indicative et contrôles avant envoi", () => {
    const s = syntheseExport({
      periode: "2026-10",
      invoices: [{ invoiceNumber: "FAC-2026-0001", status: "Emise", issuedAt: "2026-10-03", amountTtc: 1200, tauxTva: 20, payments: [{ amount: 600, date: "2026-10-10", moyen: "virement" }] }],
      pieces: [
        { id: "a", statut: "rangee", type: "facture", fournisseur: "Cedeo", date: "2026-10-28", ht: 386.2, tva: 77.24, ttc: 463.44, projectId: "sdb", fichier: { path: "x" } },
        { id: "b", statut: "rangee", type: "facture", fournisseur: "Rénov Horizon", date: "2026-10-22", ht: 3920, tva: 0, ttc: 3920, autoliquidation: true, projectId: "cau" },
        { id: "c", statut: "a_ranger", fournisseur: "Total", date: "2026-10-27", ht: 60, tva: 12, ttc: 72 }
      ],
      titres: new Map([["sdb", "Salle de bain"], ["cau", "Caulaincourt"]])
    });
    assert.deepEqual(s.tva, { collectee: 200, deductible: 77.24, solde: 122.76 });
    assert.equal(s.totaux.achats.autoliquidees, 1);
    assert.equal(s.totaux.encaissements.ttc, 600);
    assert.deepEqual(s.controles.map((c) => c.ok), [true, false, false, true]);
    assert.equal(s.controles[1].texte, "1 pièce encore à ranger");
    assert.equal(s.controles[2].texte, "1 pièce sans justificatif dans Koji");
  });
  it("CSV lisible par Excel (point-virgule, virgule décimale)", () => {
    const t = csv([{ cle: "a", titre: "Fournisseur" }, { cle: "b", titre: "HT" }], [{ a: "Point P; Paris", b: 1070.5 }]);
    assert.equal(t, '﻿Fournisseur;HT\r\n"Point P; Paris";1070,5\r\n');
  });
});
