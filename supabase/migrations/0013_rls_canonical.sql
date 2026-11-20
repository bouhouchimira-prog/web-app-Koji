-- 0013 — RLS canonique et protection des champs sensibles (18 novembre 2026)
--
-- Supersede les scripts historiques de admin/ pour users, quotes, fournisseurs,
-- fournitures et le bucket Storage "products". Les scripts anciens ne doivent
-- plus être exécutés tels quels : voir docs/RLS_CANONICAL.md.
--
-- À exécuter dans Supabase → SQL Editor, de préférence sur une base de test
-- avec deux comptes distincts, puis en production. Aucune donnée n'est modifiée.

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
  -- Le serveur (service_role) et l'éditeur SQL gardent tous les droits.
  IF jwt_role = 'service_role'
     OR (jwt_role = '' AND current_user IN ('postgres', 'supabase_admin')) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Identité et privilèges : restaurés à leur ancienne valeur.
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

    -- Champs de facturation déjà protégés par la migration 0009.
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
    -- Un compte créé avec la session utilisateur ne peut pas arriver déjà admin.
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
