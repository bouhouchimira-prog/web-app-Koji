import assert from "node:assert/strict";
import { majorationsDeLApp, mapQuote } from "../../lib/quote-mapping.js";
import { computeSurchargeBreakdown } from "../../lib/quote-calculations.js";
import { libelleConfiance, tauxHoraireProfil, tauxParDefaut } from "../../lib/bibliotheque-pro.js";

// Retours du build 64, sprint 3 : cohérence des devis entre l'app et le site.
describe("Devis de l'app : frais, taux et libellés", () => {
  // Le testeur : une ligne de plafond à 195 €, un total à 239,85 € HT, et des
  // frais visibles seulement sur le PDF. Le site, lui, ne les lisait pas.
  it("reconnaît les frais enregistrés par l'app, au centime près", () => {
    const frais = majorationsDeLApp({ coordPct: 10, aleasPct: 5, decennalePct: 8, tvaRate: 10 });
    assert.deepEqual(frais.map((f) => [f.label, f.percent, f.mode, f.calculationBase]), [
      ["Coordination de chantier", 10, "client", "total_lots"],
      ["Provision aléas de chantier", 5, "client", "total_lots"],
      ["Assurance décennale", 8, "client", "total_lots"]
    ]);
    const calcul = computeSurchargeBreakdown(195, frais);
    assert.deepEqual(calcul.lines.map((l) => l.amount), [19.5, 9.75, 15.6]);
    assert.equal(calcul.totalHt, 239.85, "le total du site est celui affiché par l'app");
  });

  it("laisse de côté un frais retiré par l'artisan, et un devis sans frais", () => {
    assert.deepEqual(majorationsDeLApp({ coordPct: 0, aleasPct: 5, decennalePct: 0 }).map((f) => f.id), ["sc-alea"]);
    assert.deepEqual(majorationsDeLApp({}), []);
    assert.deepEqual(majorationsDeLApp(null), []);
  });

  it("un devis du site garde ses propres majorations", () => {
    const duSite = mapQuote({ id: "q1", web_extras: { surcharges: [{ id: "x", label: "Déplacement", kind: "fixe", montant: 40, mode: "client" }] }, metadata: { recap: { coordPct: 10 } } });
    assert.deepEqual(duSite.surcharges.map((s) => s.id), ["x"]);
    const deLApp = mapQuote({ id: "q2", metadata: { recap: { coordPct: 10, aleasPct: 5, decennalePct: 8 } }, total_ht: 239.85 });
    assert.deepEqual(deLApp.surcharges.map((s) => s.id), ["sc-coord", "sc-alea", "sc-assur"]);
    assert.equal(deLApp.totalHt, 239.85);
  });

  // « Peindre un plafond en 2 couches » : 13,00 € dans la bibliothèque
  // (0,26 h × 50 €), 19,50 € dans le devis (0,26 h × 75 €, le taux du profil).
  it("la bibliothèque applique le taux du profil avant la référence de la famille", () => {
    assert.equal(tauxHoraireProfil({ dailyRate: 750, hoursPerDay: 10 }), 75);
    assert.equal(tauxHoraireProfil({ dailyRate: 750 }), 0);
    assert.equal(tauxHoraireProfil({}), 0);
    assert.equal(tauxParDefaut({ tauxProfil: 75, defautFamille: 50 }), 75);
    assert.equal(tauxParDefaut({ tauxProfil: 0, defautFamille: 50 }), 50);
    assert.equal(tauxParDefaut(), 0);
  });

  it("dit en clair ce que vaut le temps d'un ouvrage", () => {
    assert.equal(libelleConfiance("A"), "temps chronométré");
    assert.equal(libelleConfiance("B"), "temps recalé");
    assert.equal(libelleConfiance("C"), "temps estimé");
    assert.equal(libelleConfiance(undefined), "temps estimé");
  });
});
