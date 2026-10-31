# Synchro Web / Mobile Kôji

Ce document résume comment le Web (Next.js) et le Mobile (Flutter) restent cohérents entre eux.

## 1) Backend partagé

- **Supabase** : Web et Mobile utilisent le même projet Supabase (`NEXT_PUBLIC_SUPABASE_URL` / `--dart-define=SUPABASE_URL`).
- **Authentification** : Les comptes entreprise/particulier créés passent par Supabase Auth. Le trigger `handle_new_user` crée la ligne dans `users`.
- **Données** : La majorité des données métiers est dans les tables Supabase partagées avec application des RLS.
- **Service role** : Uniquement côté serveur Web (`lib/supabase.js` via `SUPABASE_SERVICE_ROLE_KEY`). **Jamais** exposé au client/mobile.

## 2) 3 espaces distincts

| Espace | Web | Mobile | Rôle |
|---|---|---|---|
| **Particulier / Client** | `app/marketplace/`, `app/chantiers/`, etc. | `mobile/lib/apps/client/` (`main_client.dart`) | Demande de travaux, réception de devis, suivi |
| **Entreprise / Artisan** | `app/entreprise/`, `app/devis/`, `app/equipe/`, `app/facturation/` | `mobile/lib/apps/entreprise/` (`main_entreprise.dart`) | Gestion chantiers, devis, équipe, facturation |
| **Ouvrier** | `app/worker/` + app dédiée `worker/` (`ouvrier.kojibuild.com`) | `mobile/lib/features/worker/` | Accès restreint aux tâches qui lui sont assignées |

## 3) Approche hybride côté Mobile

Le mobile combine deux approches :

- **Accès direct Supabase** : Auth, lecture/écriture sur tables avec RLS (`supabase_flutter`)
- **Koji Web API** : Pour certaines fonctionnalités (notamment marketplace particulier), le mobile passe par `KojiWebApiClient` vers `https://www.kojibuild.com/api/*` avec le cookie `koji_portal_session`

Fichier clé : `mobile/lib/app/koji_web_api_client.dart`

## 4) Mapping du compte utilisateur

### Web
`lib/user-profile.js` -> `buildWebUser()`
- Lit `users` + `business_info` (structuré avec clés `_*` pour données web-only)
- Calcule `accountType`, `isPro`, `plan`, `trial*`, `billing*`, `profileComplete`, etc.

### Mobile
`mobile/lib/app/account_provider.dart` -> `KojiAccount`
- Aligné sur le mapping web depuis le commit `feat(mobile): aligner KojiAccount sur le mapping web`
- Expose désormais : `accountType`, `isPro`, `isAdmin`, `plan`, `trialStartedAt`, `trialQuoteId`, `trialSaveCount`, `billingInterval`, `billingStatus`, `hasBillingAccount`, `profileComplete`, `businessInfoComplete`, `personalInfoComplete`, `logoUrl`, `businessInfo`, `personalInfo`, `professions`, `addonWebsite`, `premiumTools`
- Rétro-compatible avec les usages existants

## 5) Abonnements

- **Web** : Stripe (abonnements + Stripe Connect)
- **Mobile** : `in_app_purchase` (App Store / Google Play) via `mobile/lib/features/subscription/`
- Les 3 paliers sont alignés sur le web (`go` / `premium` / `business`) avec mêmes limites de devis

## 6) Règles à garder

- **Un seul projet Supabase** pour auth + données partagées
- **`KojiAccount`** doit rester aligné avec `buildWebUser()` si de nouveaux champs apparaissent côté web
- **Ne pas exposer** `SUPABASE_SERVICE_ROLE_KEY` côté client/mobile
- **Respecter RLS** : privilégier l'accès direct sous identité utilisateur quand c'est possible
- **Cohérence des rôles** : `entreprise` / `particulier` / `worker` doivent rester distincts entre les 3 espaces
