# Archive — projet « app entreprise » du 28 octobre 2026

Ce dossier contient en entier le travail de la branche `feat/entreprise-app-phase-6`
(9 commits du 28 octobre 2026), fusionnée dans `main` le 18 novembre 2026 pour que
rien ne soit perdu. **Rien ici n'est servi par le site** : Next ne compile que le
dossier `app/` à la racine, et aucun fichier du site n'importe ce dossier.

## Ce que c'était

Une première version de l'espace Koji Pro, construite sous `/entreprise/*` avec son
propre menu, plus une app ouvrier séparée :

- `app/entreprise/` — accueil, devis, devis par l'IA, clients, équipe, facturation,
  marketplace, notifications, profil, paramètres, et le `layout.jsx` qui les habille ;
- `app/api/entreprise/` — 9 routes d'API (devis, clients, équipe, profil…) ;
- `components/EntrepriseShell.jsx` — le menu de cette version ;
- `worker/` — une app Next séparée pour les ouvriers ;
- `lib/supabase-client.js`, `scripts/migrate-to-supabase.js`,
  `supabase/migrations/001_init_schema.sql` — un projet de bascule des données vers
  Supabase ;
- `DEPLOYMENT_GUIDE.md`, `SUPABASE_SETUP.md` — les guides de ce projet ;
- `turbo.json` — la version de cette branche (celle de la racine est différente).

Quatre fichiers de la branche étaient déjà dans `main`, identiques, et y restent à
leur place : `MONOREPO.md`, `TEST_CHECKLIST.md`, `TEST_QUICK_START.md`,
`scripts/test-setup.js`.

## Pourquoi ce n'est pas en ligne

Depuis, l'espace Koji Pro a été refait page par page (maquettes PRO-00 à PRO-26) à
d'autres adresses (`/devis`, `/chantiers`, `/facturation`…), et `/entreprise` est
devenu le site public de Koji Pro. Remis à leur place d'origine, ces fichiers :

- habilleraient tout le site public `/entreprise` (accueil, tarifs, ressources,
  contact) avec le menu de l'application (`app/entreprise/layout.jsx`) ;
- remplaceraient la page d'accueil publique par un tableau de bord dont les chiffres
  sont écrits en dur (`app/entreprise/page.jsx`, « TODO: Call API ») ;
- ouvriraient des pages et des routes d'API inachevées (plusieurs « TODO »), en
  doublon de celles qui existent.

## À ne pas exécuter tel quel

- `supabase/migrations/001_init_schema.sql` crée un schéma complet : il n'a jamais
  été exécuté et ne correspond pas à la base actuelle.
- `scripts/migrate-to-supabase.js` déplace des données : même remarque.

## Si l'on veut en reprendre une partie

Les chemins à l'intérieur de ce dossier sont ceux d'origine : un fichier
`archive/app-entreprise-2026-10-28/X` se trouvait en `X`. L'historique complet des
9 commits est dans `main` (`git log -- archive/app-entreprise-2026-10-28`).
