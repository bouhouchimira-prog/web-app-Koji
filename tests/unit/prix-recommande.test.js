const assert = require("assert");
const {
  indexBibliotheque, prixRecommande, prixUnitaireOuvrage, tauxHoraireEntreprise, tvaParDefaut
} = require("../../lib/prix-recommande");

const bibliotheque = [
  { code: "PLO-WC-02", normativeTime: 2, coefficient: 1, hourlyRate: 0, suppliesCost: 100 }, // 2 h × taux + 100
  { code: "CAR-SOL-01", normativeTime: 1, coefficient: 1.5, hourlyRate: 40 },                // 60 / m²
  { code: "FORF-01", billingMode: "fixed", fixedAmountHt: 300 },
  { code: "PEI-MUR-01", normativeTime: 0.5, hourlyRate: 50 },
  { code: "PERSO-3", userId: "u1", copiedFromCode: "PEI-MUR-01", normativeTime: 0.5, hourlyRate: 60 }
];

describe("lib/prix-recommande", () => {
  it("taux horaire = taux journalier / heures, 0 sans taux (rien d'inventé)", () => {
    assert.strictEqual(tauxHoraireEntreprise({ dailyRate: 350, hoursPerDay: 7 }), 50);
    assert.strictEqual(tauxHoraireEntreprise({}), 0);
    assert.strictEqual(tvaParDefaut({ defaultVatRate: 10 }), 10);
    assert.strictEqual(tvaParDefaut({}), 20);
  });

  it("prix unitaire : temps × coefficient × taux + fournitures, forfait tel quel", () => {
    assert.strictEqual(prixUnitaireOuvrage(bibliotheque[0], 50), 200);
    assert.strictEqual(prixUnitaireOuvrage(bibliotheque[1], 50), 60);
    assert.strictEqual(prixUnitaireOuvrage(bibliotheque[2], 0), 300);
    // ouvrage au temps sans aucun taux : pas de prix
    assert.strictEqual(prixUnitaireOuvrage(bibliotheque[0], 0), 0);
  });

  it("additionne les postes trouvés, TTC arrondi à la centaine", () => {
    const parCode = indexBibliotheque(bibliotheque);
    const items = [
      { catalogCode: "plo-wc-02", quantity: 1 },   // 200
      { catalogCode: "CAR-SOL-01", quantity: 10 }, // 600
      { catalogCode: "FORF-01", quantity: 1 }      // 300
    ];
    const prix = prixRecommande(items, parCode, { tauxHoraire: 50, tva: 10 });
    assert.strictEqual(prix.ht, 1100);
    assert.strictEqual(prix.ttc, 1200); // 1 210 → 1 200
    assert.deepStrictEqual([prix.chiffres, prix.manquants, prix.postes], [3, 0, 3]);
  });

  it("un poste hors bibliothèque ou sans taux reste sans prix", () => {
    const parCode = indexBibliotheque(bibliotheque);
    const items = [
      { catalogCode: "CAR-SOL-01", quantity: 10 },
      { catalogCode: "", label: "Poste libre", quantity: 1 },
      { catalogCode: "INCONNU", quantity: 2 },
      { catalogCode: "PLO-WC-02", quantity: 1 } // pas de taux entreprise
    ];
    const prix = prixRecommande(items, parCode, { tauxHoraire: 0, tva: 20 });
    assert.strictEqual(prix.ht, 600);
    assert.deepStrictEqual([prix.chiffres, prix.manquants], [1, 3]);
    assert.strictEqual(prix.tauxManquant, true);
  });

  it("rien de chiffrable : pas de prix du tout", () => {
    const prix = prixRecommande([{ catalogCode: "INCONNU", quantity: 1 }], indexBibliotheque(bibliotheque), { tauxHoraire: 50 });
    assert.strictEqual(prix.ttc, null);
    assert.strictEqual(prix.manquants, 1);
  });

  it("la copie perso d'un ouvrage Koji donne le prix de l'entreprise", () => {
    const prix = prixRecommande([{ catalogCode: "PEI-MUR-01", quantity: 100 }], indexBibliotheque(bibliotheque), { tauxHoraire: 0, tva: 0 });
    assert.strictEqual(prix.ht, 3000); // 0,5 h × 60 € × 100, pas 50 €
  });

  it("phrase sous le prix : taux manquant, partiel, complet", () => {
    const { notePrix, prixPartiel } = require("../../lib/radar-display");
    assert.match(notePrix({ ttc: null, postes: 3, manquants: 3, tauxManquant: true }), /taux de main-d'œuvre/);
    assert.match(notePrix({ ttc: null, postes: 3, manquants: 3, tauxManquant: false }), /n'invente pas/);
    assert.strictEqual(notePrix({ ttc: 1600, postes: 25, manquants: 1, tauxManquant: false }), "1 poste sur 25 sans prix dans votre bibliothèque : il n'est pas compté.");
    assert.strictEqual(prixPartiel({ ttc: 1600, manquants: 20 }), true);
    assert.strictEqual(prixPartiel({ ttc: 1600, manquants: 0 }), false);
    assert.strictEqual(notePrix(null), "");
  });
});
