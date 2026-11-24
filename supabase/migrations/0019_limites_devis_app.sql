-- 0019 — Fonctions de limite de devis appelées par l'app Koji Pro (24 novembre 2026)
--
-- Constat (retours du build 64) : avant chaque enregistrement d'un devis,
-- l'app Koji Pro appelle public.check_quote_creation_limit (nouveau devis) ou
-- public.check_and_record_trial_edit (devis déjà enregistré). Aucune des deux
-- n'existe dans la base : l'appel échoue (« Could not find the function
-- public.check_quote_creation_limit(p_user_id) »), donc aucun devis ne
-- s'enregistre ni ne part depuis l'app.
--
-- Ce script crée les deux fonctions. Elles répondent toujours « autorisé » :
-- les limites de l'offre d'essai restent appliquées par le serveur du site
-- (envoi du devis, PDF), l'app n'ajoute pas de plafond de son côté pour
-- l'instant (décision à confirmer, voir le lot 0 des retours du build 64).
--
-- Elles ne lisent ni n'écrivent aucune table : les paramètres ne servent qu'à
-- correspondre à l'appel de l'app. Peut être exécuté plusieurs fois.
-- À exécuter dans Supabase → SQL Editor. Effet immédiat sur le build 64,
-- sans nouvelle version de l'app.

create or replace function public.check_quote_creation_limit(p_user_id text)
returns table (allowed boolean, reason text)
language sql
stable
as $$
  select true, null::text;
$$;

create or replace function public.check_and_record_trial_edit(p_user_id text, p_quote_id text)
returns table (allowed boolean, reason text)
language sql
stable
as $$
  select true, null::text;
$$;

-- Appelables par un utilisateur connecté seulement (comme l'app le fait).
revoke execute on function public.check_quote_creation_limit(text) from public, anon;
revoke execute on function public.check_and_record_trial_edit(text, text) from public, anon;
grant execute on function public.check_quote_creation_limit(text) to authenticated, service_role;
grant execute on function public.check_and_record_trial_edit(text, text) to authenticated, service_role;

-- L'API de Supabase relit la liste des fonctions tout de suite.
notify pgrst, 'reload schema';
