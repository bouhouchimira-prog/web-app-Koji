-- 0015 — Durcissement Storage pour les buckets non-"products" (lot P0-6)
--
-- Complète 0013 (qui ne durcissait que le bucket "products") en appliquant la
-- même logique (propriétaire = auth.uid() OU admin Kôji) aux autres buckets
-- utilisés par le web et le mobile. Les buckets publics gardent une lecture
-- publique ; les buckets privés restreignent la lecture au propriétaire.
--
-- Cartographie vérifiée dans le code (bucket → préfixe de chemin utilisé) :
--
--   PUBLICS (lecture publique conservée ; écriture réservée au propriétaire) :
--     products              : (mobile produits-app)  <userId>/<...> et admin
--     business-logos        : <uid>/logo.<ext>
--     signatures            : user_signature_<uid>.png  et  <userId>/<fileName> (signature app)
--     fourniture-images     : <userId>/<timestamp>.<ext>
--     fournitures           : <uuid>.<ext> (admin)
--
--   PRIVÉS (lecture réservée au propriétaire / admin) :
--     quote_attachments     : chantier-photos/<userId|worker.userId|chantier.user_id>/<projectId|chantier.id>/...
--                            chantier-pv/<userId>/<projectId>/...
--                            visites/<userId>/<visiteId>/...
--                            vigilance/<userId>/<chantierId>/...
--                            interventions/<userId>/<interventionId>/...
--                            depenses/<userId>/...
--                            kojipage/<userId>/...
--                            compte/<userId>/cgv.pdf
--                            chantier-dossier/<userId>/<projectId>/...
--                            urgences/<clientId>/<urgenceId>.jpg
--                            quotes/<quoteId>/<messageId>/<file> (mobile messages)
--     worker-uploads        : <chantierId>/<taskId>/photo_... et doc_...
--     worker_docs           : workers/<timestamp>_<name>
--     chantier-attachments  : <userId>/<chantierId>/<timestamp>_<name>
--     chantier_documents    : <chantierId>/<timestamp>_<name>
--     task_images           : task_<timestamp>_<name>
--     intervention-signatures : <userId>/<ref>_<timestamp>.png
--
-- Dépendance : fonction public.is_koji_admin() (créée par 0013). Recréée ici
-- pour autonomie de la migration.
--
-- À exécuter dans Supabase → SQL Editor, après 0013. Aucune donnée n'est modifiée.

-- =============================================================
-- Helper (idempotent)
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_koji_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_admin FROM public.users u WHERE u.id = auth.uid()), false)
      OR COALESCE(auth.jwt() ->> 'email', '') IN (
        'bouhouchimira@gmail.com',
        'ablexpertrenov@gmail.com'
      );
$$;

-- =============================================================
-- Fonction générique : politique par bucket, portée au propriétaire
-- =============================================================

-- Buckets PRIVÉS : lecture/écriture réservées au propriétaire (owner = auth.uid())
-- ou à un admin Kôji. Le service_role contourne le RLS comme d'habitude.

-- ----- quote_attachments -----
DROP POLICY IF EXISTS "quote_attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_delete_own" ON storage.objects;

CREATE POLICY "quote_attachments_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quote_attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "quote_attachments_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quote_attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "quote_attachments_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'quote_attachments' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'quote_attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "quote_attachments_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'quote_attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- worker-uploads -----
DROP POLICY IF EXISTS "worker_uploads_select_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_uploads_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_uploads_update_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_uploads_delete_own" ON storage.objects;

CREATE POLICY "worker_uploads_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'worker-uploads' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_uploads_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'worker-uploads' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_uploads_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'worker-uploads' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'worker-uploads' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_uploads_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'worker-uploads' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- worker_docs -----
DROP POLICY IF EXISTS "worker_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "worker_docs_delete_own" ON storage.objects;

CREATE POLICY "worker_docs_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'worker_docs' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_docs_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'worker_docs' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_docs_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'worker_docs' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'worker_docs' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "worker_docs_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'worker_docs' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- chantier-attachments -----
DROP POLICY IF EXISTS "chantier_attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_attachments_delete_own" ON storage.objects;

CREATE POLICY "chantier_attachments_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chantier-attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_attachments_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chantier-attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_attachments_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chantier-attachments' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'chantier-attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_attachments_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chantier-attachments' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- chantier_documents -----
DROP POLICY IF EXISTS "chantier_documents_select_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS "chantier_documents_delete_own" ON storage.objects;

CREATE POLICY "chantier_documents_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chantier_documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_documents_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chantier_documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_documents_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chantier_documents' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'chantier_documents' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "chantier_documents_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chantier_documents' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- task_images -----
DROP POLICY IF EXISTS "task_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "task_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "task_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "task_images_delete_own" ON storage.objects;

CREATE POLICY "task_images_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task_images' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "task_images_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task_images' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "task_images_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'task_images' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'task_images' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "task_images_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'task_images' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- intervention-signatures -----
DROP POLICY IF EXISTS "intervention_signatures_select_own" ON storage.objects;
DROP POLICY IF EXISTS "intervention_signatures_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "intervention_signatures_update_own" ON storage.objects;
DROP POLICY IF EXISTS "intervention_signatures_delete_own" ON storage.objects;

CREATE POLICY "intervention_signatures_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'intervention-signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "intervention_signatures_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'intervention-signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "intervention_signatures_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'intervention-signatures' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'intervention-signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "intervention_signatures_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'intervention-signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

-- =============================================================
-- Buckets PUBLICS : lecture publique conservée (URLs publiques),
-- écriture réservée au propriétaire / admin.
-- =============================================================

-- ----- business-logos -----
DROP POLICY IF EXISTS "business_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_delete_own" ON storage.objects;

CREATE POLICY "business_logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-logos');

CREATE POLICY "business_logos_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-logos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "business_logos_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'business-logos' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'business-logos' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "business_logos_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'business-logos' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- signatures -----
DROP POLICY IF EXISTS "signatures_select_public" ON storage.objects;
DROP POLICY IF EXISTS "signatures_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "signatures_update_own" ON storage.objects;
DROP POLICY IF EXISTS "signatures_delete_own" ON storage.objects;

CREATE POLICY "signatures_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');

CREATE POLICY "signatures_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "signatures_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'signatures' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "signatures_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'signatures' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- fourniture-images -----
DROP POLICY IF EXISTS "fourniture_images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "fourniture_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "fourniture_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "fourniture_images_delete_own" ON storage.objects;

CREATE POLICY "fourniture_images_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fourniture-images');

CREATE POLICY "fourniture_images_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fourniture-images' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "fourniture_images_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'fourniture-images' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'fourniture-images' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "fourniture_images_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fourniture-images' AND (owner = auth.uid() OR public.is_koji_admin()));

-- ----- fournitures (admin) -----
DROP POLICY IF EXISTS "fournitures_select_public" ON storage.objects;
DROP POLICY IF EXISTS "fournitures_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "fournitures_update_own" ON storage.objects;
DROP POLICY IF EXISTS "fournitures_delete_own" ON storage.objects;

CREATE POLICY "fournitures_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fournitures');

CREATE POLICY "fournitures_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fournitures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "fournitures_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'fournitures' AND (owner = auth.uid() OR public.is_koji_admin()))
  WITH CHECK (bucket_id = 'fournitures' AND (owner = auth.uid() OR public.is_koji_admin()));

CREATE POLICY "fournitures_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fournitures' AND (owner = auth.uid() OR public.is_koji_admin()));

-- =============================================================
-- Nettoyage des policies permissives héritées (au cas où)
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
