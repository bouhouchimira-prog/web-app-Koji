# Synchronisation Web ↔ Mobile — Kôji

## Sources de vérité

| Donnée | Source de vérité | Consommateurs |
|---|---|---|
| Compte utilisateur (id, email, is_pro, is_profile_complete, is_business_info_complete, logo_url, business_info) | Table Supabase `users` | Web (via Supabase Auth + service role), Mobile (Supabase Flutter SDK direct) |
| État métier web (projects, quotes, invoices, clients, contacts, workers, tasks, interventions, supplies, suppliers, notifications, expenses, categories, chantierOffres, history, …) | Table Supabase `koji_web_state` (JSONB, 1 ligne) | Web (via lib/db.js, service role) |
| Comptes particuliers (Koji client) | Table Supabase `particulier_users_state` (JSONB) | Web (via lib/particulier-users.js) |
| Offres Radar en cours de collecte | Table Supabase `radar_offer_drafts` (JSONB) | Web (via lib/radar-offer-draft.js) |
| Devis marketplace / expertise | Table Supabase `quotes` | Web + Mobile |
| Conversations IA | Table Supabase `ai_conversations` | Web + koji-admin |
| Fournisseurs / fournitures / produits | Tables Supabase `fournisseurs`, `fournitures`, `products` | Web + koji-admin |

## Flux de synchronisation

1. **Web (entreprise)** : lit/écrit `koji_web_state` via service role (lib/db.js). L'identité utilisateur vient de Supabase Auth (JWT). `lib/account-identity.js` et `lib/particulier-users.js` réconcilient la table `users` avec le blob.
2. **Mobile (Koji Pro / entreprise)** : lit `users` directement via Supabase Flutter SDK (is_pro, is_profile_complete, …). Lit/écrit le blob web_state via `KojiWebApiClient` (HTTP, cookie `koji_portal_session`) pour les données métier (clients, contacts, chantiers, …).
3. **Mobile (Koji client / particulier)** : utilise `KojiWebApiClient` pour tout (portail client), cohérent avec le web.
4. **Mapping compte** : `KojiAccount.from()` (mobile, `mobile/lib/app/account_provider.dart`) est aligné sur `buildWebUser()` (web, `lib/user-profile.js`). Tests : `mobile/test/koji_account_test.dart`.

## Points de vigilance

- **Double écriture** : une mutation doit mettre à jour à la fois la table `users` et le blob `koji_web_state` (collection `users`). Vérifier `lib/account-identity.js` à chaque ajout de champ.
- **Concurrence** : le blob est réécrit en entier à chaque mutation → pas de verrouillage optimiste. Risque de perte de données en écritures concurrentes (web + mobile).
- **Offline mobile** : le module `features/synchronization/` doit gérer les conflits de reprise.
- **Billing** : deux systèmes (Stripe web, in_app_purchase mobile) → à unifier (voir docs/BILLING_DECISION.md).

## Checklist avant d'ajouter un champ utilisateur

- [ ] Ajouter le champ dans la table `users` (migration SQL).
- [ ] Ajouter le champ dans `buildWebUser()` (web).
- [ ] Ajouter le champ dans `KojiAccount` (mobile) + mapping dans `from()`.
- [ ] Ajouter un test dans `koji_account_test.dart`.
- [ ] Mettre à jour `docs/WEB_MOBILE_SYNC.md` (mobile) et ce fichier.
