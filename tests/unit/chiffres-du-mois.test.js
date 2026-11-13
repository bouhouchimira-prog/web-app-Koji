const assert = require("assert");
const { chiffresDuMois, periodesDisponibles, montantHt, margeMoyenne } = require("../../lib/chiffres-du-mois");

const AUJOURDHUI = new Date(2026, 10, 9, 12); // 9 novembre 2026, heure locale
const [OCTOBRE, NOVEMBRE, ANNEE] = periodesDisponibles(AUJOURDHUI);

const quotes = [
  { id: "q1", projectId: "p1", status: "Signe", totalHt: 1000, totalTtc: 1100 }, // TVA 10 %
  { id: "q2", projectId: "p2", status: "Envoye", totalHt: 500, totalTtc: 600 }
];

function facture(extra) {
  return { id: extra.id, amountTtc: 0, status: "Emise", kind: undefined, ...extra };
}

describe("lib/chiffres-du-mois", () => {
  it("propose mois précédent, mois en cours et année", () => {
    assert.deepStrictEqual([OCTOBRE.label, NOVEMBRE.label, ANNEE.label], ["Octobre", "Novembre", "Année"]);
    assert.strictEqual(NOVEMBRE.titre, "Novembre 2026");
    assert.strictEqual(ANNEE.titre, "Année 2026");
    const janvier = periodesDisponibles(new Date(2027, 0, 15));
    assert.strictEqual(janvier[0].titre, "Décembre 2026");
  });

  it("déduit le HT du devis rattaché, sinon TVA 20 % signalée", () => {
    const parId = new Map(quotes.map((q) => [q.id, q]));
    assert.deepStrictEqual(montantHt({ amountTtc: 550, quoteId: "q1" }, parId), { ht: 500, estime: false });
    const libre = montantHt({ amountTtc: 120 }, parId);
    assert.strictEqual(Math.round(libre.ht), 100);
    assert.strictEqual(libre.estime, true);
  });

  it("facturé HT : émises du mois, avoirs déduits, brouillons et annulées ignorés", () => {
    const invoices = [
      facture({ id: "f1", amountTtc: 1100, quoteId: "q1", issuedAt: new Date(2026, 10, 3).toISOString() }),
      facture({ id: "f2", amountTtc: 600, quoteId: "q2", status: "Payee", issuedAt: new Date(2026, 10, 4).toISOString(), paidAt: new Date(2026, 10, 6).toISOString() }),
      facture({ id: "av1", kind: "avoir", amountTtc: -110, quoteId: "q1", refInvoiceId: "f1", issuedAt: new Date(2026, 10, 5).toISOString() }),
      facture({ id: "f3", amountTtc: 999, status: "Brouillon", issuedAt: "" }),
      facture({ id: "f4", amountTtc: 999, status: "Annulee", issuedAt: new Date(2026, 10, 2).toISOString() }),
      facture({ id: "f5", amountTtc: 240, issuedAt: new Date(2026, 9, 20).toISOString() })
    ];
    const r = chiffresDuMois({ invoices, quotes, periode: NOVEMBRE, aujourdhui: AUJOURDHUI });
    assert.strictEqual(Math.round(r.facture.total), 1000 + 500 - 100);
    assert.strictEqual(r.facture.factures, 2);
    assert.strictEqual(r.facture.avoirs, 1);
    assert.strictEqual(r.facture.htEstimes, 0);

    const oct = chiffresDuMois({ invoices, quotes, periode: OCTOBRE, aujourdhui: AUJOURDHUI });
    assert.strictEqual(Math.round(oct.facture.total), 200);
    assert.strictEqual(oct.facture.htEstimes, 1);

    assert.strictEqual(Math.round(r.depuisJanvier), 1600);
  });

  it("encaissé TTC : factures payées dans la période, à la date de paiement", () => {
    const invoices = [
      facture({ id: "f1", amountTtc: 600, status: "Payee", issuedAt: new Date(2026, 9, 28).toISOString(), paidAt: new Date(2026, 10, 2).toISOString() }),
      facture({ id: "f2", amountTtc: 300, status: "Payee", issuedAt: new Date(2026, 9, 1).toISOString(), paidAt: new Date(2026, 9, 5).toISOString() })
    ];
    const r = chiffresDuMois({ invoices, quotes, periode: NOVEMBRE, aujourdhui: AUJOURDHUI });
    assert.deepStrictEqual(r.encaisse, { total: 600, paiements: 1 });
    const an = chiffresDuMois({ invoices, quotes, periode: ANNEE, aujourdhui: AUJOURDHUI });
    assert.deepStrictEqual(an.encaisse, { total: 900, paiements: 2 });
  });

  it("reste à encaisser : émises non payées, avoirs déduits, retard le plus long", () => {
    const invoices = [
      facture({ id: "f1", amountTtc: 1100, dueDate: "2026-11-01", issuedAt: "2026-10-01T10:00:00Z" }),
      facture({ id: "av1", kind: "avoir", amountTtc: -100, refInvoiceId: "f1", issuedAt: "2026-10-05T10:00:00Z" }),
      facture({ id: "f2", amountTtc: 500, dueDate: "2026-12-01", issuedAt: "2026-11-01T10:00:00Z" }),
      facture({ id: "f3", amountTtc: 200, dueDate: "2026-10-20", issuedAt: "2026-09-20T10:00:00Z", archived: true }),
      facture({ id: "f4", amountTtc: 300, status: "Payee", dueDate: "2026-10-01" })
    ];
    const r = chiffresDuMois({ invoices, quotes, periode: OCTOBRE, aujourdhui: AUJOURDHUI });
    assert.deepStrictEqual(r.reste, { total: 1500, impayees: 2, echues: 1, retardMax: 8 });
  });

  it("marge moyenne : pondérée, chantiers sans dépense ignorés", () => {
    const projects = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const expenses = [
      { projectId: "p1", amount: 600 },
      { projectId: "p2", amount: 100 },
      { projectId: "p2", amount: 100 }
    ];
    const marge = margeMoyenne({ projects, quotes, expenses });
    assert.strictEqual(marge.chantiers, 2);
    assert.strictEqual(Math.round(marge.taux * 100), Math.round(((1500 - 800) / 1500) * 100));
    assert.strictEqual(margeMoyenne({ projects, quotes, expenses: [] }), null);
  });
});
