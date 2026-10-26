-- Drop existing function first because we are changing the return type to json
DROP FUNCTION IF EXISTS get_quote_for_client(uuid, text);

-- Create or replace RPC function to get quote with rooms and tasks, bypassing RLS
CREATE OR REPLACE FUNCTION get_quote_for_client(p_quote_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote json;
  v_rooms json;
BEGIN
  -- Strict-when-email-exists authorization:
  --   * If the quote has a client email on file, the visitor MUST supply a
  --     matching email — a wrong or empty email is rejected.
  --   * If the quote has NO email on file (e.g. links sent before the chantier
  --     email feature), the unguessable quote UUID alone authorizes access.
  IF NOT EXISTS (
    SELECT 1 FROM quotes
    WHERE id = p_quote_id
      AND (
        -- No email on file -> UUID alone authorizes (old links keep working).
        COALESCE(
          NULLIF(TRIM(client_email), ''),
          NULLIF(TRIM(metadata->'client'->>'email'), '')
        ) IS NULL
        OR
        -- Email on file -> the visitor's email must match it.
        LOWER(TRIM(client_email)) = LOWER(TRIM(COALESCE(p_email, ''))) OR
        LOWER(TRIM(metadata->'client'->>'email')) = LOWER(TRIM(COALESCE(p_email, '')))
      )
  ) THEN
    RETURN NULL;
  END IF;

  -- Build rooms array with tasks
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', r.id,
      'name', r.name,
      'quote_tasks', (
        SELECT COALESCE(json_agg(t), '[]'::json)
        FROM quote_tasks t
        WHERE t.room_id = r.id
      )
    )
  ), '[]'::json)
  INTO v_rooms
  FROM quote_rooms r
  WHERE r.quote_id = p_quote_id;

  -- Return quote object with quote_rooms included
  SELECT json_build_object(
    'id', q.id,
    'status', q.status,
    'created_at', q.created_at,
    'metadata', q.metadata,
    'total_ht', q.total_ht,
    'total_ttc', q.total_ttc,
    'tva_rate', q.tva_rate,
    'total', q.total_ttc, -- Fallback
    'client_name', q.metadata->'client'->>'name',
    'client_email', q.metadata->'client'->>'email',
    'signature_data', q.signature_data,
    'signed_at', q.signed_at,
    'quote_rooms', v_rooms
  )
  INTO v_quote
  FROM quotes q
  WHERE q.id = p_quote_id;

  RETURN v_quote;
END;
$$;

-- Create or replace RPC function to submit signature
CREATE OR REPLACE FUNCTION submit_quote_signature(
  p_quote_id uuid, 
  p_email text, 
  p_signature_data text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  -- Strict-when-email-exists (same rule as get_quote_for_client):
  --   * Quote has an email on file -> p_email must match it.
  --   * Quote has no email on file -> the unguessable UUID alone authorizes.
  UPDATE quotes
  SET
    signature_data = p_signature_data,
    signed_at = NOW(),
    status = 'accepte'
  WHERE id = p_quote_id
    AND (
      COALESCE(
        NULLIF(TRIM(client_email), ''),
        NULLIF(TRIM(metadata->'client'->>'email'), '')
      ) IS NULL
      OR
      LOWER(TRIM(client_email)) = LOWER(TRIM(COALESCE(p_email, ''))) OR
      LOWER(TRIM(metadata->'client'->>'email')) = LOWER(TRIM(COALESCE(p_email, '')))
    );
  
  -- Get the number of rows updated
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  -- Return true if at least one row was updated
  RETURN v_rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_for_client(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated;
