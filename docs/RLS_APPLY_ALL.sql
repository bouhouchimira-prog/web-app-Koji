-- 0013 ‚Äî RLS canonique et protection des champs sensibles (18 novembre 2026)
--
-- Supersede les scripts historiques de admin/ pour users, quotes, fournisseurs,
-- fournitures et le bucket Storage "products". Les scripts anciens ne doivent
-- plus √™tre ex√©cut√©s tels quels : voir docs/RLS_CANONICAL.md.
--
-- √Ä ex√©cuter dans Supabase ‚Üí SQL Editor, de pr√©f√©rence sur une base de test
-- avec deux comptes distincts, puis en production. Aucune donn√©e n'est modifi√©e.

-- =============================================================
-- Helpers
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

CREATE OR REPLACE FUNCTION public.protect_sensitive_user_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  protected_key text;
  protected_keys text[] := ARRAY[
    '_billingPlan', '_billingStatus', '_billingInterval',
    '_stripeCustomerId', '_grandfathered', '_addonWebsite', '_addonPremium'
  ];
BEGIN
  -- Le serveur (service_role) et l'√©diteur SQL gardent tous les droits.
  IF jwt_role = 'service_role'
     OR (jwt_role = '' AND current_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Identit√© et privil√®ges : restaur√©s √† leur ancienne valeur.
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.is_admin := OLD.is_admin;
    NEW.is_pro := OLD.is_pro;
    NEW.email_verified := OLD.email_verified;
    NEW.is_active := OLD.is_active;
    NEW.account_type := OLD.account_type;
    NEW.portal_identifier := OLD.portal_identifier;
    NEW.full_name := OLD.full_name;
    NEW.company_name := OLD.company_name;
    NEW.created_at := OLD.created_at;

    -- Champs de facturation d√©j√† prot√©g√©s par la migration 0009.
    IF OLD.business_info IS NOT NULL OR NEW.business_info IS NOT NULL THEN
      FOREACH protected_key IN ARRAY protected_keys LOOP
        IF OLD.business_info IS NOT NULL AND OLD.business_info ? protected_key THEN
          NEW.business_info := jsonb_set(
            COALESCE(NEW.business_info, '{}'::jsonb),
            ARRAY[protected_key],
            OLD.business_info -> protected_key
          );
        ELSIF NEW.business_info IS NOT NULL THEN
          NEW.business_info := NEW.business_info - protected_key;
        END IF;
      END LOOP;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Un compte cr√©√© avec la session utilisateur ne peut pas arriver d√©j√† admin.
    NEW.is_admin := false;
    NEW.email_verified := COALESCE(NEW.email_verified, false);
    NEW.is_active := COALESCE(NEW.is_active, true);
    IF NEW.business_info IS NOT NULL THEN
      FOREACH protected_key IN ARRAY protected_keys LOOP
        NEW.business_info := NEW.business_info - protected_key;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_quote_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
BEGIN
  IF jwt_role = 'service_role'
     OR (jwt_role = '' AND current_user IN ('postgres', 'supabase_admin'))
     OR public.is_koji_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================
-- Users
-- =============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Only ablexpertrenov can read users" ON public.users;
DROP POLICY IF EXISTS "Only ablexpertrenov can insert users" ON public.users;
DROP POLICY IF EXISTS "Only ablexpertrenov can update users" ON public.users;
DROP POLICY IF EXISTS "Only ablexpertrenov can delete users" ON public.users;
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

CREATE POLICY "users_select_own_or_admin"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid() AND COALESCE(is_admin, false) = false);

CREATE POLICY "users_update_own_or_admin"
  ON public.users FOR UPDATE
  USING (id = auth.uid() OR public.is_koji_admin())
  WITH CHECK (id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  USING (public.is_koji_admin());

DROP TRIGGER IF EXISTS protect_billing_fields ON public.users;
DROP FUNCTION IF EXISTS public.protect_billing_fields();
DROP TRIGGER IF EXISTS protect_sensitive_user_fields ON public.users;
CREATE TRIGGER protect_sensitive_user_fields
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_sensitive_user_fields();

-- =============================================================
-- Quotes
-- =============================================================

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can delete all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_own_or_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_own" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_own_or_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete_own_or_admin" ON public.quotes;

CREATE POLICY "quotes_select_own_or_admin"
  ON public.quotes FOR SELECT
  USING (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "quotes_insert_own"
  ON public.quotes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "quotes_update_own_or_admin"
  ON public.quotes FOR UPDATE
  USING (user_id = auth.uid() OR public.is_koji_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "quotes_delete_own_or_admin"
  ON public.quotes FOR DELETE
  USING (user_id = auth.uid() OR public.is_koji_admin());

DROP TRIGGER IF EXISTS protect_quote_owner ON public.quotes;
CREATE TRIGGER protect_quote_owner
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.protect_quote_owner();

-- =============================================================
-- Suppliers and supplies
-- =============================================================

ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournitures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fournisseurs read for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs write for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs update for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs delete for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_select_own" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_insert_own" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_update_own" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs_delete_own" ON public.fournisseurs;

CREATE POLICY "fournisseurs_select_own"
  ON public.fournisseurs FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR public.is_koji_admin());

CREATE POLICY "fournisseurs_insert_own"
  ON public.fournisseurs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "fournisseurs_update_own"
  ON public.fournisseurs FOR UPDATE
  USING (user_id = auth.uid() OR public.is_koji_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "fournisseurs_delete_own"
  ON public.fournisseurs FOR DELETE
  USING (user_id = auth.uid() OR public.is_koji_admin());

DROP POLICY IF EXISTS "fournitures read for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures write for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures update for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures delete for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures_select_own" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures_insert_own" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures_update_own" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures_delete_own" ON public.fournitures;

CREATE POLICY "fournitures_select_own"
  ON public.fournitures FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL OR public.is_koji_admin());

CREATE POLICY "fournitures_insert_own"
  ON public.fournitures FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "fournitures_update_own"
  ON public.fournitures FOR UPDATE
  USING (user_id = auth.uid() OR public.is_koji_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_koji_admin());

CREATE POLICY "fournitures_delete_own"
  ON public.fournitures FOR DELETE
  USING (user_id = auth.uid() OR public.is_koji_admin());

-- =============================================================
-- Storage: bucket products
-- =============================================================

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "products_select_public" ON storage.objects;
DROP POLICY IF EXISTS "products_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "products_update_own" ON storage.objects;
DROP POLICY IF EXISTS "products_delete_own" ON storage.objects;

CREATE POLICY "products_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

CREATE POLICY "products_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products'
    AND (owner = auth.uid() OR public.is_koji_admin())
  );

CREATE POLICY "products_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products'
    AND (owner = auth.uid() OR public.is_koji_admin())
  )
  WITH CHECK (
    bucket_id = 'products'
    AND (owner = auth.uid() OR public.is_koji_admin())
  );

CREATE POLICY "products_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products'
    AND (owner = auth.uid() OR public.is_koji_admin())
  );

-- ===========================================================================
-- LOT P0-6 : 0015_storage_canonical.sql
-- ===========================================================================

-- 0015 ‘«ˆ Durcissement Storage pour les buckets non-"products" (lot P0-6)
--
-- Compl+øte 0013 (qui ne durcissait que le bucket "products") en appliquant la
-- m+¨me logique (propri+Ætaire = auth.uid() OU admin K+¶ji) aux autres buckets
-- utilis+Æs par le web et le mobile. Les buckets publics gardent une lecture
-- publique ; les buckets priv+Æs restreignent la lecture au propri+Ætaire.
--
-- Cartographie v+Ærifi+Æe dans le code (bucket ‘Â∆ pr+Æfixe de chemin utilis+Æ) :
--
--   PUBLICS (lecture publique conserv+Æe ; +Æcriture r+Æserv+Æe au propri+Ætaire) :
--     products              : (mobile produits-app)  <userId>/<...> et admin
--     business-logos        : <uid>/logo.<ext>
--     signatures            : user_signature_<uid>.png  et  <userId>/<fileName> (signature app)
--     fourniture-images     : <userId>/<timestamp>.<ext>
--     fournitures           : <uuid>.<ext> (admin)
--
--   PRIV+ÎS (lecture r+Æserv+Æe au propri+Ætaire / admin) :
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
-- D+Æpendance : fonction public.is_koji_admin() (cr+Æ+Æe par 0013). Recr+Æ+Æe ici
-- pour autonomie de la migration.
--
-- +« ex+Æcuter dans Supabase ‘Â∆ SQL Editor, apr+øs 0013. Aucune donn+Æe n'est modifi+Æe.

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
-- Fonction g+Æn+Ærique : politique par bucket, port+Æe au propri+Ætaire
-- =============================================================

-- Buckets PRIV+ÎS : lecture/+Æcriture r+Æserv+Æes au propri+Ætaire (owner = auth.uid())
-- ou +· un admin K+¶ji. Le service_role contourne le RLS comme d'habitude.

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
-- Buckets PUBLICS : lecture publique conserv+Æe (URLs publiques),
-- +Æcriture r+Æserv+Æe au propri+Ætaire / admin.
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
-- Nettoyage des policies permissives h+Ærit+Æes (au cas o+¶)
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
