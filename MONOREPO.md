# Koji Monorepo

Monorepo avec 4 apps Next.js partageant la même base Supabase:

## 📦 Structure

```
koji-web/
├── app/                  - App principale (client/entreprise)
├── signature/            - Site de signature (lien simple, pas login)
├── koji-admin/           - Admin interface
├── worker/               - Espace ouvrier
├── lib/                  - Code partagé (Supabase client, utils)
├── data/                 - JSON DB (legacy, à migrer vers Supabase)
├── supabase/             - Migrations SQL + config
└── package.json          - Dépendances partagées
```

## 🚀 Démarrage

### Développement (toutes les apps)

```bash
npm install
npm run dev
```

Accès:
- App principale: http://localhost:3000
- Site signature: http://localhost:3001 (à configurer)
- Admin: http://localhost:3002 (à configurer)
- Worker: http://localhost:3003 (à configurer)

### Build

```bash
npm run build
```

Compile toutes les apps.

## 🔗 Apps

### 1. App Principale (`app/`)

Clients et entreprises (Koji particulier + Koji Pro)
- Client marketplace (création chantier, offres, RDV)
- Entreprise (devis, clients, équipe, facturation)

Ports: 3000, localhost:3000/

### 2. Signature (`signature/`)

Lien simple pour signer un devis (pas de login)
- Reçoit `devisId` en paramètre
- Affiche devis
- Signature électronique
- PDG renvoyé par email

Port: Intégré dans localhost:3000/signature/*

### 3. Admin (`koji-admin/`)

Interface admin pour gérer les utilisateurs et les données
- Users management
- Projects monitoring
- Financial reports
- Settings

Port: Intégré dans localhost:3000/admin/*

### 4. Worker (`worker/`)

Espace ouvrier pour gérer interventions
- Login ouvrier
- Dashboard tâches
- Détail intervention
- Calendrier
- Communications

Port: À configurer (séparé? ou intégré?)

## 🗄️ Supabase (Partagé)

Toutes les apps utilisent la même base de données Supabase:

```bash
# Migrations
supabase db push

# Données JSON → Supabase
node scripts/migrate-to-supabase.js
```

## 🔐 Authentification

- **Clients/Entreprises**: Cookie HMAC (session maison)
- **Ouvriers**: À implémenter (même cookie system ou auth Supabase?)
- **Admin**: À vérifier (flags isAdmin dans users table)
- **Signature**: Pas d'auth (lien partagé)

## 📝 Fichiers Partagés

```
lib/
├── supabase-client.js   - Client Supabase (queries)
├── db.js                - Legacy JSON DB (à remplacer)
├── worker-auth.js       - Password hashing
├── mailer.js            - Emails
└── client-api.js        - Frontend API calls
```

## 🚨 Points Importants

1. **Supabase credentials** dans `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

2. **RLS policies** assurent l'isolation des données par user

3. **Turbo** gère les builds et dev mode pour toutes les apps

4. **Port** principal = 3000, autres apps comme routes/dossiers

## 🔄 Workflow

1. Développement: `npm run dev` (toutes les apps)
2. Push sur branches respectives
3. PR vers main
4. Merge et deploy

## 📦 Dépendances

Partagées au niveau root:
- `next`, `react` - Framework
- `@supabase/supabase-js` - Client DB
- `dotenv` - Config

Chaque subfolder peut avoir ses propres dépendances dans son package.json.

## 🌐 Déploiement

### Production

Chaque app est déployée séparément:
- App principale: Vercel (koji-web)
- Signature: Sous-route /signature/*
- Admin: Sous-route /admin/*
- Worker: Séparé? ou sous-route /worker/*?

Supabase: Un seul projet partagé
