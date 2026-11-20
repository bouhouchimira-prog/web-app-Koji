# RLS canonique — Kôji

La migration `supabase/migrations/0013_rls_canonical.sql` est la référence pour les
droits d'accès multi-utilisateur (tables `users`, `quotes`, `fournisseurs`,
`fournitures` et bucket Storage `products`).

Le lot P0-6 (Storage) comprend deux migrations :
- `supabase/migrations/0015_storage_canonical.sql` : ajoute les policies canoniques
  (owner-scoped) pour les autres buckets.
- `supabase/migrations/0016_storage_legacy_cleanup.sql` : supprime les anciennes
  policies permissives qui rendaient le durcissement inefficace (les policies
  sont combinées par OR).

Les scripts historiques de `admin/` et `signature/` ne doivent plus être exécutés
tels quels.

## Scripts à ne plus exécuter

- `admin/ADMIN_ACCESS_ALL_DATA.sql` : ouvre `users` et `quotes` à tous les comptes authentifiés.
- `admin/RESTRICT_ACCESS_TO_ADMIN.sql` : casse l'accès pour les utilisateurs normaux.
- `admin/RLS_FIX_USERS_QUOTES.sql` : ancien correctif, remplacé par `0013`.
- `signature/fix_signature_policy.sql` : permet de modifier des devis sans contrôle réel.
- `admin/supabase_fournitures_setup.sql` : ouvre fournisseurs et fournitures à tous les comptes authentifiés.
- `admin/supabase_storage_setup.sql` : permet à tout compte authentifié de modifier/supprimer n'importe quel objet du bucket `products`.

## Vérification recommandée

1. Exécuter `0013`, puis `0015`, puis `0016` sur une base de test.
2. Vérifier les policies :

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('users', 'quotes', 'fournisseurs', 'fournitures')
order by tablename, policyname;
```

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

3. Tester avec deux comptes distincts (voir `docs/RLS_AB_VERIFICATION_FILLED.sql`).
4. Après `0016`, vérifier qu'aucune policy permissive héritée ne subsiste (voir la
   requête de vérification en fin de `0016`).

## Remarques

- Les migrations numérotées sont la source de vérité.
- Les scripts historiques restent dans le dépôt pour référence uniquement.
- Cette migration ne corrige pas à elle seule les routes applicatives : elle complète les correctifs P0 déjà mergés.
- Les buckets non-Kôji (`documents`, `logos`, `photos`, `items`, `profiles`, `menu-images`) n'ont pas été touchés par `0016` ; audit séparé à prévoir.
