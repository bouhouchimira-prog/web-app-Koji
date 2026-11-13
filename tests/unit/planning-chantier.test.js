const assert = require("assert");
const {
  joursFeries, estOuvre, finApres, joursOuvresEntre, lotsDuDevis, proposerPlanning, demarragePropose, heuresLigne
} = require("../../lib/planning-chantier");

// Devis de la maquette PRO-02.1 (salle de bain, 4 lots).
const DEVIS = {
  items: [
    { room: "Dépose et préparation", code: "DEP-1", label: "Déposer la baignoire", totalHt: 180, correctedTimeHours: 4 },
    { room: "Dépose et préparation", code: "DEP-2", label: "Déposer le carrelage", totalHt: 543.2, normativeTime: 0.4, quantity: 19.4 },
    { room: "Dépose et préparation", code: "EVA-1", label: "Évacuer les gravats", totalHt: 260, correctedTimeHours: 2 },
    { room: "Plomberie", code: "PLO-1", label: "Créer l'alimentation", totalHt: 420, correctedTimeHours: 7 },
    { room: "Plomberie", code: "PLO-2", label: "Poser le receveur", totalHt: 690, correctedTimeHours: 6 },
    { room: "Plomberie", code: "PLO-3", label: "Poser la colonne", totalHt: 540, correctedTimeHours: 5 },
    { room: "Carrelage et faïence", code: "CAR-1", label: "Poser le carrelage", totalHt: 551, correctedTimeHours: 12 },
    { room: "Carrelage et faïence", code: "CAR-2", label: "Poser la faïence", totalHt: 1707.2, correctedTimeHours: 30 },
    { room: "Électricité", code: "ELEC-1", label: "Créer le circuit", totalHt: 380, correctedTimeHours: 6 }
  ]
};

describe("lib/planning-chantier (PRO-02.1)", () => {
  it("connaît les jours fériés, Pâques compris", () => {
    const f2026 = joursFeries(2026);
    assert.ok(f2026.has("2026-04-06")); // lundi de Pâques
    assert.ok(f2026.has("2026-05-14")); // Ascension
    assert.ok(f2026.has("2026-05-25")); // lundi de Pentecôte
    assert.ok(f2026.has("2026-11-11"));
    assert.strictEqual(estOuvre("2026-11-11"), false);
    assert.strictEqual(estOuvre("2026-11-14"), false); // samedi
    assert.strictEqual(estOuvre("2026-11-12"), true);
  });

  it("compte en jours ouvrés", () => {
    assert.strictEqual(finApres("2026-11-12", 2), "2026-11-13");
    assert.strictEqual(finApres("2026-11-13", 2), "2026-11-16"); // le week-end saute
    assert.strictEqual(finApres("2026-11-10", 2), "2026-11-12"); // le 11 novembre saute
    assert.strictEqual(joursOuvresEntre("2026-11-12", "2026-11-27"), 12);
    assert.strictEqual(demarragePropose("2026-11-06"), "2026-11-12"); // 3 jours ouvrés après le vendredi 6
  });

  it("regroupe les lignes par lot, dans l'ordre du devis", () => {
    const lots = lotsDuDevis(DEVIS);
    assert.deepStrictEqual(lots.map((l) => l.nom), ["Dépose et préparation", "Plomberie", "Carrelage et faïence", "Électricité"]);
    assert.strictEqual(lots[0].montantHt, 983.2);
    assert.strictEqual(lots[0].heures, 13.76); // 4 + 0,4 × 19,4 + 2
    assert.strictEqual(heuresLigne({ subItems: [{ correctedTimeHours: 2 }, { normativeTime: 1, quantity: 3 }] }), 5);
  });

  it("propose le planning de la maquette : 12 jours ouvrés, du 12 au 27 novembre", () => {
    const p = proposerPlanning(DEVIS, { debut: "2026-11-12", heuresParJour: 7 });
    assert.deepStrictEqual(
      p.lots.map((l) => [l.numero, l.debut, l.fin, l.jours]),
      [
        ["01", "2026-11-12", "2026-11-13", 2],
        ["02", "2026-11-16", "2026-11-18", 3],
        ["03", "2026-11-19", "2026-11-26", 6],
        ["04", "2026-11-27", "2026-11-27", 1]
      ]
    );
    assert.strictEqual(p.fin, "2026-11-27");
    assert.strictEqual(p.joursOuvres, 12);
    // une durée modifiée décale les lots suivants
    const p2 = proposerPlanning(DEVIS, { debut: "2026-11-12", durees: { Plomberie: 1 } });
    assert.strictEqual(p2.lots[2].debut, "2026-11-17");
  });
});
