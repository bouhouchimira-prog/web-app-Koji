const assert = require("assert");
const { tachesParLot, ligneTache, etatTache, filtrerTaches, compterTaches, comprendreDictee, semaine } = require("../../lib/taches-chantier");

// Tâches du chantier de la maquette PRO-02.7 (fin octobre 2025).
const AUJ = "2025-10-30";
const DEVIS = { items: ["Dépose", "Électricité", "Carrelage", "Plomberie", "Menuiserie", "Peinture"].map((room) => ({ room })) };
const T = [
  { id: "1", room: "Carrelage", label: "Finir la faïence de la douche", assignedTo: "Rui C.", startDate: "2025-10-30", endDate: "2025-10-30" },
  { id: "2", room: "Carrelage", label: "Joints mur gauche", assignedTo: "Rui C.", startDate: "2025-10-30", done: true },
  { id: "3", room: "Carrelage", label: "Joint silicone receveur", assignedTo: "Rui C.", startDate: "2025-10-31" },
  { id: "4", room: "Plomberie", label: "Raccorder le mitigeur", assignedTo: "Mehdi B.", startDate: "2025-11-03" },
  { id: "5", room: "Plomberie", label: "Essai d'étanchéité", assignedTo: "Mehdi B.", startDate: "2025-11-03", bloquant: { raison: "receveur livré vendredi" } },
  { id: "6", room: "Peinture", label: "Plafond 2 couches", assignedTo: "À affecter", startDate: "2025-11-10" },
  { id: "7", room: "Peinture", label: "Porte et huisserie", assignedTo: "", startDate: "2025-11-12" }
];

describe("lib/taches-chantier (PRO-02.7)", () => {
  it("range les tâches par lot du devis", () => {
    const lots = tachesParLot(T, DEVIS);
    assert.deepStrictEqual(lots.map((l) => `${l.titre} ${l.faites} / ${l.taches.length}`), ["Lot 03 · Carrelage 1 / 3", "Lot 04 · Plomberie 0 / 2", "Lot 06 · Peinture 0 / 2"]);
  });

  it("écrit la ligne de la maquette", () => {
    assert.strictEqual(ligneTache(T[0], AUJ), "Rui C. · jeu. 30");
    assert.strictEqual(ligneTache(T[3], AUJ), "Mehdi B. · lun. 3 nov.");
    assert.strictEqual(ligneTache(T[4], AUJ), "Mehdi B. · lun. 3 nov. · bloquant : receveur livré vendredi");
    assert.strictEqual(ligneTache(T[5], AUJ), "à affecter · sem. 46");
    assert.strictEqual(ligneTache({ assignedTo: "Rui C.", startDate: "2025-10-27", endDate: "2025-10-29" }, AUJ), "Rui C. · lun. 27 → mer. 29");
    assert.strictEqual(semaine("2025-11-12"), 46);
    assert.strictEqual(ligneTache({ assignedTo: "Equipe", startDate: "2025-11-10" }, AUJ), "Équipe · lun. 10 nov.");
  });

  it("donne l'état, les filtres et les compteurs", () => {
    assert.strictEqual(etatTache(T[1], AUJ).label, "Fait");
    assert.strictEqual(etatTache(T[4], AUJ).label, "Bloquant");
    assert.strictEqual(etatTache({ startDate: "2025-10-20" }, AUJ).label, "En retard");
    assert.deepStrictEqual(filtrerTaches(T, "aujourdhui", AUJ).map((t) => t.id), ["1"]);
    assert.deepStrictEqual(filtrerTaches(T, "bloquees", AUJ).map((t) => t.id), ["5"]);
    assert.deepStrictEqual(compterTaches(T, AUJ), { toutes: 7, faites: 1, aujourdhui: 1, bloquees: 1 });
  });

  it("comprend une tâche dictée", () => {
    const ctx = { lots: ["Carrelage", "Plomberie", "Peinture"], compagnons: [{ id: "w1", name: "Rui C." }, { id: "w2", name: "Mehdi B." }], aujourdhui: "2025-10-29" };
    assert.deepStrictEqual(comprendreDictee("Poser les plinthes carrelées vendredi avec Rui", ctx), { label: "Poser les plinthes carrelées", lot: "Carrelage", compagnonId: "w1", compagnonNom: "Rui C.", jour: "2025-10-31" });
    const b = comprendreDictee("Mehdi purge les radiateurs demain", ctx);
    assert.deepStrictEqual([b.label, b.compagnonId, b.jour], ["Purge les radiateurs", "w2", "2025-10-30"]);
    assert.strictEqual(comprendreDictee("Retouches peinture le 4", ctx).jour, "2025-11-04");
    assert.strictEqual(comprendreDictee("Retouches peinture mercredi prochain", ctx).jour, "2025-11-05");
  });
});
