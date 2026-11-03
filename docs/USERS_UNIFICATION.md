# Unification de la source de vérité `users` — Kôji

## État actuel (fragmenté)

| Store | Contenu | Consommateurs |
|---|---|---|
| Supabase `users` (table) | Auth + is_pro, is_profile_complete, is_business_info_complete, logo_url, business_info (JSONB) | Mobile (direct), web (via service role) |
| `koji_web_state.users` (blob) | Collection users legacy (entreprise) | Web (via lib/db.js) |
| `particulier_users_state` (blob) | Comptes particuliers (Koji client) | Web (via lib/particulier-users.js) |

Réconciliation actuelle : `lib/account-identity.js` + `lib/particulier-users.js` fusionnent/séparent en coulisses.

## Objectif

Faire de la table Supabase `users` la **seule source de vérité** pour tous les
comptes (entreprise + particulier + admin), avec des colonnes typées pour les
champs les plus utilisés.

## Plan (par étapes, sans casser l'existant)

### Étape 1 — Colonnes typées (migration SQL)
Ajouter à `users` les colonnes manquantes :
- `account_type` (text) — 'entreprise' | 'particulier'
- `full_name` (text)
- `company_name` (text)
- `is_admin` (boolean) — déjà fait (migration 0004)
- `portal_identifier` (text) — pour les particuliers
- `is_active` (boolean) — activation email

Les champs complexes (business_info, personal_info, professions, billing, etc.)
restent dans `business_info` JSONB (déjà le cas).

### Étape 2 — Adapter `lib/user-store.js`
Créé. Fournit `getUserFromSupabase`, `getUserByEmailFromSupabase`,
`getAllUsersFromSupabase`, `upsertUserToSupabase` avec fallback.

### Étape 3 — Migrer les lecteurs
Remplacer progressivement :
- `lib/particulier-users.js` → utiliser `user-store.js` (lire/écrire dans
  `users` avec `account_type = 'particulier'`).
- `lib/db.js` → ne plus stocker `users` dans le blob ; lire depuis
  `user-store.js`.
- Routes qui lisent `db.users` → utiliser `user-store.js`.

### Étape 4 — Migrer les écritures
- `app/api/auth/signup` → écrire dans `users` (déjà le cas pour entreprise).
- `app/api/auth/particulier-signup` → écrire dans `users` (au lieu du blob).
- `app/api/auth/particulier-login` → lire depuis `users`.

### Étape 5 — Nettoyage
- Supprimer `particulier_users_state` (table) après migration.
- Retirer `users` du blob `koji_web_state`.
- Supprimer `lib/particulier-users.js`.

## Risques
- Régression sur l'authentification (entreprise + particulier + worker).
- Perte de données si la migration est mal exécutée.
- Nécessite des tests d'intégration complets.

## Effort estimé
Plusieurs sessions de développement. À faire par étapes avec des PRs atomiques.
