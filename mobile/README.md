# Kôji - Devis de Rénovation

Application Flutter pour la création de devis de rénovation immobilière.

## Deux applications

Le même code produit deux applications distinctes, au design de la maquette web
(« koji — Dashboards des outils ») :

| Application | Pour qui | Entrée | Flavor Android | Identifiant |
|---|---|---|---|---|
| **Koji Pro** | entreprises, artisans et leurs ouvriers | `lib/main_entreprise.dart` | `entreprise` | `com.koji.pro` (app existante) |
| **Koji** | clients particuliers | `lib/main_client.dart` | `client` | `com.koji.client` |

Chaque application démarre directement sur sa propre page de connexion (plus
d'écran de choix du type de compte). Les ouvriers se connectent dans Koji Pro
(onglet « Ouvrier ») ; les clients qui ont reçu un identifiant de leur artisan
se connectent dans Koji (onglet « Identifiant chantier »).

```bash
# Mobile
flutter run --flavor entreprise -t lib/main_entreprise.dart --dart-define=...
flutter run --flavor client     -t lib/main_client.dart     --dart-define=...

# Web (grand écran : bandeau + menu latéral de la maquette)
flutter run -d chrome -t lib/main_entreprise.dart --dart-define=...
flutter build web -t lib/main_client.dart -o build/web_client --dart-define=...

# Stores
flutter build appbundle --flavor entreprise -t lib/main_entreprise.dart --dart-define=...
flutter build appbundle --flavor client     -t lib/main_client.dart     --dart-define=...
```

`lib/main.dart` lance Koji Pro (comme avant). Liens optionnels vers l'autre
application sur la page de connexion : `--dart-define=KOJI_PRO_URL=...` et
`--dart-define=KOJI_CLIENT_URL=...`.

### Organisation du code

- `lib/app/` — démarrage commun, type d'application (`KojiAppConfig`), compte connecté.
- `lib/design/` — design system de la maquette : couleurs (`koji_tokens.dart`),
  thème, icônes, composants (cartes, indicateurs, pastilles, boutons, champs),
  bandeau et menu latéral.
- `lib/apps/entreprise/` — routes, cadre (bandeau + menu sur grand écran),
  tableau de bord, recherche, activité de fond (notifications de signature,
  messages, signalements ouvriers).
- `lib/apps/client/` — routes, cadre (menu latéral / barre du bas) et pages
  Accueil, Devis reçus, Mes chantiers, Messages, Profil, Paramètres.
- `lib/features/` — les écrans métier existants, partagés.

### Avant de publier l'application client

- **Google Sign-In / Firebase** : ajouter l'app Android `com.koji.client` dans
  le projet Firebase `koji-android`, puis remplacer
  `android/app/src/client/google-services.json` par le fichier téléchargé.
  Le fichier actuel est une copie de celui de Koji Pro avec le nouveau nom de
  paquet, sans client OAuth Android : il permet de compiler, mais la connexion
  Google ne fonctionnera qu'après l'ajout de l'empreinte SHA-1 de
  `com.koji.client`.
- **iOS** : créer dans Xcode les configurations / schémas `entreprise` et
  `client` (Bundle ID `com.koji.pro` et `com.koji.client`) — voir
  https://docs.flutter.dev/deployment/flavors-ios.
- **Icônes** : les deux apps utilisent encore la même icône.

## Configuration

### Variables d'environnement

L'application utilise `dart-define` pour la configuration sécurisée de Supabase :

```bash
# Android : préciser l'application (--flavor entreprise ou --flavor client)
flutter run --flavor entreprise -t lib/main_entreprise.dart   --dart-define=SUPABASE_URL=https://xxxx.supabase.co   --dart-define=SUPABASE_ANON_KEY=votre_clé_anon_supabase
```

### Configuration Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Obtenez votre clé anon depuis les paramètres du projet
3. Utilisez la commande avec `--dart-define` pour spécifier la clé

## Développement

### Prérequis

- Flutter SDK >= 3.2.0
- Dart SDK >= 3.2.0

### Installation

```bash
flutter pub get
flutter run --flavor entreprise -t lib/main_entreprise.dart   # ou --flavor client -t lib/main_client.dart
```

## Fonctionnalités

- Création de profils d'entreprise
- Estimation de devis par pièces
- Calcul automatique des ratios MO/Matériaux
- Export PDF des devis
