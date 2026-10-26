-- ============================================
-- RESTREINT koji-admin A UN SEUL COMPTE (25 octobre)
-- A executer dans l'editeur SQL Supabase
-- ============================================
--
-- Remplace les policies RLS ouvertes a "n'importe quel compte authentifie"
-- (ADMIN_ACCESS_ALL_DATA.sql pour users/quotes/products,
-- supabase_fournitures_setup.sql pour fournisseurs/fournitures) par un
-- controle reel : seul ablexpertrenov@gmail.com peut lire/ecrire ces
-- tables. C'est la vraie barriere de securite (koji-admin lit avec sa cle
-- anon, donc la base elle-meme doit refuser, pas seulement l'interface) —
-- app/dashboard/layout.tsx verifie deja le meme email cote serveur, mais
-- sans ca, n'importe quel compte Supabase Auth (y compris un compte
-- entreprise/particulier koji-web, meme projet) pouvait appeler l'API
-- Supabase directement et lire les devis/utilisateurs de tout le monde.

-- ============================================
-- 1. USERS
-- ============================================
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

CREATE POLICY "Only ablexpertrenov can read users" ON users
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert users" ON users
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can update users" ON users
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can delete users" ON users
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ============================================
-- 2. QUOTES
-- ============================================
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON quotes;

CREATE POLICY "Only ablexpertrenov can read quotes" ON quotes
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert quotes" ON quotes
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can update quotes" ON quotes
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can delete quotes" ON quotes
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ============================================
-- 3. PRODUCTS
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON products;

CREATE POLICY "Only ablexpertrenov can read products" ON products
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert products" ON products
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can update products" ON products
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can delete products" ON products
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ============================================
-- 4. FOURNISSEURS
-- ============================================
DROP POLICY IF EXISTS "fournisseurs read for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs write for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs update for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs delete for authenticated" ON public.fournisseurs;

CREATE POLICY "Only ablexpertrenov can read fournisseurs" ON public.fournisseurs
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert fournisseurs" ON public.fournisseurs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can update fournisseurs" ON public.fournisseurs
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com') WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can delete fournisseurs" ON public.fournisseurs
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ============================================
-- 5. FOURNITURES
-- ============================================
DROP POLICY IF EXISTS "fournitures read for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures write for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures update for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures delete for authenticated" ON public.fournitures;

CREATE POLICY "Only ablexpertrenov can read fournitures" ON public.fournitures
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert fournitures" ON public.fournitures
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can update fournitures" ON public.fournitures
  FOR UPDATE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com') WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can delete fournitures" ON public.fournitures
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ============================================
-- VERIFIER
-- ============================================
-- SELECT tablename, policyname, qual FROM pg_policies
-- WHERE tablename IN ('users','quotes','products','fournisseurs','fournitures')
-- ORDER BY tablename;
