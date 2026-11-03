const assert = require("assert");
const { fixText, fixObjectText } = require("../../lib/text");

describe("lib/text", () => {
  it("fixText retourne une string pour une string", () => {
    const out = fixText("bonjour");
    assert.strictEqual(typeof out, "string");
    assert.ok(out.length > 0);
  });
  it("fixText laisse les non-strings inchangés", () => {
    assert.strictEqual(fixText(42), 42);
    assert.strictEqual(fixText(null), null);
  });
  it("fixObjectText traite les objets et tableaux", () => {
    const out = fixObjectText({ a: "x", b: ["y", 1] });
    assert.deepStrictEqual(Object.keys(out), ["a", "b"]);
    assert.strictEqual(out.b.length, 2);
  });
  it("fixObjectText laisse les primitives non-string", () => {
    assert.strictEqual(fixObjectText(5), 5);
    assert.strictEqual(fixObjectText(null), null);
  });
});
