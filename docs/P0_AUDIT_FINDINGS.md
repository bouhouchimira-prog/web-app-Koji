# Audit P0 — Sécurité & données (novembre 2026)

## 1. IDOR / scoping des routes JSON-store

Méthode : toutes les routes `app/api/**/route.js` utilisant `readDb()` ont été
parcourues pour vérifier la présence d'une authentification serveur
(`getVerifiedUserId`, `resolveUserId`, `getUserScope`, `getAuth`,
`getVerifiedPortalUserId`, `resolveEntreprise`, `resolveAnySession`).

Résultat : **aucune route `readDb` sans contrôle d'identité serveur**. Les 7
routes initialement suspectes par un grep naïf utilisent en réalité :
- `account/deletion-request`, `support/report` → `resolveAnySession`
- `auth/particulier-signup` → endpoint public d'inscription (CORS restreint
  à la landing)
- `auth/set-password` → jeton de récupération Supabase
- `marketplace/offres` → `resolveEntreprise`
- `marketplace/offres/[id]/paiement/[step]` → `resolveEntreprise`
- `site/[slug]/lead` → endpoint public rate-limité

Conclusion : pas d'IDOR évident sur le stockage JSON. À maintenir lors de
l'ajout de nouvelles routes (checklist dans SECURITY.md).

## 2. Gating admin

- `app/api/admin/algo-stats` et `app/api/admin/conversations` : vérification
  serveur via `isVerifiedUserAdmin` (email allowlist) → OK.
- `koji-admin` (Next.js) : `dashboard/layout.tsx` vérifie
  `user.email === 'ablexpertrenov@gmail.com'` côté serveur + `signOut` si
  non autorisé → OK, mais admin unique et email codé en dur (single point of
  failure ; à migrer vers un flag `is_admin` en base à terme).

## 3. RLS (users / quotes)

Problème détecté : `ADMIN_ACCESS_ALL_DATA.sql` ouvrait `users`/`quotes` à
TOUS les comptes authentifiés (`auth.role() = 'authenticated'`), puis
`RESTRICT_ACCESS_TO_ADMIN.sql` les restreignait à un seul email. Les deux
sont inadaptés à une app multi-utilisateur (soit trop ouvert, soit casse
l'accès des utilisateurs normaux et du mobile).

Correctif fourni : `admin/RLS_FIX_USERS_QUOTES.sql` — chaque utilisateur lit
et modifie sa propre ligne (`auth.uid() = id` / `user_id = auth.uid()`),
l'admin lit/modifie tout. À appliquer dans le SQL Editor après vérification
de l'état actuel (`SELECT ... FROM pg_policies`).

## 4. Secrets

- `.env.local` n'a jamais été commité (git log vide) → pas de fuite dans
  l'historique.
- Rotation préventive documentée dans SECURITY.md (checklist).
- Clés live présentes dans `.env.local` (Stripe, service_role, Anthropic,
  SMTP) → à rotater si exposition suspectée.

## 5. Actions restantes (manuelles, hors dépôt)

- Appliquer `admin/RLS_FIX_USERS_QUOTES.sql` dans le SQL Editor Supabase.
- Auditer les buckets Storage (`admin/supabase_storage_setup.sql`).
- Vérifier les policies RLS sur `ai_conversations` (note précédente).
- Migrer l'admin unique vers un flag `is_admin` en base.
