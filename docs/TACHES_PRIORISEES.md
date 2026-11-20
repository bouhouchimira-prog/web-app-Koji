# Tâches priorisées — Kôji (monorepo)

Document Agile de pilotage des travaux restants, par priorité (P0 bloquant → P3
amélioration), avec urgence/importance, dépendances et résultat attendu.
Mise à jour : 20 novembre 2026.

## Légende

- **Priorité** : P0 bloquant (sécurité / production), P1 important, P2 valeur
  métier, P3 amélioration / dette technique.
- **Urgence** : Immédiate / Court terme / Moyen terme / Long terme.
- **Importance** : Critique / Élevée / Moyenne / Faible.
- **Effort** : S (<1j), M (1-3j), L (1-2 sem.), XL (>2 sem.).
- **Dépendances** : IDs des tâches préalables.

## État synthétique

- P0-1 à P0-5 terminés et mergés (PR #51-#54 + PR #55 mergée localement :
  migration 0013 dans `main`).
- P0-6 préparé et commité (`0015_storage_canonical.sql` + tests). Application sur
  la base Supabase et test A/B (P0-7) restent à exécuter manuellement.
- Migration 0013 appliquée sur le **projet Supabase de base Kôji** (projet
  principal, pas un projet de test) ; nettoyage des policies héritées fait sur
  `users`, `quotes`, `fournisseurs`, `fournitures`. Le bucket `products` est
  durci ; les autres buckets restent permissifs → P0-6.
- Validation : 496 tests web, Flutter analyze 0, 340 tests mobile, build Next OK,
  endpoint export RGPD renvoie 401.

## P0 — Sécurité & données (bloquant production)

| ID | Tâche | Priorité | Urgence | Importance | Effort | Dépendances | Résultat attendu |
|---|---|---|---|---|---|---|---|
| P0-5b | Décider et merger la PR #55 (migration 0013 RLS canonique) | P0 | Immédiate | Critique | S | — | 0013 dans `main`, historique propre, déploiement traçable |
| P0-6 | Durcir les policies Storage des buckets non-`products` (SQL 0015) | P0 | Immédiate | Critique | M | P0-5b | Chaque bucket limité au propriétaire (+admin) ; plus d'accès croisé entre comptes |
| P0-6b | Appliquer 0015 sur le projet Supabase de base et vérifier | P0 | Immédiate | Critique | S | P0-6 | Policies actives en base ; test SELECT sur `storage.objects` conforme |
| P0-7 | Tester le RLS avec deux comptes distincts (A/B) | P0 | Court terme | Critique | M | P0-5b, P0-6b | Grille de vérification verte (devis, users, fournisseurs, storage) |
| P0-8 | Nettoyer les buckets orphelins / non utilisés | P2 | Moyen terme | Moyenne | S | P0-6 | Liste de buckets à supprimer documentée, pas de régression |

### Détail P0-6 (actif)

Buckets vérifiés dans le code (web + mobile + admin + signature) et préfixes de
chemin : voir le commentaire en tête de `supabase/migrations/0015_storage_canonical.sql`.

- **Privés** (lecture restreinte au propriétaire) : `quote_attachments`,
  `worker-uploads`, `worker_docs`, `chantier-attachments`, `chantier_documents`,
  `task_images`, `intervention-signatures`.
- **Publics** (lecture publique conservée, écriture propriétaire) :
  `business-logos`, `signatures`, `fourniture-images`, `fournitures`, `products`.

Vérification post-application :

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

### Détail P0-7 — grille de test A/B

- A ne voit pas les devis de B (SELECT `quotes`).
- A ne peut pas modifier `is_admin`, `account_type`, `portal_identifier`,
  `is_active`, `_billingPlan` (trigger `protect_sensitive_user_fields`).
- A ne peut pas modifier/supprimer les fournisseurs et fournitures de B.
- Anonyme ne peut pas signer sans l'e-mail correspondant.
- Signature existante non écrasable.
- A ne peut pas lire/écrire/supprimer les objets Storage de B dans les buckets
  privés.

## P1 — Fiabilité & cohérence (important, court terme)

| ID | Tâche | Priorité | Urgence | Importance | Effort | Dépendances | Résultat attendu |
|---|---|---|---|---|---|---|---|
| P1-1 | Ajouter un workflow CI web (unit tests + build Next) | P1 | Court terme | Élevée | M | — | Push/PR déclenchent `npm test` et `next build` |
| P1-2 | Corriger `lib/subscription-store.js` (checks admin Supabase) | P1 | Court terme | Élevée | M | P0-5b | Plans/abonnements fiables, plus de faux positifs admin |
| P1-3 | Réparer `lib/user-store.js` (adaptateur) | P1 | Court terme | Élevée | M | P0-5b | CRUD utilisateurs cohérent web/mobile |
| P1-4 | Réduire le risque de concurrence sur `lib/db.js` (blob JSON) | P1 | Moyen terme | Élevée | L | — | Verrouillage/transaction ou migration table par table |
| P1-5 | Finaliser `packages/koji-shared` (sortir du squelette) | P1 | Moyen terme | Moyenne | L | P1-1 | Suppression des copies `lib/supabase*.js` dans worker/signature/admin |
| P1-6 | Aligner les versions Next.js (15 vs 16) entre apps | P1 | Moyen terme | Moyenne | M | P1-5 | Workspaces possibles sans casse |

## P2 — Valeur métier (Phase 4)

| ID | Tâche | Priorité | Urgence | Importance | Effort | Dépendances | Résultat attendu |
|---|---|---|---|---|---|---|---|
| P2-1 | Catalogue d'ouvrages unifié web ↔ mobile (table Supabase) | P2 | Moyen terme | Élevée | M | — | Source unique, plus de divergence de prix |
| P2-2 | Observabilité : Sentry web + mobile + logs structurés | P2 | Moyen terme | Moyenne | M | P1-1 | Crash reporting et traçabilité des routes API |
| P2-3 | Migration des ouvriers legacy vers le portail intégré | P2 | Moyen terme | Moyenne | M | — | Script de migration + doc, plus de dépendance `worker/` |
| P2-4 | Push notifications distantes (FCM/APNs) | P2 | Long terme | Moyenne | XL | P1-1 | Push réels sur événements (message, devis) |
| P2-5 | Offline-first robuste (cache + queue) | P2 | Long terme | Moyenne | XL | — | Consultation hors ligne des données critiques |

## P3 — Consolidation monorepo & CI

| ID | Tâche | Priorité | Urgence | Importance | Effort | Dépendances | Résultat attendu |
|---|---|---|---|---|---|---|---|
| P3-1 | Workspaces npm (root) | P3 | Long terme | Faible | M | P1-6 | `npm install` unique, builds reproductibles |
| P3-2 | Turbo + pipelines dev/build/lint/test | P3 | Long terme | Faible | M | P3-1 | Orchestration unifiée |
| P3-3 | CI unifié (web + mobile en parallèle) | P3 | Long terme | Moyenne | M | P1-1, P3-1 | Un workflow pour tout le monorepo |
| P3-4 | `.env.example` racine documenté | P3 | Moyen terme | Faible | S | — | Onboarding facilité |

## Ordre d'exécution recommandé

1. **P0-5b** → merger la PR #55.
2. **P0-6 / P0-6b** → appliquer le durcissement Storage.
3. **P0-7** → valider le RLS avec deux comptes.
4. **P1-1** → CI web (sécurise les futurs changements).
5. **P1-2, P1-3** → corrections store.
6. **P2-1, P2-2** → valeur métier + observabilité.
7. **P3-*** → consolidation (quand les versions sont alignées).

## Notes

- Les migrations SQL sont la source de vérité ; les scripts historiques dans
  `admin/` et `signature/` ne doivent plus être exécutés tels quels.
- Toute nouvelle route API doit respecter la checklist de `docs/P0_AUDIT_FINDINGS.md`
  (contrôle d'identité serveur, pas d'IDOR sur le stockage JSON).
- Les buckets Storage non listés dans la cartographie P0-6 doivent être audités
  avant création (principe : par défaut privé, owner-scoped).
