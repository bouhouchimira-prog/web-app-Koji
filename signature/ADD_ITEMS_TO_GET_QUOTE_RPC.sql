-- ============================================
-- CORRECTIF : items manquants + expiration 48h apres signature (26 octobre)
-- A executer dans l'editeur SQL Supabase.
-- ============================================
--
-- 1. Les vrais devis stockent leurs lignes dans `quotes.items` (JSONB plat,
--    non vide sur 120/132 devis reels), pas dans `quote_rooms`/`quote_tasks`
--    (tables separees, jamais alimentees en pratique par le generateur de
--    devis reel). La fonction renvoyait deja un fallback cote client pour
--    `items` quand il est present (voir store/clientStore.ts), mais la
--    fonction SQL elle-meme ne le selectionnait jamais dans le JSON
--    retourne — donc ce fallback ne se declenchait jamais.
--
-- 2. Securite (demande d'Amira) : un devis deja signe depuis plus de 48h
--    n'est plus accessible par son lien — empeche de rouvrir/re-signer un
--    devis ancien indefiniment avec le meme lien.

CREATE OR REPLACE FUNCTION get_quote_for_client(p_quote_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote json;
  v_rooms json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM quotes
    WHERE id = p_quote_id
      AND (
        COALESCE(
          NULLIF(TRIM(client_email), ''),
          NULLIF(TRIM(metadata->'client'->>'email'), '')
        ) IS NULL
        OR
        LOWER(TRIM(client_email)) = LOWER(TRIM(COALESCE(p_email, ''))) OR
        LOWER(TRIM(metadata->'client'->>'email')) = LOWER(TRIM(COALESCE(p_email, '')))
      )
      -- Lien invalide 48h apres la signature.
      AND (signed_at IS NULL OR signed_at > NOW() - INTERVAL '48 hours')
  ) THEN
    RETURN NULL;
  END IF;

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

  SELECT json_build_object(
    'id', q.id,
    'status', q.status,
    'created_at', q.created_at,
    'metadata', q.metadata,
    'total_ht', q.total_ht,
    'total_ttc', q.total_ttc,
    'tva_rate', q.tva_rate,
    'total', q.total_ttc,
    'client_name', q.metadata->'client'->>'name',
    'client_email', q.metadata->'client'->>'email',
    'signature_data', q.signature_data,
    'signed_at', q.signed_at,
    'quote_rooms', v_rooms,
    'items', q.items  -- AJOUT (26 oct) : seule ligne changee vs la version precedente.
  )
  INTO v_quote
  FROM quotes q
  WHERE q.id = p_quote_id;

  RETURN v_quote;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quote_for_client(uuid, text) TO anon, authenticated;

-- Meme regle des 48h sur la signature elle-meme : un devis deja signe depuis
-- plus de 48h ne peut plus etre re-signe avec le meme lien. Reprend la
-- version la plus a jour de cette fonction (update_rpc_functions.sql, deja
-- en place), avec cette seule regle en plus.
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
    )
    AND (signed_at IS NULL OR signed_at > NOW() - INTERVAL '48 hours');

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated;
