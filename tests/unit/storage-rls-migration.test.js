const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const MIGRATION = path.join(ROOT, "supabase/migrations/0015_storage_canonical.sql");

describe("migration Storage RLS P0-6", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");

  it("durcit les buckets privés par propriétaire", () => {
    for (const bucket of [
      "quote_attachments",
      "worker-uploads",
      "worker_docs",
      "chantier-attachments",
      "chantier_documents",
      "task_images",
      "intervention-signatures",
    ]) {
      const safe = bucket.replace(/-/g, "_");
      assert.ok(sql.includes(`CREATE POLICY "${safe}_select_own"`), bucket);
      assert.ok(sql.includes(`bucket_id = '${bucket}'`), bucket);
      assert.ok(sql.includes("owner = auth.uid() OR public.is_koji_admin()"), bucket);
    }
  });

  it("garde la lecture publique pour les buckets publics", () => {
    for (const bucket of [
      "business-logos",
      "signatures",
      "fourniture-images",
      "fournitures",
    ]) {
      const safe = bucket.replace(/-/g, "_");
      assert.ok(sql.includes(`CREATE POLICY "${safe}_select_public"`), bucket);
    }
  });

  it("documente la cartographie bucket → préfixe", () => {
    assert.ok(sql.includes("Cartographie vérifiée dans le code"));
    assert.ok(sql.includes("chantier-photos/"));
    assert.ok(sql.includes("compte/<userId>/cgv.pdf"));
  });

  it("nettoie les policies permissives héritées", () => {
    assert.ok(sql.includes('DROP POLICY IF EXISTS "Public Access" ON storage.objects;'));
    assert.ok(sql.includes('DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;'));
  });
});
