# Sécurité — Kôji

Ce document décrit la posture de sécurité actuelle et les règles à respecter
pour toute modification.

## Secrets

- Les secrets vivent **uniquement** dans `.env.local` (jamais commité — voir
  `.gitignore` : `.env`, `.env.local`, `.env*`).
- Clés présentes : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`,
  `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `SMTP_*`, `VERCEL_OIDC_TOKEN`.
- **Règle** : ne jamais exposer une clé `SUPABASE_SERVICE_ROLE_KEY`,
  `STRIPE_SECRET_KEY` ou `ANTHROPIC_API_KEY` côté client (pas de préfixe
  `NEXT_PUBLIC_`). Ne jamais la logger.
- **Rotation** : prévoir une rotation si un secret a pu être exposé (historique
  git, logs, partage). Vérifier `git log --all -p -S "service_role"`.

## Authentification & sessions

- Supabase Auth (email/password + Google OAuth) pour les comptes entreprise et
  particulier ; cookies HttpOnly (`koji_session`, `koji_refresh`,
  `koji_portal_session`, `koji_worker_session`) — voir `lib/session-cookies.js`.
- Les tokens ne sont plus stockés en `localStorage` (protection XSS).
- Les routes serveur valident l'identité via `getVerifiedUserId` /
  `getAuth` (`lib/server-auth.js`), qui vérifie le JWT contre Supabase Auth.

## Isolation des données

- Le stockage web (`koji_web_state`, `particulier_users_state`,
  `radar_offer_drafts`) est **service-role only** : RLS activé, `REVOKE ALL`
  pour `anon`/`authenticated` (voir `supabase_web_setup.sql`).
- Les routes JSON-store doivent toujours utiliser `getVerifiedUserId` /
  `resolveUserId` et scoper via `scopedItems` — ne jamais faire confiance à un
  `userId` envoyé par le client.
- Les tables natives Supabase (`users`, `quotes`, …) reposent sur RLS :
  auditer les policies avant tout changement de schéma.

## Service role

- `getSupabaseAdmin()` (`lib/supabase.js`) contourne la RLS par conception.
  Réservé aux routes serveur qui en ont besoin (signature par lien, portail
  client, admin). Ne jamais l'importer dans du code client.

## Rotation des secrets (checklist)

1. Vérifier l'historique git : `git log --all -p -S "service_role"` et
   `git log --all --full-history -- .env.local` (doit être vide).
2. Révoquer/regénérer dans les dashboards : Supabase service_role, Stripe
   secret key, Anthropic API key, Google OAuth secret, SMTP password.
3. Mettre à jour `.env.local` (non commité) et les secrets GitHub Actions
   (Settings → Secrets) pour CI mobile.
4. Vérifier que `.env.local` reste gitignored et absent du remote.
5. Documenter la date de rotation dans ce fichier.

## Signalement

- Toute faille potentielle doit être signalée avant correction, avec son
  emplacement et son niveau de priorité, pour éviter les régressions.
