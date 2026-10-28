# Worker App Deployment Guide

Deploy worker app à ouvrier.kojibuild.com

## 🚀 Déploiement sur Vercel

### 1. Créer un projet Vercel séparé

```bash
# Option A: Depuis vercel.com/new
# Importer le repo worker.koji

# Option B: Depuis CLI
vercel --name worker-koji
```

### 2. Configurer les variables d'environnement

Dans Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
```

### 3. Configurer le sous-domaine

1. Aller dans Vercel → Domains
2. Ajouter domaine: `ouvrier.kojibuild.com`
3. Suivre les instructions de configuration DNS

### 4. DNS Configuration (chez registrar kojibuild.com)

Ajouter CNAME record:

```
Subdomain: ouvrier
Type: CNAME
Value: cname.vercel.com
```

Attendre 15-30 minutes pour propagation DNS.

## 📋 Avant le déploiement

- [ ] Supabase credentials dans .env.local (local testing)
- [ ] Routes API implémentées (worker-login, tasks)
- [ ] Worker table créée dans Supabase
- [ ] Test localement: `npm run dev`

## 🔗 Routes Disponibles

### Authentication
- `POST /api/auth/worker-login`
  - Body: `{ email, password }`
  - Response: `{ token, workerId, workerName }`

### Tasks
- `GET /api/worker/tasks?workerId=xxx`
  - Returns: Array of tasks assigned to worker
- `GET /api/worker/tasks/[id]`
  - Returns: Single task detail
- `PATCH /api/worker/tasks/[id]`
  - Body: `{ status, done }`
  - Updates task status

## 🌐 Accès

Production: https://ouvrier.kojibuild.com
Dev: http://localhost:3003 (ou port configuré)

## 📝 Environnement

```env
# .env.local (dev)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## 🔐 Sécurité

- [ ] SUPABASE_SERVICE_ROLE_KEY jamais exposé au client
- [ ] Les routes API utilisent le token fourni par le client
- [ ] Supabase RLS enforces data isolation per worker
- [ ] Password hashing: SHA256 (TODO: upgrade à bcrypt)

## 🐛 Troubleshooting

### "Cannot find module @/lib/supabase-client"

Assurez-vous que:
- `lib/supabase-client.js` existe au racine du projet worker
- Ou configurez la résolution des imports dans `tsconfig.json`

### "Missing Supabase credentials"

Vérifiez que les variables sont définies:
```bash
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### Worker ne reçoit pas les tâches

- Vérifier que worker_ids dans tasks table contient l'ID du worker
- Vérifier que tasks.user_id correspond à un projet de cet ouvrier

## 📞 Support

- Frontend: ouvrier.kojibuild.com
- Admin: koji-admin (gérer workers + assigner tâches)
- Main app: kojibuild.com (gérer projets + créer tâches)
