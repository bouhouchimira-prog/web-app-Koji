# Audit — Worker app (sous-projet `worker/`)

## État actuel

Le sous-projet `worker/` est une app Next.js séparée (React 18, Next 15) avec
3 routes API et 2 pages (login, dashboard). Le README liste comme "à
implémenter" : login, dashboard, tâches, calendrier, messages.

## Constat de sécurité (P0)

1. **IDOR sur les tâches** : `GET /api/worker/tasks?workerId=xxx` et
   `PATCH /api/worker/tasks/[id]` font confiance au `workerId` envoyé par le
   client. N'importe qui connaissant un `workerId` peut lire/modifier les
   tâches d'un autre ouvrier.
2. **Pas de session vérifiée** : le token renvoyé par `/api/auth/worker-login`
   n'est ni persisté ni vérifié côté serveur. Il est stocké en localStorage
   (XSS).
3. **Hashage faible** : SHA-256 sans sel (vs scrypt dans le main app via
   `lib/password-hash.js` / `lib/worker-auth.js`).
4. **updateTaskStatus** utilise le service role et ne vérifie pas que
   l'ouvrier est assigné à la tâche.
5. **getTaskById** expose n'importe quelle tâche par ID, sans filtre
   d'assignation.

## Redondance

Le main app (`app/`) contient déjà un portail ouvrier complet et sécurisé :
- `app/worker`, `app/api/worker-portal`, `app/api/worker-auth`,
  `app/api/worker-actions`
- `lib/worker-portal.js`, `lib/worker-session.js`, `lib/worker-auth.js`
  (scrypt, cookies HttpOnly, session vérifiée)

→ La sous-app `worker/` est un doublon legacy et moins sécurisé.

## Recommandation

**Déprécier la sous-app `worker/`** au profit du portail ouvrier intégré au
main app, qui est sécurisé et maintenu. Étapes :

1. Marquer `worker/` comme déprécié (README + note dans ce fichier).
2. Migrer les utilisateurs ouvriers vers le portail intégré
   (`/worker` du main app, auth via `lib/worker-session.js`).
3. Supprimer la sous-app `worker/` une fois la migration confirmée.

## Si conservation souhaitée

Corriger au minimum :
- Stocker le token côté serveur (table `worker_sessions`) et le vérifier sur
  chaque route (remplacer `workerId` query param par une vérification de
  session).
- Passer au hashage scrypt (`lib/password-hash.js`).
- Ajouter un filtre d'assignation dans `getTaskById` et `updateTaskStatus`.
- Migrer le token de localStorage vers un cookie HttpOnly.
