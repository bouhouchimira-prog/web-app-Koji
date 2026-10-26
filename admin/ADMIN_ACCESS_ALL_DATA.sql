-- ============================================
-- ADMIN ACCESS: See ALL Users, Quotes, Products
-- Run this in Supabase SQL Editor
-- ============================================

-- This removes the restriction so authenticated users (admins) can see ALL data

-- ============================================
-- 1. DROP OLD RESTRICTIVE POLICIES
-- ============================================

-- Users table - remove old policies
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Quotes table - remove old policies
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

-- ============================================
-- 2. CREATE NEW ADMIN POLICIES (VIEW ALL DATA)
-- ============================================

-- USERS: Admins can see ALL users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  USING (auth.role() = 'authenticated');

-- QUOTES: Admins can see ALL quotes
CREATE POLICY "Admins can view all quotes"
  ON quotes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update all quotes"
  ON quotes FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete quotes"
  ON quotes FOR DELETE
  USING (auth.role() = 'authenticated');

-- PRODUCTS: Already has correct policies (all authenticated users can access)
-- No changes needed for products table

-- ============================================
-- 3. VERIFY POLICIES
-- ============================================
-- You can check the policies with:
-- SELECT * FROM pg_policies WHERE tablename IN ('users', 'quotes', 'products');

-- ============================================
-- DONE! Now admins can see ALL data
-- ============================================
-- Refresh your dashboard at http://localhost:3000/dashboard
-- You should now see:
-- - ALL users in the Users page
-- - ALL quotes in the Quotes page
-- - ALL products in the Products page
-- ============================================
