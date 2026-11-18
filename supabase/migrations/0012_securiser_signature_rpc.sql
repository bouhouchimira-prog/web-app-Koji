-- 0012 — Ne plus écraser une signature existante par RPC (17 novembre 2026)
--
-- submit_quote_signature (variantes à 3 et à 4 paramètres) réécrivait la
-- signature d'un devis déjà signé : un second appel remplaçait l'image et la
-- date de la première signature. Les deux variantes refusent désormais un
-- devis déjà signé (signed_at renseigné) et renvoient false, comme le fait
-- déjà la signature sur place du site (app/api/quotes/signer-app).
--
-- p_email reste accepté mais n'est PAS exigé, et c'est voulu :
--   * l'autorisation est l'accès par identifiant + mot de passe du chantier
--     (login_with_access_code, voir ../../signature/chantier_access_login.sql),
--     qui a remplacé le contrôle par e-mail ;
--   * les versions de l'app Koji déjà publiées envoient p_email = '' : exiger
--     l'e-mail refuserait leur signature pour tout devis qui en porte un ;
--   * get_quote_for_client renvoie l'e-mail du client à qui connaît
--     l'identifiant du devis : le redemander ici ne protégerait de rien.
-- Un contrôle plus fort (jeton de session lié au devis, comme sur le site)
-- demandera une migration à part, après la publication des apps qui l'envoient.
--
-- Sans risque pour les parcours actuels : aucun n'appelle cette fonction sur
-- un devis déjà signé (l'app et koji-signature masquent le bouton).
-- À exécuter dans Supabase → SQL Editor. Aucune donnée n'est modifiée.

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
    AND signed_at IS NULL;

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
    AND signed_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION submit_quote_signature(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_quote_signature(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_quote_signature(uuid, text, text, boolean) TO anon, authenticated, service_role;
