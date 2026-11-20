const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const MIGRATION = path.join(ROOT, "supabase/migrations/0013_rls_canonical.sql");

describe("migration RLS canonique", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");

  it("protège les champs sensibles des utilisateurs", () => {
    assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.protect_sensitive_user_fields()"));
    assert.ok(sql.includes("CREATE TRIGGER protect_sensitive_user_fields"));
    assert.ok(sql.includes("NEW.is_admin := OLD.is_admin;"));
    assert.ok(sql.includes("NEW.account_type := OLD.account_type;"));
    assert.ok(sql.includes("NEW.portal_identifier := OLD.portal_identifier;"));
  });

  it("scope les devis par utilisateur ou administrateur", () => {
    assert.ok(sql.includes('CREATE POLICY "quotes_select_own_or_admin"'));
    assert.ok(sql.includes('CREATE POLICY "quotes_update_own_or_admin"'));
    assert.ok(sql.includes("WITH CHECK (user_id = auth.uid() OR public.is_koji_admin())"));
  });

  it("scope fournisseurs et fournitures par propriétaire", () => {
    assert.ok(sql.includes('CREATE POLICY "fournisseurs_select_own"'));
    assert.ok(sql.includes('CREATE POLICY "fournitures_select_own"'));
    assert.ok(sql.includes("user_id = auth.uid() OR user_id IS NULL OR public.is_koji_admin()"));
  });

  it("scope le stockage des produits par propriétaire", () => {
    assert.ok(sql.includes('CREATE POLICY "products_delete_own"'));
    assert.ok(sql.includes("bucket_id = 'products'"));
    assert.ok(sql.includes("owner = auth.uid() OR public.is_koji_admin()"));
  });

  it("documente les scripts SQL historiques dangereux", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "docs/RLS_CANONICAL.md")));
  });
});
