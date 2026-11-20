# Analyse complète — monorepo Kôji (mise à jour)

Date : 20 novembre 2026. Branche courante : `fix/p0-6-storage-canonical`.

## 1. État actuel (ce qui est fait)

- **Sécurité P0** : P0-1 à P0-5 mergés (PR #51-#55). Migration `0013_rls_canonical.sql` en place (RLS users/quotes/fournisseurs/fournitures + trigger `protect_sensitive_user_fields`). P0-6 livré en code (0015 + 0016) et appliqué/vérifié sur la base principale.
- **Storage** : buckets Kôji durcis (owner-scoped ou public read + owner write). Policies permissives héritées supprimées. Vérification A/B conforme.
- **Tests** : 518 tests web (mocha) verts, 340 tests mobile (flutter) verts, `flutter analyze` = 0.
- **Fonctionnalités** : Urgences (dédié), Mon parcours v2, Koji Client (CLI-01…07), paiement Stripe Connect, Sentry branché (conditionnel), cache hors ligne testé, push FCM fondations.
- **Observabilité** : logger structuré avec redaction, Sentry conditionnel web + mobile, instrumentation Next 16.
- **Offline-first (mobile)** : `OfflineCacheService` (Hive), `OfflineQueue`, `SyncWorker` (replay, retry, LWW). Intégré dans Quote/Client/Chantier/Fourniture repos.
- **Push** : endpoints `/api/push/register` + `/api/push/send`, table `device_tokens`, FCM côté mobile.
- **Catalogue ouvrages** : migration `koji_ouvrages`, script `migrate-koji-ouvrages.mjs`, lecture mobile via `PricingRepository`.
- **Migration ouvriers** : script `migrate-workers.mjs` (dry-run/apply, re-hashage scrypt).
- **Billing** : webhook Stripe upsert dans `subscriptions` + `business_info`. Adapter `subscription-store.js` présent.
- **Monorepo** : workspaces racine `packages/*` + `signature`, `packages/koji-shared` squelette, `turbo.json` présent, signature importe `@koji/shared`.

## 2. Points bloquants / critiques (P0 restants)

- **Admin gating par email codé en dur** (`ablexpertrenov@gmail.com`, `bouhouchimira@gmail.com`) dans `admin/` et `lib/auth.js` — single point of failure. Colonne `is_admin` (0004) existe mais le gating reste par email.
- **Buckets non-Kôji non audités** : `documents`, `logos`, `photos`, `items`, `profiles`, `menu-images` restent permissifs.
- **`lib/user-store.js` — bug fonctionnel** : `accountType: row.account_type || row.is_pro ? "entreprise" : "particulier"` (précédence) → tout `account_type` truthy renvoie "entreprise". De plus `denormalizeToSupabase` n'écrit jamais `account_type`. Impact sur l'unification users.
- **`subscription-store.js` non consommé** : `subscription-status.js` (seul importateur) n'est importé nulle part. La logique de plan repose encore sur Stripe direct / `business_info._billingPlan`.
- **Concurrence sur le blob `koji_web_state`** : réécriture complète à chaque mutation, pas de verrouillage optimiste/transaction → risque de perte de données (web + mobile concurrents).
- **Secrets non configurés** : `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `google-services.json`, APNs → push et Sentry inactifs en prod.
- **Comptes particuliers hors Supabase Auth** : unification bloquée par décision produit (Option A vs B, voir USERS_UNIFICATION.md).

## 3. Dette technique

- **Monorepo partiel** : workspaces ne couvrent que `packages/*` + `signature` (pas `admin`, `worker` vidé). `koji-shared` est un squelette de copies, utilisé uniquement par `signature` (4 fichiers). Duplication `lib/supabase*.js` reste dans admin.
- **Versions Next.js** : root 16.3.0, admin 16.1.6, signature 16.3.0 — admin en retard.
- **Pas de CI web** : aucun workflow `npm test` / `next build` sur push/PR. Seuls mobile et build Android existent. `turbo.json` non exploité par CI.
- **`.env.example` manquants** : seul root et `worker/` (obsolète) en ont un ; `admin/` et `signature/` n'en ont pas.
- **`worker/` déprécié et vidé** (ne contient plus que `.env.example`). Doc (`WORKER_APP_AUDIT.md`, `MONOREPO.md`) le référence encore.
- **Documentation obsolète** : `MONOREPO.md` mentionne `koji-admin/` et `worker/` qui n'existent plus ; `PHASE4_AUDIT.md` sous-estime l'avancement offline/push.
- **Pas de tests pour `user-store.js` / `subscription-store.js`**.
- **`lib/db.js`** : 188 routes, 127 `readDb()` — dépendance massive au blob JSON. Migration table par table non terminée (particuliers encore dans blob + `particulier_users_state`).
- **Catalogue ouvrages** : web édite le blob (`db.kojiOuvrages`), mobile lit la table `koji_ouvrages`. Pas de sync bidirectionnelle automatique.
- **Offline mobile** : intégration partielle, queue drainée uniquement au changement de connectivité. Pas de test avion dédié au-delà de `offline_cache_isolation_test.dart`.
- **Push** : pas de config native ni de `FIREBASE_SERVICE_ACCOUNT` → envoi réel impossible. Pas de test appareil.
- **Sentry** : pas de DSN configuré, pas d'upload de source maps → traces minifiées.

## 4. Features manquantes (Phase 4)

- **Catalogue ouvrages unifié** (P2-1) : `koji_ouvrages` comme source unique. Effort M.
- **Observabilité** (P2-2) : activer Sentry (DSN), logs structurés/middleware API. Effort M.
- **Migration ouvriers legacy** (P2-3) : exécuter `migrate-workers.mjs --apply`, décommissionner `worker/`. Effort M.
- **Push notifications réels** (P2-4) : config native + secret + tests appareil. Effort XL.
- **Offline-first robuste** (P2-5) : cache/queue étendus, tests avion. Effort XL.
- **Billing unifié** : webhooks stores + lecture `subscriptions` (web + mobile). Effort L.
- **Unification users** : décision produit puis migration. Effort XL.

## 5. Monorepo / CI

- **CI web manquant** (P1-1) : pas de workflow `npm test` + `next build`. À créer.
- **CI mobile existant** : `mobile-ci.yml` (analyze + tests + intégration Android), `build-and-upload.yml` (release Android). Bon niveau.
- **CI unifié** (P3-3) : web + mobile en parallèle, après P1-1 et workspaces.
- **Workspaces** (P3-1) : ajouter `admin`, retirer `worker`, aligner versions Next, supprimer node_modules imbriqués.
- **Package partagé** (P1-5) : sortir `koji-shared` du squelette, remplacer copies dans admin/signature, épingler versions.
- **Turbo** (P3-2) : pipelines dev/build/lint/test.
- **`.env.example` racine** (P3-4) : documenter toutes les variables.

## 6. Recommandations priorisées

### P0 (bloquant production)
| Action | Effort |
|---|---|
| Auditer buckets non-Kôji (`documents`, `logos`, `photos`, `items`, `profiles`, `menu-images`) | S |
| Migrer admin gating vers flag `is_admin` (DB) au lieu de l'email codé en dur | M |

### P1 (important, court terme)
| Action | Effort |
|---|---|
| Workflow CI web (unit tests + `next build`) | M |
| Corriger `lib/user-store.js` (bug `accountType`, écriture `account_type`) | M |
| Brancher la lecture `subscriptions` côté web (remplacer plan legacy) | M |
| Réduire la concurrence sur `lib/db.js` (verrouillage optimiste ou migration table par table) | L |
| Finaliser `packages/koji-shared` (sortir du squelette, admin + signature) | L |
| Aligner versions Next.js (admin 16.1.6 → 16.3.x) | M |

### P2 (valeur métier)
| Action | Effort |
|---|---|
| Catalogue ouvrages unifié web ↔ mobile via `koji_ouvrages` | M |
| Observabilité : activer Sentry (DSN) + logs structurés/middleware API | M |
| Migration ouvriers legacy (`migrate-workers.mjs --apply`) + décommission `worker/` | M |
| Push notifications réels (config native + `FIREBASE_SERVICE_ACCOUNT` + tests appareil) | XL |
| Offline-first robuste (cache/queue étendus, tests avion) | XL |
| Billing unifié (webhooks stores + lecture `subscriptions` mobile/web) | L |
| Unification users : décision produit Option A/B puis migration | XL |

### P3 (consolidation)
| Action | Effort |
|---|---|
| Workspaces npm incluant `admin` (retirer `worker`) | M |
| Turbo pipelines dev/build/lint/test | M |
| CI unifié web + mobile | M |
| `.env.example` racine + admin + signature | S |
| Mettre à jour `MONOREPO.md` / `PHASE4_AUDIT.md` (docs obsolètes) | S |

## Synthèse

Le socle sécurité P0 est posé et vérifié (RLS canonique, Storage durci, tests verts). La dette principale se concentre sur **l'unification des stores** (users/subscription, bug `accountType`), la **concurrence du blob JSON**, le **monorepo/CI web** et l'**activation des features Phase 4** (push, Sentry, offline, catalogue) fondées mais non configurées.

**P1-3 RÉSOLU** : bug `accountType` corrigé dans `lib/user-store.js` (précédence `||` → condition explicite `=== "entreprise" || is_pro === true`), et `account_type` désormais écrit dans `denormalizeToSupabase`. 6 tests unitaires ajoutés (`tests/unit/user-store.test.js`), tous verts. Suite complète : 520 tests web verts.

**P1-1 RÉSOLU** : workflow CI web créé (`.github/workflows/web-ci.yml`) — tests unitaires + build de production sur push/PR. Build validé localement (exit 0).

**P1-4 RÉSOLU** : verrouillage optimiste ajouté sur le blob `koji_web_state` — colonne `version` (migration 0017, appliquée sur la base principale), `readDb()` expose `_version`, `writeDb()` vérifie la version et lève `DbConflictError` en cas de conflit, helper `updateDb(mutator, {retries})` pour read-modify-write sûr. Export `DbConflictError` + test. Suite complète : 521 tests web verts. Routes existantes conservent leur comportement (backward compat : écriture sans version reste possible).

**P2-2 RÉSOLU** : config Sentry prête à activer — DSN conditionnel, environment/release, ignoreErrors, scrubbing PII (cookies/authorization), withSentryConfig pour l'upload des source maps (si SENTRY_AUTH_TOKEN), .env.example mis à jour. Activation réelle = créer un projet Sentry et définir SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN (+ SENTRY_AUTH_TOKEN pour les source maps). Build validé (exit 0).

**P2-1 (partiel) RÉSOLU** : sync web→table ajoutée. Les opérations admin sur le socle commun (POST/PATCH/DELETE avec `addToKojiCatalog`) synchronisent désormais la table `koji_ouvrages` (upsert/delete best-effort) via `lib/koji-ouvrages.js` (`upsertSharedOuvrage`, `deleteSharedOuvrage`), pour que l'app mobile voie les modifications sans migration manuelle. Le blob reste la source de vérité côté web (fallback conservé). Unification complète (web lit la table en priorité) reste à faire.

**Prochain point à régler** : P0 — auditer les buckets non-Kôji (`documents`, `logos`, `photos`, `items`, `profiles`, `menu-images`) (effort S), ou P1-5 — finaliser `packages/koji-shared`.
