# Architecture Mobile Kôji

Ce document décrit l'organisation réelle du dossier `mobile/lib/` telle qu'elle est aujourd'hui.

## Vue d'ensemble

```text
mobile/lib/
├── app/        # Configuration globale, routage partagé, compte utilisateur
├── apps/       # Coquilles par application (flavors)
├── core/       # Services, config, helpers partagés
├── design/     # Thème, tokens, widgets design system
├── features/   # Fonctionnalités métier réutilisables
└── main_*.dart # Points d'entrée (client / entreprise)
```

## `apps/` vs `features/`

### `apps/`
Contient les **coquilles complètes** par flavor d'application.

- `apps/client/` : Shell, navigation, router et écrans spécifiques à l'app "Particulier/Client" (`main_client.dart`)
- `apps/entreprise/` : Shell, navigation latérale/bottom, router et écrans spécifiques à l'app "Entreprise/Artisan" (`main_entreprise.dart`)

Règle : tout ce qui est **strictement lié à la structure d'une app** (shell, tabs, routing principal) va ici.

### `features/`
Contient les **domaines métier** découplés et réutilisables entre les apps quand c'est pertinent.

Exemples présents :

| Dossier | Rôle |
| --- | --- |
| `auth/` | Authentification, sélection de profession, business info |
| `quote/` | Devis, édition, statut, mapping |
| `worker/` | Gestion ouvriers, assignations |
| `calendar/` / `planning/` | Calendrier, planification |
| `subscription/` | Abonnements IAP (alignés sur les paliers web) |
| `marketplace/` | Logique marketplace utilisée par le client |
| `synchronization/` | Outils liés aux ouvriers/assignations |

Règle : si une fonctionnalité peut **théoriquement** être réutilisée ou appartient à un domaine métier clair, elle va dans `features/`. Si elle est **intrinsèque à l'agencement d'un flavor**, elle va dans `apps/`.

## Dossiers transverses

| Dossier | Rôle |
| --- | --- |
| `app/` | `KojiAppConfig`, `KojiAccount`, providers globaux, `KojiWebApiClient`, guards |
| `core/` | `SupabaseConfig`, services, helpers, notifications |
| `design/` | `KojiTheme`, `KojiTokens`, `KojiWidgets`, icônes partagées |

## Bonnes pratiques

- **Un seul sens** : privilégier le pattern existant plutôt que de déplacer des fichiers en masse
- **Rétro-compatible** : `KojiAccount` reste aligné avec le mapping web (`lib/user-profile.js`)
- **Hybride** : utiliser Supabase direct quand possible, `KojiWebApiClient` uniquement pour les cas où le web possède déjà la logique (ex. marketplace particulier)
- **Cohérence** : respecter les rôles `entreprise` / `particulier` / `worker` entre les 3 espaces
- **Flavors** : ne pas mélanger la logique propre au client avec celle de l'entreprise

## Notes

Cette organisation est **fonctionnelle**. Aucun déplacement n'a été effectué dans le cadre du LOT 5. L'objectif est uniquement de documenter l'existant pour faciliter la maintenance.
