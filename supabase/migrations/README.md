# Migrations Supabase — Kôji

Chaque fichier ici est une migration numérotée à exécuter dans l'ordre dans
le SQL Editor Supabase. Règle : ne jamais modifier une migration déjà
appliquée en prod ; créer une nouvelle avec le prochain numéro.

| Fichier | Contenu |
|---|---|
| 0001_web_state.sql | Tables web_state (koji_web_state, particulier_users_state, radar_offer_drafts) + RLS deny-all (copie de ../supabase_web_setup.sql) |
| (à venir) 0002_rls_users_quotes.sql | Correctif RLS users/quotes (voir ../admin/RLS_FIX_USERS_QUOTES.sql) |
| (à venir) 0003_subscriptions.sql | Table subscriptions unifiée (billing) |

Les fichiers SQL historiques restent dans `../admin/` et `../signature/` pour
référence ; les nouvelles migrations doivent être créées ici.
