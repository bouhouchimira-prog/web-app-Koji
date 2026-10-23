# Tests end-to-end (Selenium + Mocha)

Suite de tests automatisés qui pilote un vrai navigateur Chrome pour
vérifier que l'application fonctionne, du point de vue de quelqu'un qui
clique dessus — pas juste que le code compile.

## Installation

Déjà fait dans ce dépôt (`selenium-webdriver` + `mocha` en devDependencies).
Il faut en plus **Google Chrome** installé sur la machine (Selenium pilote
Chrome directement, pas de serveur séparé à lancer).

## Configuration

1. Copiez `tests/e2e/.env.e2e.example` en `tests/e2e/.env.e2e` (jamais
   versionné, voir `.gitignore`).
2. Remplissez les variables dont vous avez besoin :

| Variable | Rôle | Si absente |
|---|---|---|
| `E2E_BASE_URL` | URL de l'app à tester | `http://localhost:3000` |
| `E2E_HEADLESS` | `1` = Chrome invisible, `0` = fenêtre visible | `1` |
| `E2E_ENTREPRISE_EMAIL` / `E2E_ENTREPRISE_PASSWORD` | Compte entreprise réel | tests entreprise authentifiés **ignorés** |
| `E2E_PARTICULIER_EMAIL` / `E2E_PARTICULIER_PASSWORD` | Compte particulier réel | tests particulier **ignorés** |
| `E2E_WRITE` | `1` = autorise les tests qui créent de vraies données | tests d'écriture **ignorés** |
| `E2E_AI` | `1` = autorise les appels réels à l'assistant IA (payant) | test IA **ignoré** |

**Aucun identifiant manquant ne fait échouer la suite** — les tests
correspondants passent en "pending/skipped", visibles dans le rapport final
mais jamais comptés comme des échecs.

## Lancer les tests

Il faut l'app démarrée dans un premier terminal :

```bash
npm run dev
```

Puis, dans un **second terminal** :

```bash
npm run test:e2e
```

## Ce qui est testé

- `specs/00-public.spec.js` — pages publiques (landing, connexion, mot de
  passe oublié, inscription, mentions légales, portails ouvrier/signature,
  sitemap.xml).
- `specs/01-securite-acces.spec.js` — redirections des pages entreprise
  vers `/login` si non connecté, appels API anonymes (doivent toujours
  refuser ou renvoyer une liste vide, jamais de vraies données), en-têtes
  de sécurité (CSP, X-Frame-Options).
- `specs/02-entreprise-smoke.spec.js` — chaque page entreprise charge sans
  erreur (nécessite `E2E_ENTREPRISE_EMAIL`/`PASSWORD`).
- `specs/03..08` — scénarios fonctionnels par outil (contacts, clients,
  devis, bibliothèque, fournitures, calendrier, interventions, comptabilité,
  équipe, recherche, assistant koji). **Nécessitent `E2E_WRITE=1`** pour les
  tests qui créent des données — toujours préfixées `E2E-<horodatage>`,
  toujours nettoyées (suppression/archivage) à la fin du test qui les a
  créées.
- `specs/09-particulier.spec.js` — espace particulier. **Ne publie jamais**
  une vraie demande sur le Marketplace (Radar des Chantiers), même avec
  `E2E_WRITE=1`.
- `specs/10-ouvrier-signature.spec.js` — tableau de bord ouvrier,
  portail de signature.
- `specs/11-bugs-connus.spec.js` — 3 bugs identifiés en lisant le code
  avant d'écrire cette suite. Chaque test affirme le comportement
  **attendu** (correct) : un échec confirme que le bug existe encore, un
  succès signifie qu'il a été corrigé depuis.

## Captures d'écran en cas d'échec

Chaque test qui échoue déclenche automatiquement une capture d'écran,
enregistrée dans `tests/e2e/reports/screenshots/` (jamais versionné). Le
chemin exact est affiché dans la sortie du terminal, juste après le test en
échec.

## Écrire un nouveau test

- Toujours des attentes explicites (`support/helpers.js` : `waitVisible`,
  `waitClickable`, `clickWhenReady`...), jamais de `sleep` fixe.
- Les `<label>` de l'app n'ont pas d'attribut `for` — cibler un champ par
  son label visible via `h.findByLabel(driver, "Texte du label")` (gère les
  apostrophes françaises).
- Les champs `type=date`/`datetime-local` : `h.setNativeInputValue(...)`
  plutôt que `sendKeys`, qui ne déclenche pas toujours l'événement `input`
  que React écoute.
- Toute donnée créée doit être préfixée `E2E-` et nettoyée dans le test qui
  l'a créée (ou dans son `afterEach`), jamais laissée dans la vraie base.
- Avant toute connexion, `await h.clearSession(driver)` (cookies +
  localStorage) pour ne jamais hériter d'une session précédente.
