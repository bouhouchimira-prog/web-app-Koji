# Plan de consolidation du monorepo — Kôji

## État actuel

- Pas de `workspaces` dans `package.json` racine, pas de `turbo.json` (mentionné
  dans MONOREPO.md mais absent).
- Chaque app (racine web, `worker/`, `signature/`, `admin/` dans koji-web-da,
  `koji-admin/`) a son propre `node_modules` et `package.json`.
- `lib/` partagé uniquement au sein de la web app ; `lib/supabase*.js` est
  dupliqué dans worker/signature/admin.
- Le mobile (`mobile/`) est dans le même repo mais n'a aucun partage de code
  avec le web (Dart vs JS).

## Objectif

Monorepo fonctionnel avec code partagé, builds reproductibles, dépendances
épinglées, CI unifié.

## Plan (par étapes, sans casser l'existant)

### Étape 1 — Workspaces (faible risque)
- Ajouter `"workspaces": ["worker", "signature", "admin", "koji-admin"]` dans
  le `package.json` racine.
- Supprimer les `node_modules` imbriqués, `npm install` à la racine.
- Vérifier que `npm run dev` lance toutes les apps.

### Étape 2 — Package partagé `packages/koji-shared`
- Créer `packages/koji-shared/` avec `lib/supabase.js`, `lib/http.js`,
  `lib/text.js`, `lib/server-auth.js`, `lib/session-cookies.js`.
- Remplacer les copies dans worker/signature/admin par des imports
  `@koji/shared`.
- Épingler les versions (supprimer `"next": "latest"`, `"react": "latest"`).

### Étape 3 — Turbo (optionnel)
- Ajouter `turbo.json` avec pipelines `dev`, `build`, `lint`, `test`.
- Configurer les ports par app.

### Étape 4 — Mobile
- Le mobile reste un projet Flutter séparé (Dart). Pas de partage de code
  possible. Conserver dans `mobile/` du même repo pour la cohérence, mais
  documenter qu'il est indépendant.

### Étape 5 — CI unifié
- Un workflow GitHub Actions qui lance `npm test` (root + workspaces) et
  `flutter test` (mobile) en parallèle.

## Risques
- Les apps ont des versions de Next.js différentes (15 vs 16) → à aligner
  avant les workspaces.
- Les variables d'environnement sont par app → à documenter dans un `.env.example`
  racine.
