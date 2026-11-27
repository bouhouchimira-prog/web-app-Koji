import assert from "node:assert/strict";
import { buildQuotePdf } from "../../lib/document-generator/index.js";

// KPRO-49 : dans le PDF du devis, le bloc des signatures ne part jamais seul
// sur une page. Il reste avec les conditions qui le précèdent.
function pages(pdf) {
  const texte = Buffer.from(pdf).toString("latin1");
  return texte.split(/\nendstream/).filter((s) => s.includes(" Tj ET"));
}

function devis(n) {
  return {
    id: "q-test",
    quoteNumber: "2026_1",
    client: "Mme Test",
    clientType: "particulier",
    project: "Salle de bain",
    createdAt: "2026-11-27T10:00:00Z",
    items: Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      label: `Ouvrage numéro ${i + 1}, pose et fournitures comprises`,
      quantity: 1,
      unit: "u",
      unitPrice: 100
    }))
  };
}

export function pagesDesSignatures(n) {
  const liste = pages(buildQuotePdf({ quote: devis(n), project: null, db: { users: [], projects: [] } }));
  const page = liste.find((p) => p.includes("BON POUR ACCORD"));
  return { total: liste.length, avecConditions: Boolean(page && page.includes("(Conditions)")) };
}

describe("PDF du devis : signatures jamais seules (KPRO-49)", () => {
  it("de 1 à 60 lignes, la page des signatures porte aussi les conditions", () => {
    const seules = [];
    for (let n = 1; n <= 60; n++) if (!pagesDesSignatures(n).avecConditions) seules.push(n);
    assert.deepEqual(seules, [], `signatures seules pour ${seules.join(", ")} lignes`);
  });
});
