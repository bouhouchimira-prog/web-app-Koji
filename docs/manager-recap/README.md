# Récapitulatif manager (PPT)

Ce dossier génère `Recap-Koji-Manager.pptx`, le récapitulatif technique (Frontend / Backend / Base de données) envoyé au manager.

## Mettre à jour

1. Ajouter une entrée dans `data.json` (tableau `entries`), avec :
   - `category`: `"frontend"`, `"backend"` ou `"database"`
   - `theme`: le regroupement fonctionnel (ex. "Devis", "Chantiers", "Équipe"...)
   - `title`: titre court
   - `detail`: une ou deux phrases, langage clair pour un manager (pas de jargon)
2. Régénérer le fichier :
   ```
   cd docs/manager-recap
   npm install   # une seule fois
   node generate.js
   ```
3. `Recap-Koji-Manager.pptx` est régénéré en entier à partir de `data.json` — c'est la seule source de vérité, ne pas éditer le `.pptx` à la main.

Cette mise à jour doit être faite systématiquement après tout travail notable sur le projet, pour que le récap reste à jour sans qu'on ait à le redemander.
