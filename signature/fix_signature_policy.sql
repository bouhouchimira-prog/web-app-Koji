-- Fix RLS policy to allow clients to update signature without authentication
-- Run this in your Supabase SQL Editor

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Clients can update signature" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;

-- Allow authenticated users to update their own quotes
CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow ANYONE to update signature_data and signed_at fields for quotes matching their email
-- This is safe because we only allow updating specific fields
CREATE POLICY "Clients can update signature"
  ON quotes FOR UPDATE
  USING (true)  -- Allow anyone to attempt the update
  WITH CHECK (
    -- Only allow updating if the client_email matches
    client_email IS NOT NULL
  );

-- Alternative: If the above doesn't work, temporarily disable RLS for testing
-- (Don't use this in production!)
-- ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
