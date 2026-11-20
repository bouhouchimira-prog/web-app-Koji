-- 0016 — Nettoyage des policies Storage permissives héritées (lot P0-6, suite)
--
-- Le bloc 2 de la vérification a révélé que 0015 (qui ajoutait les policies
-- canoniques) n'avait PAS supprimé les anciennes policies permissives, car
-- leurs noms diffèrent. Tant qu'elles existent, les policies RLS sont combinées
-- par OR : un compte authentifié garde l'accès total via l'ancienne policy
-- (ex. "Service role manages attachments" accorde ALL à tout authenticated sur
-- quote_attachments). Ce nettoyage est donc indispensable pour que le
-- durcissement soit effectif.
--
-- À exécuter dans Supabase → SQL Editor, après 0015. Aucune donnée n'est modifiée.
-- Les buckets non-Kôji (documents, logos, photos, items, profiles, menu-images)
-- sont volontairement laissés intacts pour ne pas casser d'autres applications ;
-- ils feront l'objet d'un audit séparé.

-- =============================================================
-- quote_attachments (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages attachments" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_storage_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_storage_select_auth" ON storage.objects;

-- =============================================================
-- worker-uploads (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "worker_uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "worker_uploads_select" ON storage.objects;

-- =============================================================
-- worker_docs (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- =============================================================
-- chantier-attachments (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "chantier_attachments_delete" ON storage.objects;
DROP POLICY IF EXISTS "chantier_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "chantier_attachments_select" ON storage.objects;

-- =============================================================
-- chantier_documents (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Allow authenticated delete chantier_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select chantier_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update chantier_documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads chantier_documents" ON storage.objects;

-- =============================================================
-- task_images (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Allow authenticated delete task_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select task_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update task_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads task_images" ON storage.objects;

-- =============================================================
-- signatures (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Allow authenticated delete signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads signatures" ON storage.objects;
DROP POLICY IF EXISTS "signatures_storage_insert_client" ON storage.objects;
DROP POLICY IF EXISTS "signatures_storage_select_auth" ON storage.objects;

-- =============================================================
-- business-logos (bucket Kôji)
-- =============================================================
DROP POLICY IF EXISTS "Users can delete own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own logo" ON storage.objects;

-- =============================================================
-- Vérification post-nettoyage
-- =============================================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname IN (
--     'Allow authenticated delete','Allow authenticated select','Allow authenticated update',
--     'Allow authenticated uploads','Allow public select','Allow public uploads',
--     'Service role manages attachments','Users can delete own logo','Users can read own logo',
--     'Users can update own logo','Users can upload own logo','chantier_attachments_delete',
--     'chantier_attachments_insert','chantier_attachments_select','signatures_storage_insert_client',
--     'signatures_storage_select_auth','worker_uploads_insert','worker_uploads_select',
--     'quote_attachments_storage_insert_auth','quote_attachments_storage_select_auth'
--   );
-- attendu : 0 ligne.
