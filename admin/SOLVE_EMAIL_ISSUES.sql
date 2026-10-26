-- ============================================
-- SOLVE EMAIL CONFIRMATION ISSUES (CORRECTED)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Confirm ALL existing users immediately
-- We only update email_confirmed_at, confirmed_at is generated automatically
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. Create a Database Function to auto-confirm new users
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  -- Removed confirmed_at update as it is generated
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a Trigger to run this function on every new signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- ============================================
-- DONE!
-- The error "column confirmed_at can only be updated to DEFAULT" is fixed.
-- Try running this implementation.
-- ============================================
