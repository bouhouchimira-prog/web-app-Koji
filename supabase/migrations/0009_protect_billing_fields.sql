-- 0009 — Protéger les champs d'abonnement (9 novembre 2026)
--
-- Constat (testé en production avec le compte de test contact@getkoji.io,
-- remis en l'état ensuite) : un utilisateur connecté pouvait
--   1. écrire lui-même business_info._billingPlan = "business" sur sa ligne
--      de public.users (le site le traitait alors comme abonné, sans payer) ;
--   2. appeler la fonction set_subscription_status pour se déclarer « actif ».
--
-- Après ce script, seuls le serveur (clé service_role : webhook Stripe,
-- routes API) et l'éditeur SQL peuvent modifier ces champs. Les autres
-- modifications du profil par l'utilisateur continuent de fonctionner : les
-- champs protégés gardent simplement leur ancienne valeur.
--
-- À exécuter dans Supabase → SQL Editor, APRÈS le déploiement du commit qui
-- fait écrire _stripeCustomerId par le compte serveur (route
-- app/api/billing/checkout).

-- 1) set_subscription_status n'est plus appelable par les utilisateurs.
--    (Plus utilisée par l'app depuis le retrait des achats intégrés.)
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_subscription_status'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 2) Champs d'abonnement en lecture seule pour les utilisateurs.
create or replace function public.protect_billing_fields()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  k text;
  protected_keys text[] := array[
    '_billingPlan', '_billingStatus', '_billingInterval',
    '_stripeCustomerId', '_grandfathered', '_addonWebsite', '_addonPremium'
  ];
begin
  -- Serveur (service_role) ou éditeur SQL / migrations : rien n'est filtré.
  if jwt_role = 'service_role' or (jwt_role = '' and current_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.subscription_status     := old.subscription_status;
    new.subscription_platform   := old.subscription_platform;
    new.subscription_product    := old.subscription_product;
    new.subscription_expires_at := old.subscription_expires_at;
    new.trial_started_at        := old.trial_started_at;
    new.trial_ends_at           := old.trial_ends_at;
    if new.business_info is not null or old.business_info is not null then
      foreach k in array protected_keys loop
        if old.business_info is not null and old.business_info ? k then
          new.business_info := jsonb_set(coalesce(new.business_info, '{}'::jsonb), array[k], old.business_info -> k);
        elsif new.business_info is not null then
          new.business_info := new.business_info - k;
        end if;
      end loop;
    end if;
  else -- INSERT : un nouveau compte ne peut pas arriver déjà « abonné »
    new.subscription_status     := null;
    new.subscription_platform   := null;
    new.subscription_product    := null;
    new.subscription_expires_at := null;
    if new.business_info is not null then
      foreach k in array protected_keys loop
        new.business_info := new.business_info - k;
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_billing_fields on public.users;
create trigger protect_billing_fields
  before insert or update on public.users
  for each row execute function public.protect_billing_fields();
