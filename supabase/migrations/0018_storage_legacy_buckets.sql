-- 0018 — Durcissement des buckets legacy Kôji (logos, photos, documents)
--
-- Ces buckets sont définis par admin/supabase_storage_rls.sql (app admin) mais
-- leurs policies historiques utilisent un scoping par préfixe de dossier
-- (storage.foldername) au lieu de la colonne `owner`, incohérent avec le
-- reste du lot P0-6. On applique le même patron canonique (owner = auth.uid()
-- OU admin Kôji) et on supprime les anciennes policies.
--
-- Les buckets `items`, `profiles`, `menu-images` appartiennent à une autre
-- application partageant le même projet Supabase : ils ne sont PAS touchés
-- ici (audit séparé à prévoir).
--
-- À exécuter dans Supabase → SQL Editor, après 0016. Aucune donnée n'est modifiée.

-- =============================================================
-- logos (public en lecture, écriture propriétaire/admin)
-- =============================================================
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
DROP POLICY IF EXISTS "logos owner write" ON storage.objects;
DROP POLICY IF EXISTS "logos owner update" ON storage.objects;
DROP POLICY IF EXISTS "logos owner delete" ON storage.objects;
DROP POLICY IF EXISTS "logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_delete_own" ON storage.objects;

CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "logos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "logos_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "logos_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_koji_admin()));

-- =============================================================
-- photos (privé : propriétaire/admin)
-- =============================================================
DROP POLICY IF EXISTS "photos owner all" ON storage.objects;
DROP POLICY IF EXISTS "photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_own" ON storage.objects;

CREATE POLICY "photos_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "photos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "photos_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photos' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'photos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "photos_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND (owner = auth.uid() OR public.is_koji_admin()));

-- =============================================================
-- documents (privé : propriétaire/admin)
-- =============================================================
DROP POLICY IF EXISTS "documents owner all" ON storage.objects;
DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;

CREATE POLICY "documents_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "documents_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "documents_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "documents_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_koji_admin()));
