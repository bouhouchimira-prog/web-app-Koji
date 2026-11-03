const assert = require("assert");
const { publicUser, ADMIN_SCOPE, scopedItems, findScopedIndex, makeToken, addHistory } = require("../../lib/db");

describe("lib/db helpers", () => {
  describe("publicUser", () => {
    it("retire les champs sensibles", () => {
      const u = { id: "1", email: "a@b.com", password: "secret", passwordHash: "h", passwordSalt: "s", activationToken: "t", resetPasswordToken: "r" };
      const safe = publicUser(u);
      assert.strictEqual(safe.id, "1");
      assert.strictEqual(safe.password, undefined);
      assert.strictEqual(safe.passwordHash, undefined);
      assert.strictEqual(safe.passwordSalt, undefined);
      assert.strictEqual(safe.activationToken, undefined);
      assert.strictEqual(safe.resetPasswordToken, undefined);
    });
    it("retourne null pour null", () => {
      assert.strictEqual(publicUser(null), null);
    });
  });

  describe("scopedItems", () => {
    const items = [{ id: "1", userId: "u1" }, { id: "2", userId: "u2" }];
    it("admin scope renvoie tout", () => {
      assert.deepStrictEqual(scopedItems(items, ADMIN_SCOPE), items);
    });
    it("user scope filtre", () => {
      assert.deepStrictEqual(scopedItems(items, "u1"), [items[0]]);
    });
    it("pas de session → rien", () => {
      assert.deepStrictEqual(scopedItems(items, ""), []);
      assert.deepStrictEqual(scopedItems(items, null), []);
    });
  });

  describe("findScopedIndex", () => {
    const items = [{ id: "1", userId: "u1" }, { id: "2", userId: "u2" }];
    it("admin scope trouve par id", () => {
      assert.strictEqual(findScopedIndex(items, "2", ADMIN_SCOPE), 1);
    });
    it("user scope trouve par id + userId", () => {
      assert.strictEqual(findScopedIndex(items, "1", "u1"), 0);
      assert.strictEqual(findScopedIndex(items, "1", "u2"), -1);
    });
    it("pas de session → -1", () => {
      assert.strictEqual(findScopedIndex(items, "1", ""), -1);
    });
  });

  describe("makeToken", () => {
    it("genere un token avec prefixe", () => {
      const t = makeToken("act");
      assert.ok(t.startsWith("act-"));
      assert.ok(t.length > 10);
    });
    it("utilise 'tok' par defaut", () => {
      assert.ok(makeToken().startsWith("tok-"));
    });
  });

  describe("addHistory", () => {
    it("ajoute une entree en tete", () => {
      const db = { history: [] };
      addHistory(db, { userId: "u1", type: "test", label: "label" });
      assert.strictEqual(db.history.length, 1);
      assert.strictEqual(db.history[0].userId, "u1");
      assert.strictEqual(db.history[0].type, "test");
    });
  });
});
