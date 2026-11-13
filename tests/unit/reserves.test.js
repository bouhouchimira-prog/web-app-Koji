const assert = require("assert");
const { statutReserve, compterReserves, prochainNumero, sousTitreReserve, pourLe, reservesNonLevees } = require("../../lib/reserves");

// Réserves de la maquette PRO-02.3.
const R = [
  { numero: "R1", titre: "Joint silicone du receveur irrégulier", lieu: "Douche", statut: "levee", leveeLe: "2026-12-02T14:10:00Z", pourLe: "2026-12-02", source: "pro", creeLe: "2026-12-01T09:24:00Z" },
  { numero: "R2", titre: "Carreau fêlé derrière le WC", lieu: "Mur WC", statut: "faite", pourLe: "2026-12-04", source: "pro", creeLe: "2026-12-01T09:24:00Z" },
  { numero: "R3", titre: "Spot de douche qui ne s'allume pas", lieu: "Plafond", statut: "a_faire", pourLe: "2026-12-05", source: "pro" },
  { numero: "R4", titre: "Porte du meuble vasque qui frotte", lieu: "Meuble vasque", statut: "proposee", source: "client", signaleePar: "Mme Lefèvre" }
];

describe("lib/reserves (PRO-02.3)", () => {
  it("donne le statut de la maquette", () => {
    assert.strictEqual(statutReserve(R[0]).label, "Levée le 2 déc. à 15:10");
    assert.strictEqual(statutReserve(R[1]).label, "Faite · photo à vérifier");
    assert.strictEqual(statutReserve(R[2], "2026-12-03").label, "À faire");
    assert.strictEqual(statutReserve(R[2], "2026-12-06").label, "En retard");
    assert.strictEqual(statutReserve(R[3]).label, "Proposée par la cliente");
  });

  it("compte les filtres et la pastille", () => {
    assert.deepStrictEqual(compterReserves(R), { toutes: 4, a_faire: 1, faite: 1, levee: 1, proposee: 1, badge: 3 });
    assert.strictEqual(prochainNumero(R), 5);
    assert.strictEqual(prochainNumero([]), 1);
    assert.strictEqual(reservesNonLevees(R).length, 3);
  });

  it("écrit la ligne de la réserve", () => {
    assert.strictEqual(sousTitreReserve(R[1]), "Mur WC · signalée par vous · 1er déc.");
    assert.strictEqual(sousTitreReserve(R[3]), "Meuble vasque · signalée par Mme Lefèvre");
    assert.strictEqual(pourLe(R[1]), "4 déc.");
    assert.strictEqual(pourLe(R[3]), "—");
  });
});
