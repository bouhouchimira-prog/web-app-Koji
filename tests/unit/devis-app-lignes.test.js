import assert from "node:assert/strict";
import { lignesDepuisPieces } from "../../lib/devis-app-lignes.js";

describe("devis de l'app : lignes pour le PDF (PRO-25)", () => {
  const pieces = [
    {
      name: "Salle de bain", room_order: 1, quote_tasks: [
        { task_id: "t1", label: "Faïence murale", unit_price_ht: 60, total_price_ht: 35, inputs: { quantity: 14, unite: "m²" } },
        { task_id: "t2", label: "Peinture plafond", unit_price_ht: 200, total_price_ht: 11.4, inputs: { quantity: 1, hideFournitures: true } },
        { task_id: "comment_1", label: "Note interne", inputs: {} },
        { task_id: "fourniture_9", label: "Receveur 90 × 120", unit_price_ht: 0, total_price_ht: 369, inputs: { quantity: 1 } },
        { task_id: "t3", label: "Sèche-serviettes", unit_price_ht: 120, total_price_ht: 0, inputs: { quantity: 1, lineType: "variante" } }
      ]
    },
    { name: "Cuisine", room_order: 0, quote_tasks: [{ task_id: "t4", label: "Dépose", unit_price_ht: 300, total_price_ht: 0, inputs: {} }] }
  ];
  const items = lignesDepuisPieces(pieces);

  it("garde l'ordre des pièces", () => {
    assert.equal(items[0].room, "Cuisine");
    assert.equal(items[0].totalHt, 300);
  });

  it("sépare main-d'œuvre et fournitures", () => {
    const mo = items.find((i) => i.label === "Faïence murale");
    const fo = items.find((i) => i.label === "Faïence murale · fournitures");
    assert.equal(mo.totalHt, 840);
    assert.equal(mo.unit, "m²");
    assert.equal(fo.totalHt, 490);
  });

  it("fond les fournitures masquées dans la main-d'œuvre", () => {
    const l = items.filter((i) => i.label.startsWith("Peinture plafond"));
    assert.equal(l.length, 1);
    assert.equal(l[0].totalHt, 211.4);
  });

  it("n'imprime jamais un commentaire", () => {
    assert.ok(!items.some((i) => i.label === "Note interne"));
  });

  it("garde une fourniture seule et marque la variante hors total", () => {
    assert.equal(items.find((i) => i.label === "Receveur 90 × 120").totalHt, 369);
    assert.equal(items.find((i) => i.label === "Sèche-serviettes").variante, true);
  });
});
