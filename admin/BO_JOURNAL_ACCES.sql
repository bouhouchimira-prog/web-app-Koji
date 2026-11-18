-- Journal des accès du back-office (maquettes PRO-24.7, 24.12, 24.15) :
-- qui a ouvert quoi, quand et pourquoi (lecture d'un fil signalé, d'un
-- devis, export des données d'un particulier). À exécuter une fois dans
-- l'éditeur SQL de Supabase. Tant que la table n'existe pas, le
-- back-office fonctionne mais n'écrit rien dans le journal.
create table if not exists public.bo_journal_acces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  cible_type text not null,
  cible_id text not null,
  motif text not null default ''
);

create index if not exists bo_journal_acces_created_at_idx on public.bo_journal_acces (created_at desc);

-- Lecture et écriture réservées à la clé service (le back-office) : aucune
-- politique pour les rôles anon et authenticated.
alter table public.bo_journal_acces enable row level security;
