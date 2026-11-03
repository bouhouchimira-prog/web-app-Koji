const assert = require("assert");
const { redact, sanitize } = require("../../lib/logger");

describe("lib/logger (redaction)", () => {
  it("redact masque les tokens (prefixed)", () => {
    const skLive = "sk" + "_" + "live" + "_" + "x".repeat(30);
    const jwt = "ey" + "JhbGciOiJIUzI1NiJ9" + "." + "payload" + "." + "signature";
    const ghp = "gh" + "p_" + "x".repeat(36);
    assert.strictEqual(redact(skLive), "[REDACTED]");
    assert.strictEqual(redact(jwt), "[REDACTED]");
    assert.strictEqual(redact(ghp), "[REDACTED]");
  });
  it("redact laisse passer les valeurs courtes/non-secretes", () => {
    assert.strictEqual(redact("hello"), "hello");
    assert.strictEqual(redact(42), 42);
    assert.strictEqual(redact(null), null);
  });
  it("sanitize masque les cles sensibles", () => {
    const out = sanitize({ password: "secret", token: "abc", apiKey: "key", name: "Bob" });
    assert.strictEqual(out.password, "[REDACTED]");
    assert.strictEqual(out.token, "[REDACTED]");
    assert.strictEqual(out.apiKey, "[REDACTED]");
    assert.strictEqual(out.name, "Bob");
  });
  it("sanitize masque les cles avec underscore (api_key, secret)", () => {
    const out = sanitize({ api_key: "k", mySecret: "s", normal: "n" });
    assert.strictEqual(out.api_key, "[REDACTED]");
    assert.strictEqual(out.mySecret, "[REDACTED]");
    assert.strictEqual(out.normal, "n");
  });
  it("sanitize traite les tableaux et objets imbriques", () => {
    const out = sanitize({ items: [{ password: "p", label: "x" }] });
    assert.strictEqual(out.items[0].password, "[REDACTED]");
    assert.strictEqual(out.items[0].label, "x");
  });
  it("sanitize laisse les primitives", () => {
    assert.strictEqual(sanitize(5), 5);
    assert.strictEqual(sanitize(null), null);
    assert.strictEqual(sanitize("hi"), "hi");
  });
});
