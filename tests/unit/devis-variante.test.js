const assert = require("assert");
const { computeQuoteTotals } = require("../../lib/quote-calculations");

// Variante (maquette PRO-03.1) : proposée au client, jamais dans le total.
describe("variante du devis (PRO-03.1)", () => {
  it("laisse la variante hors du total", () => {
    const quote = { vatRate: 10, items: [
      { id: "a", label: "Poser le receveur", totalHt: 690 },
      { id: "b", label: "Poser un receveur en résine", totalHt: 940, variante: true },
      { id: "c", label: "Créer le circuit", totalHt: 380 }
    ] };
    const t = computeQuoteTotals(quote);
    assert.strictEqual(t.totalHt, 1070);
    assert.strictEqual(t.totalTtc, 1177);
    assert.strictEqual(t.items.length, 3);
  });
});
