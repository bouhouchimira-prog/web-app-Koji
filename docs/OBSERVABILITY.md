# Observabilité — Kôji

## Logger structuré (web)

`lib/logger.js` fournit un logger structuré :

- `logger.debug/info/warn/error(message, meta)` — émet du JSON en prod,
  des lignes lisibles en dev.
- Redaction automatique des secrets (tokens, passwords, api keys) dans les
  métadonnées.
- `requestLogger(request, route)` — helper pour logger durée + status par
  requête (utilisé dans `app/api/auth/particulier-login/route.js`).

### Usage

```js
import { logger, requestLogger } from "../../lib/logger";

export async function POST(request) {
  const log = requestLogger(request, "POST /api/foo");
  try {
    // ... handler ...
    log.done({ userId });
    return ok({ ... });
  } catch (err) {
    log.fail(err);
    return badRequest("Erreur serveur.", 500);
  }
}
```

## Crash reporting (recommandé)

- **Web** : intégrer `@sentry/nextjs` (Sentry SDK pour Next.js). Ajouter
  `SENTRY_DSN` dans `.env.local` et dans les secrets GitHub Actions.
- **Mobile** : intégrer `sentry_flutter` dans `mobile/pubspec.yaml` et
  initialiser dans `main.dart` / `main_client.dart`.

## Logs Vercel

Les logs émis en JSON (prod) sont ingérables par Vercel Logs / un drain
externe (Datadog, Axiom). Filtrer par `level=error` pour les alertes.

## Métriques (à venir)

- Compteur de requêtes par route (durée p50/p95).
- Taux d'erreur 4xx/5xx.
- Latence Supabase (temps de réponse des queries).
