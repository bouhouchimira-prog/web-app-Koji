const assert = require("assert");
const {
  supportInboxFor,
  SUPPORT_INBOX_PARTICULIER,
  SUPPORT_INBOX_ENTREPRISE
} = require("../../lib/mailer.js");

// Service client (12 nov) : Koji (particuliers) → contact@, Koji Pro
// (entreprises et leurs ouvriers) → entreprise@.
describe("lib/mailer — boîte du service client", () => {
  it("les deux adresses", () => {
    assert.strictEqual(SUPPORT_INBOX_PARTICULIER, "contact@getkoji.io");
    assert.strictEqual(SUPPORT_INBOX_ENTREPRISE, "entreprise@getkoji.io");
  });

  it("un particulier écrit à contact@", () => {
    assert.strictEqual(supportInboxFor({ accountType: "particulier" }), "contact@getkoji.io");
    assert.strictEqual(supportInboxFor({ sessionKind: "particulier" }), "contact@getkoji.io");
  });

  it("une entreprise ou un ouvrier écrit à entreprise@", () => {
    assert.strictEqual(supportInboxFor({ accountType: "entreprise" }), "entreprise@getkoji.io");
    assert.strictEqual(supportInboxFor({ accountType: "ouvrier" }), "entreprise@getkoji.io");
    assert.strictEqual(supportInboxFor({ sessionKind: "worker" }), "entreprise@getkoji.io");
    assert.strictEqual(supportInboxFor({ accountType: "Entreprise" }), "entreprise@getkoji.io");
  });

  it("le type de compte déclaré l'emporte sur le type de session", () => {
    assert.strictEqual(supportInboxFor({ accountType: "particulier", sessionKind: "entreprise" }), "contact@getkoji.io");
  });

  it("type inconnu ou absent → contact@ (adresse générale)", () => {
    assert.strictEqual(supportInboxFor({}), "contact@getkoji.io");
    assert.strictEqual(supportInboxFor(), "contact@getkoji.io");
    assert.strictEqual(supportInboxFor({ accountType: "autre" }), "contact@getkoji.io");
  });
});
