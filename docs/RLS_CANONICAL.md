# RLS canonique — Kôji

La migration `supabase/migrations/0013_rls_canonical.sql` est la référence pour les droits d'accès multi-utilisateur. Les scripts historiques de `admin/` et `signature/` ne doivent plus être exécutés tels quels.

## Scripts à ne plus exécuter

- `admin/ADMIN_ACCESS_ALL_DATA.sql` : ouvre `users` et `quotes` à tous les comptes authentifiés.
- `admin/RESTRICT_ACCESS_TO_ADMIN.sql` : casse l'accès pour les utilisateurs normaux.
- `admin/RLS_FIX_USERS_QUOTES.sql` : ancien correctif, remplacé par `0013`.
- `signature/fix_signature_policy.sql` : permet de modifier des devis sans contrôle réel.
- `admin/supabase_fournitures_setup.sql` : ouvre fournisseurs et fournitures à tous les comptes authentifiés.
- `admin/supabase_storage_setup.sql` : permet à tout compte authentifié de modifier/supprimer n'importe quel objet du bucket `products`.

## Vérification recommandée

1. Exécuter `0013_rls_canonical.sql` sur une base de test.
2. Vérifier les policies :

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('users', 'quotes', 'fournisseurs', 'fournitures')
order by tablename, policyname;
```

3. Tester avec deux comptes distincts :
   - le compte A ne voit pas les devis du compte B ;
   - le compte A ne peut pas modifier `is_admin`, `account_type`, `portal_identifier`, `is_active` ou `_billingPlan` ;
   - le compte A ne peut pas modifier/supprimer les fournisseurs du compte B ;
   - un compte anonyme ne peut pas signer un devis sans l'e-mail correspondant ;
   - une signature existante ne peut pas être écrasée.
4. Vérifier les policies Storage :

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```

## Remarques

- Les migrations numérotées sont la source de vérité.
- Les scripts historiques restent dans le dépôt pour référence uniquement.
- Cette migration ne corrige pas à elle seule les routes applicatives : elle complète les correctifs P0 déjà mergés.
