# Unification billing — web (Stripe) ↔ mobile (stores)

## Table `subscriptions` (migration 0008)

Source unique pour l'abonnement d'un utilisateur. Alimentée par :
- Webhooks Stripe (`app/api/webhooks/stripe`, `app/api/webhooks/stripe-connect`)
- Webhooks App Store / Play (à implémenter)

Lue par :
- Web : via `lib/subscription-store.js` (`getSubscriptionForUser`)
- Mobile : via Supabase direct (`subscriptions` table, RLS `subscriptions_own_read`)

## Adapter `lib/subscription-store.js`

- `getSubscriptionForUser(userId)` : lit l'abonnement actif le plus récent.
- `upsertSubscription(sub)` : écrit (upsert sur `user_id, source`).
- `listActiveSubscriptions()` : liste pour l'admin.

## Prochaines étapes (à faire dans des sessions dédiées)

1. **Webhook Stripe** : upsert dans `subscriptions` (source='stripe') au lieu de
   n'écrire que dans `business_info` / `_billingPlan`.
2. **Webhook App Store / Play** : créer les endpoints et upsert (source='apple'/'google').
3. **Web** : `lib/plan.js` lit `subscriptions` au lieu de Stripe direct.
4. **Mobile** : `subscription_repository.dart` lit `subscriptions` au lieu de l'état IAP local.
5. **Migration** : porter les abonnements existants (Stripe) dans `subscriptions`.
6. **Supprimer** la logique dupliquée une fois la migration validée.

## Effort estimé
Plusieurs sessions. À faire par étapes avec des PRs atomiques.
