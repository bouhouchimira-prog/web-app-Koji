const assert = require("assert");
const { computeQuoteTotals, computeSurchargeBreakdown } = require("../../lib/quote-calculations");

describe("lib/quote-calculations", () => {
  it("computeQuoteTotals sur un devis vide renvoie des zeros", () => {
    const t = computeQuoteTotals({});
    assert.strictEqual(t.totalHt, 0);
    assert.strictEqual(t.totalTtc, 0);
    assert.strictEqual(t.totalVat, 0);
  });

  it("computeQuoteTotals additionne les lignes", () => {
    const quote = {
      items: [
        { label: "Peinture", quantity: 10, unitPriceHt: 5, normativeTime: 0.5, hourlyRate: 40 },
      ],
      vatRate: 0.2
    };
    const t = computeQuoteTotals(quote);
    assert.ok(t.totalHt > 0);
    assert.ok(t.totalTtc > t.totalHt);
  });

  it("computeSurchargeBreakdown calcule les majorations", () => {
    const r = computeSurchargeBreakdown(100, [{ percent: 10, mode: "client", calculationBase: "total_lots" }]);
    assert.strictEqual(r.total, 10);
    assert.strictEqual(r.totalHt, 110);
  });

  it("computeSurchargeBreakdown ignore les lignes non facturables", () => {
    const r = computeSurchargeBreakdown(100, [{ percent: 10, mode: "internal_note", calculationBase: "total_lots" }]);
    assert.strictEqual(r.total, 0);
    assert.strictEqual(r.totalHt, 100);
  });

  it("computeSurchargeBreakdown gère les surcharges cumulatives", () => {
    const surcharges = [
      { percent: 10, mode: "client", calculationBase: "total_lots" },
      { percent: 5, mode: "client", calculationBase: "chiffrage_cumule" }
    ];
    const r = computeSurchargeBreakdown(100, surcharges);
    // 10% de 100 = 10 ; puis 5% de 110 = 5.5 → total 15.5
    assert.ok(Math.abs(r.total - 15.5) < 0.01);
  });
});
