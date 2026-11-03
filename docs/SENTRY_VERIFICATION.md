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

- `sentry.client.config.js`, `sentry.server.config.js`, `sentry.edge.config.js` : configuration conditionnelle
- `@sentry/nextjs` dans package.json
- `sentry_flutter` dans pubspec.yaml
- `SentryFlutter.init` dans `koji_app.dart` (conditionnel sur `SENTRY_DSN`)
- `lib/logger.js` : logger structuré avec redaction automatique
- 6 tests unitaires sur la redaction (PR #43)
