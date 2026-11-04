# Migration des ouvriers vers le portail intégré

## Contexte

La sous-app `worker/` (legacy) est dépréciée (voir `docs/WORKER_APP_AUDIT.md`).
Le portail ouvrier intégré (`app/worker`, `app/api/worker-portal`) est la
version maintenue et sécurisée.

## Procédure

### 1. Sauvegarde
Sauvegarder la base (export Supabase ou dump `koji_web_state`) avant toute
opération.

### 2. Dry-run
```bash
node scripts/migrate-workers.mjs
```
Affiche le nombre d'ouvriers, les normalisations, les loginId générés et les
comptes nécessitant un re-hashage. Aucune écriture.

### 3. Application
```bash
node scripts/migrate-workers.mjs --apply
```
Écrit les ouvriers normalisés dans la base.

### 4. Vérification
- Connecter un ouvrier migré via `/worker` (portail intégré).
- Vérifier que ses tâches sont visibles.
- Vérifier que l'entreprise voit toujours ses ouvriers dans `/equipe`.

### 5. Décommission (après confirmation)
- Supprimer la sous-app `worker/`.
- Supprimer les routes legacy `app/api/worker-auth` si redondantes.
- Mettre à jour la documentation.

## Re-hashage automatique

Les ouvriers avec un hash legacy (SHA-256, 64 caractères hex) ou un mot de
passe en clair sont automatiquement re-hashés en scrypt au prochain login
réussi (`lib/worker-auth.js::workerPasswordNeedsRehash`). Aucune action
manuelle requise.

## Rollback

Restaurer la sauvegarde de la base. Le script n'affecte que la collection
`workers` du blob `koji_web_state`.
