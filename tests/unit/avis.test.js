const assert = require("assert");
const { statsAvis, auteurPublic, reponseProposee, realisationProposee, normaliserCriteres, noteValide, moyenneTexte, etoiles } = require("../../lib/avis");

// Avis et réalisation de la maquette PRO-02.6.
describe("lib/avis (PRO-02.6)", () => {
  it("calcule la note de la KojiPage", () => {
    const avis = [
      ...Array.from({ length: 21 }, () => ({ note: 5, verifie: true })),
      ...Array.from({ length: 5 }, () => ({ note: 4, verifie: true })),
      { note: 2, verifie: true },
      { note: 1, verifie: false }
    ];
    assert.deepStrictEqual(statsAvis(avis), { moyenne: 4.7, nombre: 27, recommandent: 96 });
    assert.strictEqual(moyenneTexte(4.8), "4,8");
    assert.deepStrictEqual(statsAvis([]), { moyenne: 0, nombre: 0, recommandent: 0 });
  });

  it("protège le nom du client", () => {
    assert.strictEqual(auteurPublic("Karine Lefèvre"), "Karine L.");
    assert.strictEqual(auteurPublic("Mme Lefèvre"), "Mme L.");
    assert.strictEqual(auteurPublic(""), "Client Koji");
  });

  it("propose une réponse selon la note", () => {
    assert.strictEqual(reponseProposee({ client: "Mme Lefèvre", note: 5 }), "Merci Mme Lefèvre pour votre confiance et votre accueil pendant les travaux. Ravis que le résultat vous plaise ; n'hésitez pas à nous écrire dans Koji Client si besoin.");
    assert.match(reponseProposee({ note: 2 }), /désolés/);
  });

  it("prépare la réalisation et valide les notes", () => {
    assert.deepStrictEqual(realisationProposee({ titre: "Salle de bain, Paris 10e", lots: ["Dépose et préparation", "Plomberie", "Carrelage et faïence"], jours: 18 }), { titre: "Salle de bain, Paris 10e", texte: "Dépose et préparation, plomberie, carrelage et faïence · 18 jours" });
    assert.deepStrictEqual(normaliserCriteres({ ponctualite: 5, proprete: 4, communication: 7, prix: "x" }), { ponctualite: 5, proprete: 4 });
    assert.strictEqual(noteValide(0), false);
    assert.strictEqual(etoiles(4), "★★★★☆");
  });
});
