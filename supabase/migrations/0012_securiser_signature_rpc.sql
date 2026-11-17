-- 0012 — Sécuriser les signatures publiques par RPC (17 novembre 2026)
--
-- 0011 acceptait p_email sans jamais l'utiliser : un appelant anonyme qui
-- connaissait l'UUID d'un devis pouvait le signer. Les deux variantes exigent
-- désormais l'e-mail du client lorsqu'il est renseigné et refusent d'écraser
-- une signature existante. Les parcours client historiques restent compatibles.
--
-- À exécuter dans Supabase → SQL Editor après revue. Aucune donnée n'est modifiée.

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

CREATE OR REPLACE FUNCTION submit_quote_signature(
  p_quote_id uuid,
  p_email text,
  p_signature_data text,
  p_mention_tva boolean
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
      status = 'accepte',
      web_extras = CASE
        WHEN p_mention_tva THEN
          COALESCE(web_extras, '{}'::jsonb)
            || jsonb_build_object('mentionTva', true, 'mentionTvaLe', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
        ELSE web_extras
      END
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
REVOKE ALL ON FUNCTION submit_quote_signature(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text, boolean) TO anon, authenticated, service_role;
