-- ============================================
-- STORAGE RLS — buckets Koji
-- A executer dans le SQL Editor Supabase apres avoir verifie les buckets
-- existants (Storage → Buckets).
-- ============================================
-- Buckets attendus : logos, photos, documents, signatures.
-- Regle : chaque utilisateur lit/ecrit dans son propre dossier
-- (prefixe = user_id). L'admin lit tout.

-- Logos (publics en lecture, ecriture par le proprietaire)
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos owner write" ON storage.objects;
CREATE POLICY "logos owner write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "logos owner update" ON storage.objects;
CREATE POLICY "logos owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "logos owner delete" ON storage.objects;
CREATE POLICY "logos owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Photos (privees : lecture/ecriture par le proprietaire ou l'admin)
DROP POLICY IF EXISTS "photos owner all" ON storage.objects;
CREATE POLICY "photos owner all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'photos'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  )
  WITH CHECK (
    bucket_id = 'photos'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  );

-- Documents (privees : lecture/ecriture par le proprietaire ou l'admin)
DROP POLICY IF EXISTS "documents owner all" ON storage.objects;
CREATE POLICY "documents owner all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  );

-- VERIFIER :
-- SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'storage';
