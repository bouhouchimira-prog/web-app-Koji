# Vérification Sentry — Kôji

## Prérequis

1. Créer un projet Sentry (Next.js) sur https://sentry.io
2. Copier le DSN dans `.env.local` :
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
   SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
   ```
3. (Optionnel) Configurer `SENTRY_AUTH_TOKEN` pour l'upload des source maps.

## Vérification Web

### 1. Démarrer le serveur
```powershell
npm run dev
```

### 2. Déclencher une erreur
Ajoute temporairement dans une page (ex: `app/page.jsx`) :
```js
throw new Error("Test Sentry - " + new Date().toISOString());
```

### 3. Vérifier dans le dashboard Sentry
- Va sur https://sentry.io → ton projet → Issues
- L'erreur "Test Sentry - ..." doit apparaître en quelques secondes
- Vérifie que le stack trace est lisible (source maps)

### 4. Vérifier les logs structurés
- Les appels `logger.error()` dans les routes API doivent apparaître dans les logs Vercel
- Format JSON en production, lisible en dev

### 5. Vérifier la redaction
- Les tokens/passwords ne doivent JAMAIS apparaître dans les logs Sentry
- Test : `logger.error("test", { password: "secret123", token: "abc" })` → doit afficher `[REDACTED]`

## Vérification Mobile

### 1. Build avec DSN
```powershell
flutter run --dart-define=SENTRY_DSN=https://xxxx@o0.ingest.sentry.io/0
```

### 2. Déclencher une erreur
Ajoute temporairement dans `main.dart` :
```dart
throw Exception("Test Sentry mobile - ${DateTime.now()}");
```

### 3. Vérifier dans le dashboard Sentry
- L'erreur doit apparaître avec le stack trace Dart
- Vérifie que les breadcrumbs (navigation, HTTP) sont capturés

## Checklist de vérification

- [ ] DSN configuré dans `.env.local`
- [ ] Erreur web visible dans Sentry
- [ ] Stack trace lisible (source maps uploadées)
- [ ] Redaction des secrets vérifiée
- [ ] Erreur mobile visible dans Sentry (si DSN mobile configuré)
- [ ] `SENTRY_AUTH_TOKEN` configuré pour les source maps (optionnel)

## Ce qui est déjà fait (code)

- 12 nov : avant cette date, rien n'était branché côté web (aucun fichier
  `instrumentation`, `sentry.client.config.js` jamais chargé par Next 16) —
  même avec un DSN, aucune erreur ne partait. Désormais :
  - `instrumentation.js` : charge `sentry.server.config.js` / `sentry.edge.config.js`
    au démarrage du serveur et envoie les erreurs de rendu/route (`onRequestError`).
  - `instrumentation-client.js` : charge le SDK navigateur **seulement si**
    `NEXT_PUBLIC_SENTRY_DSN` est défini au build (sinon 0 octet ajouté aux pages).
  - `next.config.mjs` : l'hôte d'ingestion du DSN est ajouté au `connect-src`
    de la CSP quand le DSN existe (sinon le navigateur bloquerait l'envoi).
  - Pas encore de `withSentryConfig` : les traces navigateur restent minifiées
    tant que l'upload des source maps (`SENTRY_AUTH_TOKEN`) n'est pas configuré.
  - Le DSN doit être défini **au build** sur Vercel (variable d'environnement
    Production), puis redéployer.
- `sentry.server.config.js`, `sentry.edge.config.js` : configuration conditionnelle
- `@sentry/nextjs` dans package.json
- `sentry_flutter` dans pubspec.yaml
- `SentryFlutter.init` dans `koji_app.dart` (conditionnel sur `SENTRY_DSN`)
- `lib/logger.js` : logger structuré avec redaction automatique
- 6 tests unitaires sur la redaction (PR #43)
