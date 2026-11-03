const assert = require("assert");
const { isAdminEmail, nowIso } = require("../../lib/auth");

describe("lib/auth", () => {
  it("isAdminEmail reconnait les 2 admins", () => {
    assert.strictEqual(isAdminEmail("bouhouchimira@gmail.com"), true);
    assert.strictEqual(isAdminEmail("ablexpertrenov@gmail.com"), true);
  });
  it("isAdminEmail est case-insensitive et trim", () => {
    assert.strictEqual(isAdminEmail("  BouhouchiMira@Gmail.com "), true);
  });
  it("isAdminEmail rejette les non-admins", () => {
    assert.strictEqual(isAdminEmail("random@example.com"), false);
    assert.strictEqual(isAdminEmail(""), false);
    assert.strictEqual(isAdminEmail(null), false);
  });
  it("nowIso retourne une date ISO valide", () => {
    const d = nowIso();
    assert.ok(!isNaN(Date.parse(d)));
  });
});
