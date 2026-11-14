const assert = require("assert");
const { avancementLot, calculerSituation, echeance, messageSituation } = require("../../lib/situation-travaux");

// Situation de travaux (maquette PRO-06).
describe("situation de travaux (PRO-06)", () => {
  it("calcule la situation de la maquette", () => {
    const s = calculerSituation({
      lots: [
        { nom: "Dépose et préparation", ht: 983.2, pct: 100 },
        { nom: "Plomberie", ht: 1650, pct: 100 },
        { nom: "Carrelage et faïence", ht: 2258.2, pct: 60 },
        { nom: "Électricité", ht: 380, pct: 0 }
      ],
      dejaFactureHt: 1581.42,
      tauxRetenue: 5,
      tauxTva: 10
    });
    assert.deepStrictEqual(s.lignes.map((l) => l.montant), [983.2, 1650, 1354.92, 0]);
    assert.deepStrictEqual([s.cumuleHt, s.retenueHt, s.ht, s.tva, s.ttc], [3988.12, 120.34, 2286.36, 228.64, 2515]);
  });

  it("préremplit l'avancement, l'échéance et le message", () => {
    const taches = [{ room: "Plomberie", done: true }, { room: "Plomberie", done: true }, { room: "Carrelage et faïence", done: true }, { room: "Carrelage et faïence", done: false }, { room: "Carrelage et faïence", done: false }];
    assert.strictEqual(avancementLot("Plomberie", taches), 100);
    assert.strictEqual(avancementLot("Carrelage et faïence", taches), 35);
    assert.strictEqual(avancementLot("Électricité", taches), 0);
    assert.strictEqual(echeance("2026-11-28"), "2026-12-28");
    assert.strictEqual(messageSituation({ client: "Mme Lefèvre", numero: 1, finPrevue: "2026-12-05", lignes: [{ nom: "Dépose", pct: 100 }, { nom: "Plomberie", pct: 100 }, { nom: "Carrelage", pct: 60 }, { nom: "Électricité", pct: 0 }] }),
      "Bonjour Mme Lefèvre, voici la situation n° 1 : dépose et plomberie terminés, carrelage à 60 %. Les photos sont dans votre espace Koji. Fin prévue le 5 décembre.");
  });
});
