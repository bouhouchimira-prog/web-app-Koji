-- ============================================
-- DISABLE EMAIL CONFIRMATION REQUIREMENT
-- Run this in Supabase SQL Editor
-- ============================================

-- This allows users to sign in immediately without email confirmation
-- Note: You should also disable email confirmation in Supabase Dashboard
-- Go to: Authentication > Settings > Email Auth > Disable "Confirm email"

-- For existing unconfirmed users, confirm them manually:
-- (Replace 'your-email@example.com' with your actual email)

UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'firas2001@gmail.com' 
AND email_confirmed_at IS NULL;

-- ============================================
-- ALTERNATIVE: Confirm ALL unconfirmed users
-- ============================================
-- Uncomment the line below to confirm ALL users at once:
-- UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
