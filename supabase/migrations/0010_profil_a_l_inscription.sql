-- 0010 — Profil créé à l'inscription (12 novembre 2026)
--
-- Constat (production, 12 nov) : une inscription par e-mail, depuis le site
-- ou depuis l'app, crée le compte Supabase Auth mais AUCUNE ligne dans
-- public.users. Le trigger handle_new_user n'existe plus : le script
-- admin/SOLVE_EMAIL_ISSUES.sql a réutilisé le nom on_auth_user_created pour
-- une autre fonction (auto_confirm_user), ce qui a remplacé le trigger qui
-- créait le profil. 5 comptes sur 24 n'avaient pas de profil, dont celui
-- d'un testeur (« Mot de passe oublié » ne lui envoyait rien).
--
-- Ce script :
--   1. recrée la fonction qui crée le profil, sous un nom de trigger à elle
--      (on_auth_user_created_profile), pour ne plus entrer en conflit avec
--      on_auth_user_created, laissé tel quel ;
--   2. crée le profil des comptes existants qui n'en ont pas.
-- Il ne modifie aucune ligne existante. On peut le relancer sans risque.
--
-- À exécuter dans Supabase → SQL Editor.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, is_pro, full_name, email_verified, created_at)
  values (
    new.id,
    lower(new.email),
    -- is_pro envoyé par l'app et le site ; sans indication (Google sur le
    -- site), compte Koji Pro, comme le fait le site.
    case lower(coalesce(new.raw_user_meta_data ->> 'is_pro', ''))
      when 'false' then false
      else true
    end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    true,
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Comptes existants sans profil.
insert into public.users (id, email, is_pro, full_name, email_verified, created_at)
select
  u.id,
  lower(u.email),
  case lower(coalesce(u.raw_user_meta_data ->> 'is_pro', ''))
    when 'false' then false
    else true
  end,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
  true,
  coalesce(u.created_at, now())
from auth.users u
where u.email is not null
  and not exists (select 1 from public.users p where p.id = u.id)
on conflict (id) do nothing;

-- Vérification : doit renvoyer 0.
select count(*) as comptes_sans_profil
from auth.users u
where not exists (select 1 from public.users p where p.id = u.id);
