-- Create RPC function to allow clients to sign quotes
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION submit_quote_signature(
  p_quote_id uuid, 
  p_email text, 
  p_signature_data text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- This runs with elevated privileges to bypass RLS
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  -- Update the quote if the email matches
  UPDATE quotes
  SET 
    signature_data = p_signature_data,
    signed_at = NOW(),
    status = 'accepte'
  WHERE id = p_quote_id 
    AND LOWER(TRIM(client_email)) = LOWER(TRIM(p_email));
  
  -- Get the number of rows updated
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  -- Return true if at least one row was updated
  RETURN v_rows_updated > 0;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated;
