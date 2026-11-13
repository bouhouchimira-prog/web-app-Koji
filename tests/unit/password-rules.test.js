const assert = require("assert");
const { verifierMotDePasse, erreurMotDePasse, masquerEmail } = require("../../lib/password-rules");

describe("lib/password-rules", () => {
  it("coche les trois règles au fur et à mesure", () => {
    assert.deepStrictEqual(verifierMotDePasse("", "bilal@exemple.fr"), { longueur: false, lettreChiffre: false, pasEmail: false, ok: false });
    assert.deepStrictEqual(verifierMotDePasse("chantier", "bilal@exemple.fr"), { longueur: true, lettreChiffre: false, pasEmail: true, ok: false });
    assert.strictEqual(verifierMotDePasse("chantier2026", "bilal@exemple.fr").ok, true);
    assert.strictEqual(verifierMotDePasse("Élise2026x", "").ok, true);
  });

  it("refuse l'e-mail et « koji », même en majuscules", () => {
    assert.strictEqual(verifierMotDePasse("monKOJI2026", "a@b.fr").pasEmail, false);
    assert.strictEqual(verifierMotDePasse("bilal2026!", "bilal@exemple.fr").pasEmail, false);
    assert.strictEqual(verifierMotDePasse("Bilal2026!", "BILAL@exemple.fr").pasEmail, false);
    // un e-mail très court (2 lettres) ne bloque pas tout mot qui le contient
    assert.strictEqual(verifierMotDePasse("bonjour2026", "bo@exemple.fr").pasEmail, true);
  });

  it("donne le premier message utile", () => {
    assert.strictEqual(erreurMotDePasse("court1", ""), "Le mot de passe doit contenir au moins 8 caractères.");
    assert.strictEqual(erreurMotDePasse("sanschiffre", ""), "Le mot de passe doit contenir au moins une lettre et un chiffre.");
    assert.strictEqual(erreurMotDePasse("koji12345", ""), "Le mot de passe ne doit contenir ni votre e-mail ni « koji ».");
    assert.strictEqual(erreurMotDePasse("chantier2026", "bilal@exemple.fr"), "");
  });

  it("masque l'e-mail de confirmation", () => {
    assert.strictEqual(masquerEmail("bilal@exemple.fr"), "bil•••@exemple.fr");
    assert.strictEqual(masquerEmail("al@exemple.fr"), "al•••@exemple.fr");
    assert.strictEqual(masquerEmail("pas-un-email"), "");
  });
});
