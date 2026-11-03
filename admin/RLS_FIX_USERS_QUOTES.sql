-- ============================================
-- RLS FIX — users & quotes (multi-utilisateur)
-- A executer dans l'editeur SQL Supabase APRES avoir verifie l'etat actuel.
-- ============================================
-- Probleme : ADMIN_ACCESS_ALL_DATA.sql a ouvert users/quotes a TOUS les
-- comptes authentifies (USING auth.role() = 'authenticated'), puis
-- RESTRICT_ACCESS_TO_ADMIN.sql a restreint a un seul email
-- (ablexpertrenov@gmail.com). Resultat : soit trop ouvert, soit casse pour
-- tous les autres utilisateurs (web + mobile) qui ne peuvent plus lire leur
-- propre ligne. Ce fichier remet des policies correctes :
--   - chaque utilisateur lit/modifie SA propre ligne (auth.uid() = id)
--   - l'admin (email ablexpertrenov@gmail.com) lit/modifie tout
-- ============================================

-- ===== USERS =====
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Only ablexpertrenov can read users" ON users;
DROP POLICY IF EXISTS "Only ablexpertrenov can insert users" ON users;
DROP POLICY IF EXISTS "Only ablexpertrenov can update users" ON users;
DROP POLICY IF EXISTS "Only ablexpertrenov can delete users" ON users;

CREATE POLICY "users_select_own_or_admin" ON users
  FOR SELECT USING (
    auth.uid() = id
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own_or_admin" ON users
  FOR UPDATE USING (
    auth.uid() = id
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- ===== QUOTES =====
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can read quotes" ON quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can update quotes" ON quotes;
DROP POLICY IF EXISTS "Only ablexpertrenov can delete quotes" ON quotes;

CREATE POLICY "quotes_select_own_or_admin" ON quotes
  FOR SELECT USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );
CREATE POLICY "quotes_insert_own" ON quotes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "quotes_update_own_or_admin" ON quotes
  FOR UPDATE USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );
CREATE POLICY "quotes_delete_own_or_admin" ON quotes
  FOR DELETE USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );

-- VERIFIER :
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE tablename IN ('users','quotes') ORDER BY tablename, policyname;
