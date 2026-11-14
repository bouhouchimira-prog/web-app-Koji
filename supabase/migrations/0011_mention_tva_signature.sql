-- 0011 — Mention TVA certifiée à la signature (maquette PRO-03.5, 14 novembre 2026)
--
-- Pour la TVA à taux réduit (10 % ou 5,5 %), le client certifie sur le devis
-- que les locaux sont des logements achevés depuis plus de deux ans. Sur
-- koji-signature (devis faits dans l'app Koji Pro), la signature passe par
-- la fonction submit_quote_signature : cette variante à 4 paramètres
-- enregistre en plus la mention certifiée dans web_extras (mentionTva,
-- mentionTvaLe), lue par le site et l'app (suivi du devis, PDF).
--
-- La fonction à 3 paramètres existante n'est pas modifiée ; koji-signature
-- n'appelle la nouvelle que si le client a coché la mention, et revient à
-- l'ancienne si ce script n'a pas encore été exécuté.

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
  WHERE id = p_quote_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text, boolean) TO anon, authenticated;
