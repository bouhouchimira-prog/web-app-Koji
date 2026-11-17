const assert = require("assert");

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-signature-session-secret";
const {
  issueSignatureToken,
  verifySignatureToken,
  signatureAccessExpired
} = require("../../lib/signature-session");

describe("lib/signature-session", () => {
  it("accepte une session valide liée au bon devis", () => {
    const token = issueSignatureToken("sig-devis-1", 60_000);
    assert.strictEqual(verifySignatureToken(token, "sig-devis-1"), "sig-devis-1");
  });

  it("refuse une session utilisée pour un autre devis", () => {
    const token = issueSignatureToken("sig-devis-1", 60_000);
    assert.strictEqual(verifySignatureToken(token, "sig-devis-2"), "");
  });

  it("refuse un token falsifié", () => {
    const token = issueSignatureToken("sig-devis-1", 60_000);
    assert.strictEqual(verifySignatureToken(`${token.slice(0, -2)}aa`, "sig-devis-1"), "");
  });

  it("refuse une session expirée", async () => {
    const token = issueSignatureToken("sig-devis-1", 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(verifySignatureToken(token, "sig-devis-1"), "");
  });

  it("contrôle l'expiration et la révocation du lien métier", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.strictEqual(signatureAccessExpired({ signatureClientAccess: { expiresAt: past } }), true);
    assert.strictEqual(signatureAccessExpired({ signatureClientAccess: { expiresAt: future } }), false);
    assert.strictEqual(signatureAccessExpired({ signatureClientAccess: { status: "revoked" } }), true);
    assert.strictEqual(signatureAccessExpired({}), false);
  });
});
