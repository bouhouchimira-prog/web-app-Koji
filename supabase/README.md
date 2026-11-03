# Supabase — Kôji

Projet partagé : `https://hbgqbpyufaajqmedxodg.supabase.co`

## Fichiers SQL à exécuter (dans l'ordre)

1. `../supabase_web_setup.sql` — tables web_state (koji_web_state,
   particulier_users_state, radar_offer_drafts) + RLS deny-all.
2. `../admin/supabase_complete_setup.sql` — schéma admin (users, quotes,
   fournisseurs, fournitures, pricing, products, …).
3. `../admin/supabase_storage_setup.sql` — buckets Storage + policies.
4. `../admin/supabase_planning_setup.sql`, `supabase_fournitures_setup.sql`,
   `supabase_products_migration.sql` — modules.
5. `../signature/*.sql` — fonctions RPC de signature (create_signature_function,
   update_rpc_functions, fix_signature_policy, chantier_access_login, …).
6. `../admin/ADMIN_ACCESS_ALL_DATA.sql`, `RESTRICT_ACCESS_TO_ADMIN.sql` —
   politiques d'accès admin (à appliquer selon l'environnement).

## Règles

- Toujours exécuter dans le SQL Editor du projet partagé, jamais en prod sans
  sauvegarde.
- Versionner toute nouvelle migration dans `supabase/migrations/` avec un
  préfixe numérique (`0001_…sql`). Voir `supabase/migrations/README.md`.
- Ne jamais modifier une migration déjà appliquée en prod : créer une nouvelle.
- RLS doit rester activé sur toutes les tables exposées à `anon`.
