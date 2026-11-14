const assert = require("assert");
const { reglesSignature, finRetractation, acompteAPartirDu, demarrageAvantFin, lundiApres, libelleLundi, texteRetractation, texteDemandeExpresse, texteAcompte, masquerEmail, formulaireRetractation } = require("../../lib/signature-lieu");

// Signature et rétractation (maquette PRO-03.7) : mêmes exemples que l'app
// (mobile/test/signature_lieu_test.dart).
describe("signature et rétractation (PRO-03.7)", () => {
  it("applique les règles du lieu de signature", () => {
    assert.deepStrictEqual(reglesSignature("en-ligne"), { retractation: true, paiementAvant7Jours: "possible", formulaire: true, demarrageAvantFin: "demande-expresse" });
    assert.deepStrictEqual(reglesSignature("domicile"), { retractation: true, paiementAvant7Jours: "interdit", formulaire: true, demarrageAvantFin: "demande-expresse" });
    assert.deepStrictEqual(reglesSignature("locaux"), { retractation: false, paiementAvant7Jours: "possible", formulaire: false, demarrageAvantFin: "libre" });
    assert.strictEqual(reglesSignature("domicile", "societe").retractation, false);
  });

  it("calcule les dates comme la maquette, avec report au jour ouvrable", () => {
    assert.strictEqual(finRetractation("2026-10-30", "domicile"), "2026-11-13");
    assert.strictEqual(finRetractation("2026-10-30", "locaux"), "");
    assert.strictEqual(finRetractation("2026-10-30", "domicile", "societe"), "");
    // 31 oct. + 14 = samedi 14 nov. → lundi 16 nov.
    assert.strictEqual(finRetractation("2026-10-31", "en-ligne"), "2026-11-16");
    // 28 oct. + 14 = mercredi 11 nov. (férié) → jeudi 12 nov.
    assert.strictEqual(finRetractation("2026-10-28", "en-ligne"), "2026-11-12");
    assert.strictEqual(acompteAPartirDu("2026-10-30", "domicile"), "2026-11-07");
    assert.strictEqual(acompteAPartirDu("2026-10-30", "en-ligne"), "");
    assert.strictEqual(demarrageAvantFin("2026-11-12", "2026-11-13"), true);
    assert.strictEqual(demarrageAvantFin("2026-11-16", "2026-11-13"), false);
    assert.strictEqual(lundiApres("2026-11-13"), "2026-11-16");
    assert.strictEqual(libelleLundi("2026-11-16"), "lundi 16 nov.");
  });

  it("écrit les textes lus par le client", () => {
    assert.strictEqual(texteRetractation("2026-11-13"), "Vous pouvez annuler sans motif jusqu'au 13 novembre inclus, avec le formulaire joint ou depuis votre espace Koji. Les sommes versées sont remboursées sous 14 jours.");
    assert.strictEqual(texteDemandeExpresse("2026-11-12"), "Je demande que les travaux commencent le 12 novembre, avant la fin du délai de rétractation. Si je me rétracte ensuite, je paierai les travaux déjà réalisés.");
    assert.strictEqual(texteAcompte(30, 1739.56, "2026-11-07"), "Acompte 30 % : 1 739,56 €, demandé à partir du 7 novembre");
    assert.strictEqual(masquerEmail("s.lefevre.k@exemple.fr"), "s••••.k@••••.fr");
    assert.strictEqual(formulaireRetractation({ entreprise: "ABL Expert Renov" })[2], "À l'attention de ABL Expert Renov :");
  });
});
