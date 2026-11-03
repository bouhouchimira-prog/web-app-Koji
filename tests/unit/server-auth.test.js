const assert = require("assert");
const { getAccessToken, isUuid } = require("../../lib/server-auth");

function makeReq({ cookie, header, body, url } = {}) {
  return {
    cookies: { get: (name) => (name === "koji_session" && cookie ? { value: cookie } : undefined) },
    headers: { get: (h) => (h.toLowerCase() === "authorization" ? (header || null) : null) },
    url: url || "http://localhost:3000/api/x"
  };
}

describe("lib/server-auth", () => {
  describe("isUuid", () => {
    it("accepte un UUID valide", () => {
      assert.strictEqual(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
    });
    it("rejette les non-UUID", () => {
      assert.strictEqual(isUuid("not-a-uuid"), false);
      assert.strictEqual(isUuid(""), false);
      assert.strictEqual(isUuid(null), false);
    });
  });

  describe("getAccessToken", () => {
    it("priorite au cookie", () => {
      const req = makeReq({ cookie: "cookie-token", header: "Bearer header-token", body: { accessToken: "body-token" } });
      assert.strictEqual(getAccessToken(req, req.body), "cookie-token");
    });
    it("fallback sur le header Bearer", () => {
      const req = makeReq({ header: "Bearer header-token" });
      assert.strictEqual(getAccessToken(req), "header-token");
    });
    it("fallback sur body.accessToken", () => {
      const req = makeReq({ body: { accessToken: "body-token" } });
      assert.strictEqual(getAccessToken(req, { accessToken: "body-token" }), "body-token");
    });
    it("fallback sur query param", () => {
      const req = makeReq({ url: "http://localhost:3000/api/x?accessToken=query-token" });
      assert.strictEqual(getAccessToken(req), "query-token");
    });
    it("retourne '' si aucun token", () => {
      const req = makeReq({});
      assert.strictEqual(getAccessToken(req), "");
    });
  });
});
