const assert = require("assert");
const { getAccessToken, isUuid, verifyAccessToken } = require("../../lib/server-auth");

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

  describe("verifyAccessToken", () => {
    it("rejette un JWT forgé refusé par Supabase Auth", async () => {
      const user = await verifyAccessToken("faux.admin.signature", async () => ({
        data: { user: null },
        error: { message: "invalid JWT" }
      }));
      assert.strictEqual(user, null);
    });

    it("utilise l'identité certifiée, jamais le sub décodé localement", async () => {
      const forgedSub = "11111111-1111-1111-1111-111111111111";
      const certifiedId = "22222222-2222-2222-2222-222222222222";
      const user = await verifyAccessToken("faux.admin.signature", async () => ({
        data: { user: { id: certifiedId } },
        error: null
      }));
      assert.strictEqual(user.id, certifiedId);
      assert.notStrictEqual(user.id, forgedSub);
    });

    it("rejette une réponse sans utilisateur ni identifiant", async () => {
      assert.strictEqual(await verifyAccessToken("token", async () => ({ data: { user: {} }, error: null })), null);
      assert.strictEqual(await verifyAccessToken("token", async () => ({ data: {}, error: null })), null);
    });

    it("rejette une erreur réseau ou une exception du vérificateur", async () => {
      const user = await verifyAccessToken("token", async () => {
        throw new Error("Supabase indisponible");
      });
      assert.strictEqual(user, null);
    });

    it("ne vérifie pas un jeton vide", async () => {
      let called = false;
      const user = await verifyAccessToken("", async () => {
        called = true;
        return { data: { user: { id: "u1" } }, error: null };
      });
      assert.strictEqual(user, null);
      assert.strictEqual(called, false);
    });
  });
});
