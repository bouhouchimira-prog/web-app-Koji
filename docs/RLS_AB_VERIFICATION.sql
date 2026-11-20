-- ============================================================================
-- Vérification RLS A/B — projet Supabase de base Kôji
-- ============================================================================
-- À exécuter dans Supabase → SQL Editor (rôle postgres/service_role).
-- Remplacer les placeholders <UUID_A>, <UUID_B>, <UUID_ADMIN> par les vrais
-- identifiants auth.users des deux comptes de test (+ admin).
--
-- Principe : on simule la session d'un utilisateur en positionnant
-- request.jwt.claims, puis on bascule en rôle authenticated pour que les
-- policies RLS s'appliquent. En fin de bloc on revient en service_role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. PRÉ-REQUIS (à faire une fois, hors script)
-- ---------------------------------------------------------------------------
-- Créer deux comptes de test dans Auth (Dashboard → Authentication → Users)
-- ou via l'app : un compte "A" et un compte "B", plus utiliser un compte admin
-- existant. Noter leurs UUID (auth.users.id) et les reporter ci-dessous.

-- Variables de session (à adapter) :
-- \set uuid_a '00000000-0000-0000-0000-00000000000a'
-- \set uuid_b '00000000-0000-0000-0000-00000000000b'
-- \set uuid_admin '00000000-0000-0000-0000-0000000000ad'

-- ---------------------------------------------------------------------------
-- 1. CATALOGUE DES POLICIES (contrôle visuel)
-- ---------------------------------------------------------------------------

-- Tables métier
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users', 'quotes', 'fournisseurs', 'fournitures')
ORDER BY tablename, policyname;

-- Storage
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Triggers de protection
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname IN ('protect_sensitive_user_fields', 'protect_quote_owner')
ORDER BY tgname;

-- ---------------------------------------------------------------------------
-- 2. PRÉPARATION DES DONNÉES DE TEST (service_role, RLS contourné)
-- ---------------------------------------------------------------------------
-- Créer un devis pour A et un devis pour B (si absents).

-- INSERT INTO public.quotes (id, user_id, status, created_at)
-- VALUES (gen_random_uuid(), '<UUID_A>'::uuid, 'brouillon', now())
-- ON CONFLICT DO NOTHING;
-- INSERT INTO public.quotes (id, user_id, status, created_at)
-- VALUES (gen_random_uuid(), '<UUID_B>'::uuid, 'brouillon', now())
-- ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. HELPER : exécuter un bloc en tant qu'utilisateur donné
-- ---------------------------------------------------------------------------
-- Usage : SELECT set_config('request.jwt.claims', '{"sub":"<UUID>","role":"authenticated"}', true);
--         SET ROLE authenticated;
--         ... requêtes de test ...
--         RESET ROLE;

-- ============================================================================
-- TEST 1 : A ne voit pas les devis de B
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"<UUID_A>","role":"authenticated"}', true);
SET ROLE authenticated;

-- Doit retourner uniquement les devis dont user_id = A
SELECT count(*) AS devis_visibles_par_A
FROM public.quotes
WHERE user_id = '<UUID_B>'::uuid;   -- attendu : 0

-- Doit retourner les devis de A
SELECT count(*) AS devis_A_visibles
FROM public.quotes
WHERE user_id = '<UUID_A>'::uuid;   -- attendu : >= 1 (ceux de A)

RESET ROLE;

-- ============================================================================
-- TEST 2 : A ne peut pas modifier les champs sensibles de son profil
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"<UUID_A>","role":"authenticated"}', true);
SET ROLE authenticated;

-- Tentative de promotion admin / changement de type / portail : doit être
-- silencieusement annulé par le trigger (les valeurs restent celles d'origine).
UPDATE public.users
SET is_admin = true,
    account_type = 'admin',
    portal_identifier = 'pirate',
    is_active = false,
    _billingPlan = 'enterprise'
WHERE id = '<UUID_A>'::uuid;

-- Vérifier qu'aucun champ sensible n'a changé :
SELECT is_admin, account_type, portal_identifier, is_active,
       business_info ->> '_billingPlan' AS billing_plan
FROM public.users
WHERE id = '<UUID_A>'::uuid;
-- attendu : is_admin = false, account_type inchangé, portal_identifier inchangé,
--           is_active = true, billing_plan inchangé (ou NULL)

RESET ROLE;

-- ============================================================================
-- TEST 3 : A ne peut pas modifier/supprimer les fournisseurs de B
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"<UUID_A>","role":"authenticated"}', true);
SET ROLE authenticated;

-- Tentative de modification d'un fournisseur appartenant à B : doit échouer (0 lignes)
UPDATE public.fournisseurs
SET nom = 'pirate'
WHERE user_id = '<UUID_B>'::uuid;
-- attendu : UPDATE 0

-- Tentative de suppression : doit échouer (0 lignes)
DELETE FROM public.fournisseurs
WHERE user_id = '<UUID_B>'::uuid;
-- attendu : DELETE 0

RESET ROLE;

-- ============================================================================
-- TEST 4 : Anonyme ne peut pas signer sans l'e-mail correspondant
-- ============================================================================
-- (Vérification manuelle côté app : un lien de signature anonyme doit être
-- rejeté si l'e-mail fourni ne correspond pas au devis. Contrôle SQL : la
-- policy quotes_update_own_or_admin exige user_id = auth.uid() OU admin.)

-- ============================================================================
-- TEST 5 : Signature existante non écrasable
-- ============================================================================
-- (Contrôle applicatif + contrainte DB si présente. Vérifier qu'une seconde
-- écriture sur un devis déjà signé est refusée par la route de signature.)

-- ============================================================================
-- TEST 6 : Storage — A ne peut pas lire/écrire/supprimer les objets de B
--          dans les buckets PRIVÉS
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"<UUID_A>","role":"authenticated"}', true);
SET ROLE authenticated;

-- Lecture des objets de B : attendu 0
SELECT count(*) AS objets_B_visibles_par_A
FROM storage.objects
WHERE owner = '<UUID_B>'::uuid
  AND bucket_id IN ('quote_attachments','worker-uploads','worker_docs',
                    'chantier-attachments','chantier_documents','task_images',
                    'intervention-signatures');

-- Tentative d'insertion dans un bucket privé au nom de B : doit échouer (RLS)
-- (à tester via l'API Storage ou en insérant manuellement avec owner = B)
-- INSERT INTO storage.objects (bucket_id, name, owner)
-- VALUES ('quote_attachments', 'test/pirate.txt', '<UUID_B>'::uuid);
-- attendu : ERROR permission denied (RLS)

-- Tentative de suppression d'un objet de B : doit échouer (0 lignes)
DELETE FROM storage.objects
WHERE owner = '<UUID_B>'::uuid
  AND bucket_id = 'quote_attachments';
-- attendu : DELETE 0

RESET ROLE;

-- ============================================================================
-- TEST 7 : Storage — buckets PUBLICS restent lisibles par tous
-- ============================================================================
-- Anonyme (role anon) peut lire les buckets publics
SET ROLE anon;
SELECT count(*) AS objets_publics_visibles
FROM storage.objects
WHERE bucket_id IN ('business-logos','signatures','fourniture-images',
                    'fournitures','products');
-- attendu : >= 0 (pas d'erreur RLS)
RESET ROLE;

-- ============================================================================
-- TEST 8 : Admin voit tout
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"<UUID_ADMIN>","role":"authenticated"}', true);
SET ROLE authenticated;

SELECT count(*) AS devis_visibles_par_admin FROM public.quotes;   -- attendu : total
SELECT count(*) AS users_visibles_par_admin FROM public.users;    -- attendu : total
SELECT count(*) AS objets_visibles_par_admin FROM storage.objects; -- attendu : total

RESET ROLE;

-- ============================================================================
-- 4. NETTOYAGE (optionnel)
-- ============================================================================
-- Supprimer les données de test créées à l'étape 2 si nécessaire.

-- ============================================================================
-- RÉSULTAT ATTENDU : tous les tests ci-dessus respectent les attentes.
-- Tout écart = régression à corriger avant mise en production.
-- ============================================================================
