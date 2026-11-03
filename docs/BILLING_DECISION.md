# Décision billing — Web (Stripe) vs Mobile (stores)

## État actuel

- **Web** : abonnement via Stripe (lib/stripe.js, app/api/billing/*, app/api/webhooks/stripe*).
  Plans : pro / premium / business, mensuel ou annuel. Portail abonnement : app/parametres/abonnement.
- **Mobile** : abonnement via `in_app_purchase` (Play Billing 8 / StoreKit).
  Plans : go / premium / business (lib/features/subscription/*).
- Les deux systèmes écrivent dans des tables/champs différents et ne se synchronisent pas.

## Options

### Option A — Stripe partout (recommandé pour B2B)
- Mobile utilise Stripe Checkout via WebView ou Payment Sheet.
- Avantage : une seule source de vérité, pas de commission store (30%).
- Inconvénient : Apple/Google peuvent rejeter l'app si la fonctionnalité est
  "digitale" et non "physique" (règle des stores). Risque de rejet App Store.

### Option B — Stores partout (conforme stores)
- Web utilise Stripe pour les paiements web, mobile utilise IAP.
- Nécessite une réconciliation serveur : webhook Stripe + webhook stores →
  table `subscriptions` commune avec `source` ('stripe' | 'apple' | 'google').
- Avantage : conforme aux règles des stores.
- Inconvénient : complexité de réconciliation, deux flux de paiement.

### Option C — Hybride documenté (statu quo amélioré)
- Garder les deux systèmes mais documenter clairement lequel s'applique à
  quelle plateforme, et ajouter un champ `billing_source` dans `users`.
- Pas de réconciliation automatique.

## Recommandation

Option B pour la conformité stores, avec une table `subscriptions` commune
(`user_id`, `plan`, `status`, `source`, `expires_at`, `created_at`) alimentée
par les webhooks Stripe et stores. Le mobile et le web lisent cette table
pour déterminer l'accès (remplaçant `subscription_provider.dart` et
`lib/plan.js`).

## Actions si Option B retenue

- [ ] Créer la table `subscriptions` (migration SQL).
- [ ] Webhook Stripe → upsert `subscriptions` (source='stripe').
- [ ] Webhook App Store / Play → upsert `subscriptions` (source='apple'/'google').
- [ ] Mobile : lire `subscriptions` au lieu de l'état local IAP.
- [ ] Web : lire `subscriptions` au lieu de Stripe direct.
- [ ] Supprimer la logique dupliquée (plan.js, subscription_repository.dart).
