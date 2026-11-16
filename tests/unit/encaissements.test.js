const assert = require("assert");
const { ajouterPaiement, chiffresEncaissements, encaisse, etatPaiement, lireReleveCsv, rapprocher, resteDu } = require("../../lib/encaissements");

// Encaissements (maquette PRO-06.3), au 1er décembre... 2026-11-28.
const JOUR = "2026-11-28";
const facture = (o) => ({ status: "Emise", type: "Facture", reminders: [], ...o });
const LISTE = () => [
  facture({ id: "f125", invoiceNumber: "KJ-2026-125", client: "Mme Lefèvre", amountTtc: 2515, dueDate: "2026-12-20" }),
  facture({ id: "f115", invoiceNumber: "KJ-2026-115", client: "SCI Bureaux Auteuil", amountTtc: 4118, dueDate: "2026-11-20", reminders: [{ level: "aimable", at: "2026-11-24T08:00:00Z" }] }),
  facture({ id: "f118", invoiceNumber: "KJ-2026-118", client: "SCI Bureaux Auteuil", amountTtc: 1810.45, status: "Payee", payments: [{ id: "p1", amount: 1810.45, date: "2026-11-09", moyen: "virement" }] }),
  facture({ id: "f121", invoiceNumber: "KJ-2026-121", client: "Mme Lefèvre", amountTtc: 2743.63, status: "Emise" }),
  facture({ id: "f112", invoiceNumber: "KJ-2026-112", client: "Mme Lefèvre", amountTtc: 1739.56, status: "Payee", payments: [{ id: "p2", amount: 1739.56, date: "2026-11-02", moyen: "carte" }] }),
  { id: "av4", kind: "avoir", invoiceNumber: "AV-2026-004", refInvoiceId: "f121", amountTtc: -2743.63, status: "Emise" }
];
const creditsDe = (liste) => (f) => liste.filter((a) => a.kind === "avoir" && a.refInvoiceId === f.id).reduce((s, a) => s - a.amountTtc, 0);

describe("encaissements (PRO-06.3)", () => {
  it("les trois chiffres et la colonne Paiement de la maquette", () => {
    const liste = LISTE();
    const c = chiffresEncaissements(liste, { aujourdhui: JOUR, credits: creditsDe(liste) });
    assert.strictEqual(c.encaisseMois, 3550.01);
    assert.strictEqual(c.paiementsMois.length, 2);
    assert.strictEqual(c.aEncaisser, 6633);
    assert.deepStrictEqual([c.duesCount, c.retardCount, c.prochaine.invoiceNumber], [2, 1, "KJ-2026-125"]);
    const etat = (id) => { const f = liste.find((x) => x.id === id); return etatPaiement(f, { aujourdhui: JOUR, avoirs: liste.filter((a) => a.kind === "avoir" && a.refInvoiceId === id) }); };
    assert.deepStrictEqual(etat("f125"), { etat: "À encaisser", texte: "échéance 20 déc." });
    assert.deepStrictEqual(etat("f115"), { etat: "En retard", texte: "échue depuis 8 j · relance 1 envoyée" });
    assert.deepStrictEqual(etat("f118"), { etat: "Payée", texte: "virement reçu le 9 nov." });
    assert.deepStrictEqual(etat("f121"), { etat: "Annulée", texte: "annulée par avoir AV-2026-004" });
    assert.deepStrictEqual(etat("f112"), { etat: "Payée", texte: "carte · 2 nov." });
  });

  it("paiement total ou partiel, reste dû recalculé, jamais au-delà", () => {
    const f = facture({ id: "x", amountTtc: 2515 });
    assert.strictEqual(ajouterPaiement(f, { amount: 1000, date: "2026-11-20", moyen: "cheque" }).solde, false);
    assert.strictEqual(resteDu(f), 1515);
    assert.throws(() => ajouterPaiement(f, { amount: 2000 }), /dépasse le reste dû/);
    const { paiement, solde } = ajouterPaiement(f, { date: "2026-11-21", reference: "VIR LEFEVRE SIT1" });
    assert.deepStrictEqual([paiement.amount, paiement.moyen, solde, encaisse(f)], [1515, "virement", true, 2515]);
    // Facture payée avant PRO-06.3 : paiement implicite.
    assert.strictEqual(encaisse({ status: "Payee", amountTtc: 500, paidAt: "2026-10-01T10:00:00Z" }), 500);
  });

  it("relevé CSV : lecture, rapprochement par montant et référence, virement sans facture", () => {
    const csv = "Date;Libellé;Débit;Crédit\n20/11/2026;VIR LEFEVRE SIT1 KJ-2026-125;;2 515,00\n21/11/2026;PRLV EDF;84,20;\n22/11/2026;VIR SCI BUREAUX AUTEUIL;;4118,00\n23/11/2026;VIR ACOMPTE DUPRE;;1 200,00";
    const { lignes, total } = lireReleveCsv(csv);
    assert.strictEqual(total, 4);
    assert.deepStrictEqual(lignes.map((l) => [l.date, l.montant]), [["2026-11-20", 2515], ["2026-11-22", 4118], ["2026-11-23", 1200]]);
    const liste = LISTE();
    const r = rapprocher(lignes, liste, creditsDe(liste));
    assert.deepStrictEqual(r.map((l) => [l.invoiceNumber, l.certitude]), [["KJ-2026-125", "forte"], ["KJ-2026-115", "forte"], ["", ""]]);
    // Format avec un seul montant signé et séparateur virgule.
    assert.deepStrictEqual(lireReleveCsv("date,label,amount\n2026-11-20,\"Virement, Dupré\",1200.50\n2026-11-21,Carte,-30").lignes, [{ date: "2026-11-20", libelle: "Virement, Dupré", montant: 1200.5 }]);
  });
});
