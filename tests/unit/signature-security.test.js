const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("sécurité du parcours de signature", () => {
  it("lecture, signature et rétractation exigent la session HttpOnly et l'expiration", () => {
    const signature = read("app/api/signatures/[token]/route.js");
    const retractation = read("app/api/signatures/[token]/retractation/route.js");
    for (const source of [signature, retractation]) {
      assert.ok(source.includes("getVerifiedSignatureToken"));
      assert.ok(source.includes("signatureAccessExpired"));
    }
    assert.ok((signature.match(/authorizeSignatureRequest\(request, token\)/g) || []).length >= 3);
  });

  it("la réponse publique ne renvoie plus le devis complet ni le mot de passe du portail", () => {
    const source = read("app/api/signatures/[token]/route.js");
    assert.ok(source.includes("publicQuoteView"));
    assert.ok(source.includes("publicClientAccess"));
    assert.strictEqual(source.includes("quote: fixObjectText(mapQuote(updatedRow))"), false);
    const dto = source.slice(source.indexOf("function publicClientAccess"), source.indexOf("function authorizeSignatureRequest"));
    assert.strictEqual(dto.includes("access.password"), false);
  });

  it("les RPC contrôlent l'e-mail et interdisent d'écraser une signature", () => {
    const sql = read("supabase/migrations/0012_securiser_signature_rpc.sql");
    assert.strictEqual((sql.match(/signed_at IS NULL/g) || []).length, 2);
    assert.ok((sql.match(/LOWER\(TRIM\(COALESCE\(p_email/g) || []).length >= 2);
    assert.ok(sql.includes("REVOKE ALL ON FUNCTION submit_quote_signature"));
  });

  it("le mobile transmet l'e-mail réel du client à la RPC", () => {
    const repository = read("mobile/lib/features/quote/repositories/chantier_client_repository.dart");
    const screen = read("mobile/lib/features/quote/chantier_client_screen.dart");
    assert.ok(repository.includes("'p_email': clientEmail"));
    assert.ok(screen.includes("clientEmail: widget.clientEmail"));
  });
});
