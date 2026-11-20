-- ============================================================================
-- Verification RLS A/B - projet Supabase de base Koji (UUID remplis)
-- ============================================================================
-- Comptes utilises :
--   A (utilisateur normal) : firasmzoughi2001@gmail.com  -> 60076f57-890d-4e63-b8c8-331168b5fc51
--   B (utilisateur normal) : salasidouk@gmail.com         -> c503cafe-a590-4444-8a27-43987daffbe2
--   ADMIN                  : bouhouchimira@gmail.com      -> e8623bfb-ee88-4f21-95a4-55738f534758
--
-- Executer bloc par bloc dans Supabase -> SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. (Optionnel) Donnees de test : creer un devis pour A et un devis pour B
--    si aucun n'existe. Decommenter si besoin.
-- ---------------------------------------------------------------------------
-- INSERT INTO public.quotes (id, user_id, status, created_at)
-- VALUES (gen_random_uuid(), '60076f57-890d-4e63-b8c8-331168b5fc51'::uuid, 'brouillon', now());
-- INSERT INTO public.quotes (id, user_id, status, created_at)
-- VALUES (gen_random_uuid(), 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid, 'brouillon', now());

-- ---------------------------------------------------------------------------
-- 1. CATALOGUE DES POLICIES
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users', 'quotes', 'fournisseurs', 'fournitures')
ORDER BY tablename, policyname;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname IN ('protect_sensitive_user_fields', 'protect_quote_owner')
ORDER BY tgname;

-- ---------------------------------------------------------------------------
-- TEST 1 : A ne voit pas les devis de B
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"60076f57-890d-4e63-b8c8-331168b5fc51","role":"authenticated"}', true);
SET ROLE authenticated;

SELECT count(*) AS devis_B_visibles_par_A   -- attendu : 0
FROM public.quotes
WHERE user_id = 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid;

SELECT count(*) AS devis_A_visibles         -- attendu : >= 1 (si donnees de test creees)
FROM public.quotes
WHERE user_id = '60076f57-890d-4e63-b8c8-331168b5fc51'::uuid;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEST 2 : A ne peut pas modifier ses champs sensibles
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"60076f57-890d-4e63-b8c8-331168b5fc51","role":"authenticated"}', true);
SET ROLE authenticated;

UPDATE public.users
SET is_admin = true, account_type = 'admin', portal_identifier = 'pirate',
    is_active = false
WHERE id = '60076f57-890d-4e63-b8c8-331168b5fc51'::uuid;

SELECT is_admin, account_type, portal_identifier, is_active
FROM public.users
WHERE id = '60076f57-890d-4e63-b8c8-331168b5fc51'::uuid;
-- attendu : is_admin = false, account_type inchange, portal_identifier inchange, is_active = true

RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEST 3 : A ne peut pas modifier/supprimer les fournisseurs de B
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"60076f57-890d-4e63-b8c8-331168b5fc51","role":"authenticated"}', true);
SET ROLE authenticated;

UPDATE public.fournisseurs SET nom = 'pirate' WHERE user_id = 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid;
-- attendu : UPDATE 0

DELETE FROM public.fournisseurs WHERE user_id = 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid;
-- attendu : DELETE 0

RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEST 4 : Storage - A ne voit pas les objets de B (buckets prives)
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"60076f57-890d-4e63-b8c8-331168b5fc51","role":"authenticated"}', true);
SET ROLE authenticated;

SELECT count(*) AS objets_B_visibles_par_A   -- attendu : 0
FROM storage.objects
WHERE owner = 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid
  AND bucket_id IN ('quote_attachments','worker-uploads','worker_docs',
                    'chantier-attachments','chantier_documents','task_images',
                    'intervention-signatures');

DELETE FROM storage.objects
WHERE owner = 'c503cafe-a590-4444-8a27-43987daffbe2'::uuid
  AND bucket_id = 'quote_attachments';
-- attendu : DELETE 0

RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEST 5 : Storage - buckets publics lisibles par tous (anon)
-- ---------------------------------------------------------------------------
SET ROLE anon;
SELECT count(*) AS objets_publics_visibles
FROM storage.objects
WHERE bucket_id IN ('business-logos','signatures','fourniture-images','fournitures','products');
-- attendu : pas d'erreur RLS
RESET ROLE;

-- ---------------------------------------------------------------------------
-- TEST 6 : Admin voit tout
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"e8623bfb-ee88-4f21-95a4-55738f534758","role":"authenticated"}', true);
SET ROLE authenticated;

SELECT count(*) AS devis_visibles_par_admin FROM public.quotes;
SELECT count(*) AS users_visibles_par_admin FROM public.users;
SELECT count(*) AS objets_visibles_par_admin FROM storage.objects;

RESET ROLE;

-- ============================================================================
-- RESULTAT ATTENDU : tous les tests ci-dessus respectent les attentes.
-- Tout ecart = regression a corriger avant mise en production.
-- ============================================================================
