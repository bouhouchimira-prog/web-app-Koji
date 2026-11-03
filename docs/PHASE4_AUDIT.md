# Phase 4 (P3) — Audit fonctionnalités & UX

## 1. Push notifications distantes (mobile)

### État actuel
- Mobile utilise `flutter_local_notifications` (notifications locales uniquement).
- Web a un système de notifications dans `koji_web_state` (notifications array)
  lu par l'app mobile via l'API web.
- Aucun service de push distant (FCM/APNs) n'est configuré.

### Manquant
- Configuration Firebase Cloud Messaging (Android) + APNs (iOS).
- Endpoint backend pour enregistrer les tokens device et envoyer les pushes.
- Intégration dans le mobile (réception, affichage, navigation).

### Recommandation
Ajouter FCM (firebase_messaging) côté mobile et un endpoint
`/api/push/register` + `/api/push/send` côté web. Déclencher les pushes
depuis les routes existantes (nouveau message, nouveau devis, etc.).

Effort : élevé (config native iOS/Android + backend + tests).

## 2. Offline-first robuste

### État actuel
- Pas de module offline dédié dans le mobile (la feature `synchronization/`
  concerne le planning, pas le cache offline).
- Le mobile dépend du réseau pour toutes les opérations (Supabase direct +
  API web).

### Manquant
- Cache local (SQLite/Hive) pour les données critiques (devis, clients,
  chantiers).
- Queue d'actions hors-ligne avec retry.
- Résolution de conflits (last-write-wins ou merge).

### Recommandation
Commencer par un cache read-only des données les plus consultées (devis,
clients), puis ajouter la queue d'écriture. Utiliser `sqflite` ou `hive`.

Effort : élevé.

## 3. Observabilité

### État actuel
- Logs via `console.error` / `console.log` côté web, `debugPrint` / `print`
  côté mobile.
- Aucun service de monitoring (Sentry, Datadog, etc.).
- Fichiers `*.log` à la racine (dev) — déjà gitignored.

### Recommandation
- Web : intégrer Sentry (ou Vercel Analytics) + logs structurés (JSON) dans
  les routes API.
- Mobile : intégrer `sentry_flutter` pour le crash reporting.
- Ajouter un middleware de logging des requêtes API (durée, status, userId).

Effort : moyen.

## 4. Catalogue d'ouvrages synchronisé web ↔ mobile

### État actuel
- Web : catalogue partagé éditable par admin (`kojiOuvrages` dans le blob,
  `lib/ouvrages.js`). Bibliothèque d'ouvrages (`bibliotheque-ouvrages/`).
- Mobile : pricing profiles depuis la table Supabase `pricing_profiles`
  (`features/pricing/repository/pricing_repository.dart`).
- Les deux systèmes sont indépendants → risque de divergence.

### Recommandation
Créer une table Supabase `koji_ouvrages` (ou réutiliser `pricing_profiles`)
comme source unique. Le web admin édite, le mobile lit. Ajouter une migration
SQL et adapter `lib/ouvrages.js` et `PricingRepository`.

Effort : moyen.

## 5. Migration des utilisateurs ouvriers (suite dépréciation worker/)

### État actuel
- La sous-app `worker/` est dépréciée (voir docs/WORKER_APP_AUDIT.md).
- Le portail ouvrier intégré (`app/worker`, `app/api/worker-portal`) est
  sécurisé et maintenu.

### Recommandation
Migrer les ouvriers existants vers le portail intégré : créer un script de
migration qui copie les comptes `workers` (email, password hash) vers le
format attendu par `lib/worker-auth.js` (scrypt). Documenter la procédure.

Effort : moyen (script + tests).

## Priorité recommandée pour la Phase 4

1. **Catalogue d'ouvrages** (4) — moyen, valeur métier élevée, pas de
   dépendance native.
2. **Observabilité** (3) — moyen, améliore la maintenabilité.
3. **Migration ouvriers** (5) — moyen, suite logique de la dépréciation.
4. **Push notifications** (1) — élevé, dépend de config native.
5. **Offline-first** (2) — élevé, chantier à part entière.
