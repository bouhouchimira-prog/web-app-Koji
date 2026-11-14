const assert = require("assert");
const { montantAcompte, tvaIncluse, dateEcheance, messageAcompte, erreurAcompte } = require("../../lib/facture-acompte");

// Facture d'acompte (maquette PRO-03.4) : mêmes exemples que l'app
// (mobile/test/facture_acompte_test.dart).
describe("facture d'acompte (PRO-03.4)", () => {
  it("calcule le montant et la TVA comprise comme la maquette", () => {
    assert.strictEqual(montantAcompte(5798.54, 30), 1739.56);
    assert.strictEqual(tvaIncluse(1739.56, 10), 158.14);
    assert.strictEqual(montantAcompte(5798.54, 50), 2899.27);
    assert.strictEqual(tvaIncluse(1200, 20), 200);
    assert.strictEqual(tvaIncluse(1055, 5.5), 55);
  });

  it("fixe l'échéance et propose le message", () => {
    assert.strictEqual(dateEcheance("2026-10-30", 0), "2026-10-30");
    assert.strictEqual(dateEcheance("2026-10-30", 8), "2026-11-07");
    assert.strictEqual(
      messageAcompte({ client: "Mme Lefèvre", pourcentage: 30, debut: "2026-11-12" }),
      "Bonjour Mme Lefèvre, merci pour votre signature. Voici la facture d'acompte de 30 % prévue au devis. Son règlement confirme le démarrage le 12 novembre."
    );
    assert.strictEqual(messageAcompte({ pourcentage: 25 }), "Bonjour, merci pour votre signature. Voici la facture d'acompte de 25 % prévue au devis. Son règlement confirme le démarrage du chantier.");
  });

  it("refuse un pourcentage ou un montant impossible", () => {
    assert.strictEqual(erreurAcompte({ pourcentage: 30, montant: 1739.56, restant: 5798.54 }), "");
    assert.strictEqual(erreurAcompte({ pourcentage: 0, montant: 0 }), "Choisis un pourcentage entre 1 et 100.");
    assert.strictEqual(erreurAcompte({ pourcentage: 30, montant: 1739.56, restant: 1000 }), "Le montant dépasse ce qui reste à facturer sur ce devis.");
    assert.strictEqual(erreurAcompte({ pourcentage: 30, montant: 1, envoyer: true, email: true, adresse: "" }), "Ajoute l'e-mail du client pour lui envoyer la facture.");
  });
});
