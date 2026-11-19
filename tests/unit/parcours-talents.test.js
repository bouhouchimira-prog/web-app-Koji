import assert from "node:assert/strict";
import { etatNoeud, etatTalents, jourCourt, lireTalents, placerPoint, premierDuMoisSuivant, reorganiser } from "../../lib/parcours-talents.js";

// Maquette PRO-26.1 : 14 points, Radar 9, Vitrine 4, 1 à placer.
describe("Talents (PRO-26.1)", () => {
  const nov = "2026-11-19T10:00:00Z";

  it("nœuds acquis, disponibles (atteignables avec les points libres), verrouillés", () => {
    const e = etatTalents({ radar: 9, vitrine: 4, derniereReorg: "2026-10-12" }, { points: 14, maintenant: nov });
    assert.equal(e.places, 13);
    assert.equal(e.libres, 1);
    assert.deepEqual(e.branches[0].noeuds.map((n) => n.etat), ["got", "got", "got", "avail"]);
    assert.deepEqual(e.branches[1].noeuds.map((n) => n.etat), ["got", "got", "lock", "lock"]);
    assert.equal(e.branches[0].suivant, "grand-rayon");
    assert.equal(e.reorg.possible, false);
    assert.equal(e.reorg.prochaineLe, "2026-12-01");
    assert.equal(e.plaque, true);
    assert.deepEqual(e.avantages.find((a) => a.id === "plaque"), { id: "plaque", label: "KojiPage", texte: "grade et preuves affichés", enService: true });
    assert.equal(e.avantages.find((a) => a.id === "oeil-de-lynx").texte, "Œil de lynx · pas encore en service");
    assert.equal(etatNoeud(0, 10, 14), "avail");
  });

  it("placer un point : tout de suite, jamais au-delà des points ni de 10 par branche", () => {
    const s = placerPoint({ radar: 9, vitrine: 4 }, "radar", { points: 14, maintenant: nov });
    assert.equal(s.radar, 10);
    assert.throws(() => placerPoint(s, "vitrine", { points: 14, maintenant: nov }), /Aucun point/);
    assert.throws(() => placerPoint({ radar: 10 }, "radar", { points: 14, maintenant: nov }), /complète/);
    assert.throws(() => placerPoint({}, "remises", { points: 3, maintenant: nov }), /inconnue/);
  });

  it("réorganiser : une fois par mois, effet le 1er du mois suivant", () => {
    const s = reorganiser({ radar: 9, vitrine: 4 }, { radar: 4, vitrine: 10 }, { points: 14, maintenant: nov });
    assert.deepEqual(s.aVenir, { radar: 4, vitrine: 10, effetLe: "2026-12-01", valideLe: nov });
    let t = lireTalents(s, { points: 14, maintenant: nov });
    assert.equal(t.radar, 9);
    assert.equal(t.reorgPossible, false);
    assert.equal(t.prochaineReorgLe, "2027-01-01");
    const e = etatTalents(s, { points: 14, maintenant: nov });
    assert.equal(e.libres, 0);
    assert.equal(e.reorg.possible, false);
    t = lireTalents(s, { points: 14, maintenant: "2026-12-01T08:00:00Z" });
    assert.equal(t.radar, 4);
    assert.equal(t.vitrine, 10);
    assert.equal(t.aVenir, null);
    assert.equal(lireTalents(s, { points: 14, maintenant: "2027-01-01T08:00:00Z" }).reorgPossible, true);
    assert.throws(() => reorganiser(s, { radar: 1 }, { points: 14, maintenant: nov }), /1er janv\./);
    assert.throws(() => reorganiser({}, { radar: 10, vitrine: 5 }, { points: 14, maintenant: nov }), /plus de points/);
  });

  it("point gagné pendant une réorganisation validée", () => {
    const s = reorganiser({ radar: 9, vitrine: 4 }, { radar: 4, vitrine: 9 }, { points: 13, maintenant: nov });
    const p = placerPoint(s, "vitrine", { points: 14, maintenant: nov });
    assert.equal(p.aVenir.vitrine, 10);
    assert.equal(p.vitrine, 5);
  });

  it("niveau qui baisse : les points en trop quittent la branche la plus chargée", () => {
    const t = lireTalents({ radar: 9, vitrine: 4 }, { points: 10, maintenant: nov });
    assert.deepEqual([t.radar, t.vitrine], [6, 4]);
  });

  it("dates", () => {
    assert.equal(premierDuMoisSuivant("2026-12-15"), "2027-01-01");
    assert.equal(jourCourt("2026-12-01"), "1er déc.");
    assert.equal(jourCourt("2027-01-15"), "15 janv.");
  });
});
