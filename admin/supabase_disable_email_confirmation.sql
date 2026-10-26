-- ============================================
-- DISABLE EMAIL CONFIRMATION IN SUPABASE
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- This confirms any existing unconfirmed users
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ============================================
-- IMPORTANT: Also do this in Supabase Dashboard
-- ============================================
-- 1. Go to: Authentication > Settings
-- 2. Find "Email Auth" section
-- 3. DISABLE the toggle: "Confirm email"
-- 4. Click Save
--
-- This ensures future signups work immediately!
-- ============================================
