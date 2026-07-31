# Cahier des charges (PPT)

Ce dossier génère `Cahier-des-charges-Koji-Web.pptx`, la documentation fonctionnelle et technique complète de l'application (authentification → déconnexion, module par module).

Contrairement à `docs/manager-recap/` (qui liste les mises à jour récentes), ce document décrit **toutes** les fonctionnalités de l'application telles qu'elles existent aujourd'hui.

## Mettre à jour

1. Modifier `data.json` :
   - `objectifs` : liste des objectifs généraux du projet
   - `sections` : un module de l'application par entrée, avec `title`, `intro`, et une liste `features` (chacune avec `name`, `description`, et `technical` optionnel)
2. Régénérer :
   ```
   cd docs/cahier-des-charges
   npm install   # une seule fois
   node generate.js
   ```

Ajouter une entrée ici (nouvelle fonctionnalité, ou nouveau module) à chaque fois que l'application évolue de façon notable — en plus de la mise à jour de `docs/manager-recap/`.
