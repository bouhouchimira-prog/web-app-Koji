const assert = require("assert");
const { normalizeSupabaseUser, denormalizeToSupabase } = require("../../lib/user-store");

describe("lib/user-store normalize/denormalize", () => {
  it("accountType vaut entreprise si account_type === entreprise", () => {
    const u = normalizeSupabaseUser({ id: "1", is_pro: false, account_type: "entreprise" });
    assert.strictEqual(u.accountType, "entreprise");
  });

  it("accountType vaut entreprise si is_pro === true meme si account_type est particullier", () => {
    const u = normalizeSupabaseUser({ id: "1", is_pro: true, account_type: "particulier" });
    assert.strictEqual(u.accountType, "entreprise");
  });

  it("accountType vaut particulier sinon (regression du bug ||)", () => {
    const u = normalizeSupabaseUser({ id: "1", is_pro: false, account_type: "particulier" });
    assert.strictEqual(u.accountType, "particulier");
  });

  it("accountType vaut particulier si account_type est truthy mais pas entreprise", () => {
    // ancien bug : row.account_type || ... renvoyait "entreprise" pour toute valeur truthy
    const u = normalizeSupabaseUser({ id: "1", is_pro: false, account_type: "particulier" });
    assert.strictEqual(u.accountType, "particulier");
  });

  it("accountType vaut particulier si account_type null et is_pro false", () => {
    const u = normalizeSupabaseUser({ id: "1", is_pro: false, account_type: null });
    assert.strictEqual(u.accountType, "particulier");
  });

  it("denormalize ecrit account_type", () => {
    const row = denormalizeToSupabase({ id: "1", accountType: "entreprise", isPro: true });
    assert.strictEqual(row.account_type, "entreprise");
    const row2 = denormalizeToSupabase({ id: "2", accountType: "particulier", isPro: false });
    assert.strictEqual(row2.account_type, "particulier");
  });
});
