const assert = require("assert");
const { COOKIES, readSessionCookie } = require("../../lib/session-cookies");

describe("lib/session-cookies", () => {
  it("COOKIES expose les 4 sessions", () => {
    assert.ok(COOKIES.access);
    assert.ok(COOKIES.refresh);
    assert.ok(COOKIES.portal);
    assert.ok(COOKIES.worker);
  });
  it("les cookies sont httpOnly", () => {
    assert.strictEqual(COOKIES.access.options.httpOnly, true);
    assert.strictEqual(COOKIES.portal.options.httpOnly, true);
  });
  it("readSessionCookie lit le cookie", () => {
    const req = { cookies: { get: (name) => (name === "koji_session" ? { value: "tok123" } : undefined) } };
    assert.strictEqual(readSessionCookie(req, "access"), "tok123");
  });
  it("readSessionCookie retourne '' si absent", () => {
    const req = { cookies: { get: () => undefined } };
    assert.strictEqual(readSessionCookie(req, "access"), "");
  });
});
