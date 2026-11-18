const assert = require("assert");
const { ensureClientPortalAccess } = require("../../lib/client-portal-access");

const NOW = "2026-11-17T12:00:00.000Z";
const REQUEST = { url: "https://getkoji.example/api/signature" };

function fixture(existing) {
  return {
    users: existing ? [existing] : [],
    mailOutbox: [],
    smsOutbox: []
  };
}

function quote() {
  return {
    id: "quote-1",
    projectId: "project-1",
    quoteNumber: "2026_0001",
    client: "Client test",
    clientEmail: "",
    clientPhone: "0601020304"
  };
}

function existingAccount(extra = {}) {
  return {
    id: "client-existing",
    accountType: "particulier",
    email: "existant@example.fr",
    name: "Nom existant",
    passwordHash: "hash-original",
    passwordSalt: "salt-original",
    isActive: false,
    personal: { phone: "0601020304" },
    clientAccess: { quoteIds: [], projectIds: [] },
    ...extra
  };
}

describe("lib/client-portal-access — rattachement à un compte existant", () => {
  it("ne réinitialise jamais le mot de passe et ne réactive pas le compte", async () => {
    const db = fixture(existingAccount());
    const access = await ensureClientPortalAccess(
      db,
      quote(),
      { signerPhone: "0601020304", signerName: "Nom choisi par un attaquant" },
      REQUEST,
      NOW
    );

    const user = db.users[0];
    assert.strictEqual(user.passwordHash, "hash-original");
    assert.strictEqual(user.passwordSalt, "salt-original");
    assert.strictEqual(user.isActive, false);
    assert.strictEqual(user.name, "Nom existant");
    assert.strictEqual(access.password, "");
    assert.strictEqual(access.existingAccount, true);
    assert.deepStrictEqual(user.clientAccess.quoteIds, ["quote-1"]);
    assert.deepStrictEqual(user.clientAccess.projectIds, ["project-1"]);
    assert.strictEqual(db.smsOutbox[0].text.includes("Mot de passe provisoire"), false);
    assert.ok(db.smsOutbox[0].text.includes("mot de passe habituel"));
  });

  it("conserve un ancien mot de passe en clair tant qu'il n'a pas été migré au login", async () => {
    const db = fixture(existingAccount({ password: "legacy-password", passwordHash: undefined, passwordSalt: undefined }));
    await ensureClientPortalAccess(db, quote(), { signerPhone: "0601020304" }, REQUEST, NOW);
    assert.strictEqual(db.users[0].password, "legacy-password");
  });

  it("crée des identifiants uniquement pour un nouveau compte", async () => {
    const db = fixture(null);
    const access = await ensureClientPortalAccess(db, quote(), { signerPhone: "0601020304" }, REQUEST, NOW);

    assert.strictEqual(db.users.length, 1);
    assert.strictEqual(access.existingAccount, false);
    assert.ok(access.password.startsWith("Koji-"));
    assert.ok(db.users[0].passwordHash);
    assert.notStrictEqual(db.users[0].passwordHash, access.password);
    assert.ok(db.smsOutbox[0].text.includes(`Mot de passe provisoire : ${access.password}`));
  });
});
