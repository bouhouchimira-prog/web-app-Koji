# Worker.Koji - Espace Ouvrier (DÉPRÉCIÉ)

> ⚠️ **Cette sous-application est dépréciée.** Le portail ouvrier intégré au
> main app (`app/worker`, `app/api/worker-portal`, `lib/worker-portal.js`)
> est la version maintenue et sécurisée (cookies HttpOnly, scrypt, session
> vérifiée). Voir `docs/WORKER_APP_AUDIT.md`.
>
> Cette sous-app sera supprimée après migration des utilisateurs.

# Worker.Koji - Espace Ouvrier (legacy)

Plateforme dédiée aux ouvriers pour gérer leurs interventions et tâches.

## 🚀 Démarrage

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## 📁 Structure

```
app/
├── login/              - Page de connexion
├── dashboard/          - Tableau de bord ouvrier
├── api/
│   ├── auth/           - Authentification
│   └── worker/         - API ouvrier
└── globals.css         - Styles globaux

lib/
└── supabase-client.js  - Client Supabase (à créer)
```

## 🔐 Authentification

Workers login via email/password. Token stocké dans localStorage.

## 📊 Fonctionnalités (à implémenter)

- [ ] Login ouvrier
- [ ] Dashboard avec tâches assignées
- [ ] Détail tâche
- [ ] Marquer tâche finie
- [ ] Calendrier interventions
- [ ] Messages/communications

## 🗄️ Supabase

Tables nécessaires:
- `workers` - Information ouvrier
- `tasks` - Tâches assignées à un ouvrier
- `worker_messages` - Communications

## 📝 Notes

- Utilise Supabase pour la base de données
- Authentification serveur (cookies)
- Design responsive
