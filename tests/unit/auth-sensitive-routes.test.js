const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");

const SENSITIVE_ROUTES = [
  "app/api/quotes/route.js",
  "app/api/project-messages/route.js",
  "app/api/supplies/route.js",
  "app/api/supplies/import/route.js",
  "app/api/devis-ia/lots/route.js",
  "app/api/estimer-devis/route.js",
  "app/api/billing/checkout/route.js",
  "app/api/billing/connect/route.js",
  "app/api/billing/portal/route.js"
];

describe("authentification des routes sensibles", () => {
  for (const route of SENSITIVE_ROUTES) {
    it(`${route} exige un jeton vérifié par Supabase Auth`, () => {
      const source = fs.readFileSync(path.join(ROOT, route), "utf8");
      assert.strictEqual(
        /\bgetAuth\s*\(/.test(source),
        false,
        `${route} utilise encore le JWT simplement décodé`
      );
      assert.ok(
        /await getVerifiedAuth\(/.test(source),
        `${route} n'appelle pas getVerifiedAuth`
      );
    });
  }

  it("le bypass admin des devis est alimenté par l'identité vérifiée", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/quotes/route.js"), "utf8");
    assert.ok(/await getVerifiedAuth\(request\)/.test(source));
    assert.ok(/isVerifiedUserAdmin\(auth\.userId\)/.test(source));
  });
});
