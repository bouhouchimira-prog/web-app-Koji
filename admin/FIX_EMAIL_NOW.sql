-- ============================================
-- FIX: Email Not Confirmed Error
-- Run this in Supabase SQL Editor NOW
-- ============================================

-- Step 1: Confirm ALL existing users immediately
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Step 2: Verify it worked
SELECT email, email_confirmed_at, confirmed_at 
FROM auth.users;

-- ============================================
-- IMPORTANT: After running this SQL
-- ============================================
-- You MUST also go to Supabase Dashboard:
-- 1. Authentication > Providers > Email
-- 2. Turn OFF "Confirm email"
-- 3. Click Save
--
-- Then try logging in again!
-- ============================================
