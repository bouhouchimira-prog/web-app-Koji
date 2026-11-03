# Sentry — Kôji (monitoring erreurs)

## Web (Next.js)

- Dépendance : `@sentry/nextjs` (package.json).
- Config : `sentry.client.config.js`, `sentry.server.config.js`,
  `sentry.edge.config.js` (à la racine du projet).
- DSN : `NEXT_PUBLIC_SENTRY_DSN` (client) et `SENTRY_DSN` (serveur) dans
  `.env.local`.
- Activation automatique si le DSN est présent, sinon désactivé.

### Setup
1. Créer un projet Sentry (Next.js).
2. Copier le DSN dans `.env.local` :
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
   SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
   ```
3. (Optionnel) Configurer `SENTRY_AUTH_TOKEN` pour l'upload des source maps
   au build (voir docs Sentry Next.js).

## Mobile (Flutter)

- Dépendance : `sentry_flutter` (pubspec.yaml).
- Initialisation dans `runKojiApp` (`koji_app.dart`) si `SENTRY_DSN` est
  fourni via `--dart-define` :
  ```
  flutter run --dart-define=SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0 ...
  ```

## Logger (web)

`lib/logger.js` fournit un logger structuré avec redaction automatique des
secrets. Les erreurs loggées via `logger.error()` peuvent être envoyées à
Sentry via `Sentry.captureException()` dans les routes critiques.

## État actuel

- Fondations posées : config files + dépendances + initialisation conditionnelle.
- Envoi réel activé dès que `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` sont
  présents.
- Tests sur appareil réel + vérification des événements dans le dashboard
  Sentry restent à faire.
