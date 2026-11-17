-- 0013 — Sécuriser la variante historique de signature par RPC (17 novembre 2026)
--
-- Certains environnements ont encore la fonction à 3 paramètres
-- submit_quote_signature(uuid, text, text). Elle ne doit jamais être exécutée
-- sans vérifier l'e-mail du client ni écraser une signature existante.

CREATE OR REPLACE FUNCTION submit_quote_signature(
  p_quote_id uuid,
  p_email text,
  p_signature_data text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  UPDATE quotes
  SET signature_data = p_signature_data,
      signed_at = NOW(),
      status = 'accepte'
  WHERE id = p_quote_id
    AND signed_at IS NULL
    AND (
      COALESCE(
        NULLIF(TRIM(client_email), ''),
        NULLIF(TRIM(metadata->'client'->>'email'), '')
      ) IS NULL
      OR LOWER(TRIM(client_email)) = LOWER(TRIM(COALESCE(p_email, '')))
      OR LOWER(TRIM(metadata->'client'->>'email')) = LOWER(TRIM(COALESCE(p_email, '')))
    );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION submit_quote_signature(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated, service_role;
