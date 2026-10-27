import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Store product ids for the entreprise subscription, one pair (monthly/
/// yearly) per named plan tier — mirrors web's 3 plans (lib/plan.js:
/// go/premium/business). These must be created (with the 14-day free trial)
/// in App Store Connect and Google Play Console using EXACTLY these ids.
///
/// NOTE: this replaces the old single `koji_entreprise_monthly`/`_yearly`
/// duo. Store product reconfiguration (3 tiers × monthly/yearly) has real
/// review lead time outside engineering control — kick that off separately;
/// this code change alone does not make the new products purchasable until
/// they exist in both consoles.
class SubscriptionProducts {
  static const goMonthly = 'koji_go_monthly';
  static const goYearly = 'koji_go_yearly';
  static const premiumMonthly = 'koji_premium_monthly';
  static const premiumYearly = 'koji_premium_yearly';
  static const businessMonthly = 'koji_business_monthly';
  static const businessYearly = 'koji_business_yearly';

  static const all = <String>{
    goMonthly,
    goYearly,
    premiumMonthly,
    premiumYearly,
    businessMonthly,
    businessYearly,
  };

  /// Plan tier a product id belongs to, for grouping in the paywall UI.
  static String planOf(String productId) => switch (productId) {
        goMonthly || goYearly => 'go',
        premiumMonthly || premiumYearly => 'premium',
        businessMonthly || businessYearly => 'business',
        _ => 'business',
      };
}

/// Display metadata for the 3 named plans, mirroring web's PLAN_LIMITS
/// (lib/plan.js) labels/quote limits so both apps present identical copy.
class PlanInfo {
  final String id;
  final String label;
  final int? quoteLimit; // null = unlimited
  final List<String> features;

  const PlanInfo({
    required this.id,
    required this.label,
    this.quoteLimit,
    this.features = const [],
  });

  static const go = PlanInfo(
    id: 'go',
    label: 'Koji GO',
    quoteLimit: 4,
    features: ['4 devis par mois', 'Gestion des chantiers', 'Signature en ligne'],
  );
  static const premium = PlanInfo(
    id: 'premium',
    label: 'Koji Premium',
    quoteLimit: 30,
    features: [
      '30 devis par mois',
      'Bibliothèque d\'ouvrages',
      'Suivi des ouvriers',
      'SMS aux clients',
    ],
  );
  static const business = PlanInfo(
    id: 'business',
    label: 'Koji Business',
    quoteLimit: null,
    features: ['Devis illimités', 'Multi-utilisateurs', 'Toutes les fonctionnalités'],
  );

  static const values = [go, premium, business];
}

/// Resolved access state used by the gate.
enum AccessState {
  /// Free trial is still running.
  trial,

  /// Paid subscription is active.
  subscribed,

  /// Trial ended and no active subscription — show the paywall.
  expired,

  /// Couldn't determine yet (still loading).
  unknown,
}

class SubscriptionStatus {
  final AccessState state;
  final DateTime? trialEndsAt;
  final int trialDaysLeft;
  final String? plan; // 'go' | 'premium' | 'business' | null (trial)

  const SubscriptionStatus({
    required this.state,
    this.trialEndsAt,
    this.trialDaysLeft = 0,
    this.plan,
  });

  bool get hasAccess =>
      state == AccessState.trial || state == AccessState.subscribed;

  static const unknown = SubscriptionStatus(state: AccessState.unknown);
}

/// Result of a server-side plan-limit RPC check (see
/// koji-main/supabase/migrations/0006_subscription_plans.sql). [allowed]
/// mirrors web's lib/plan.js `{ allowed, reason }` shape.
class PlanLimitResult {
  final bool allowed;
  final String? reason;

  const PlanLimitResult({required this.allowed, this.reason});
}

/// Single source of truth for the trial + subscription. Talks to Supabase for
/// the persisted state and to the store (`in_app_purchase`) for buying.
class SubscriptionRepository {
  SubscriptionRepository(this._supabase);

  final SupabaseClient _supabase;
  final InAppPurchase _iap = InAppPurchase.instance;

  // ── Trial / status from Supabase ──────────────────────────────────────────

  /// Ensure a trial exists for this entreprise user and return the current
  /// access status. Call this right after an entreprise logs in.
  Future<SubscriptionStatus> resolveStatus(String userId) async {
    try {
      // Start the trial the first time (idempotent server-side).
      await _supabase.rpc('start_trial_if_absent', params: {
        'p_user_id': userId,
      });

      final row = await _supabase
          .from('users')
          .select(
              'trial_ends_at, subscription_status, subscription_expires_at, plan')
          .eq('id', userId)
          .maybeSingle();

      return _statusFromRow(row);
    } catch (e) {
      debugPrint('resolveStatus failed: $e');
      // Fail OPEN during the trial window is impossible to know — fail to
      // "unknown" so the UI can decide (we don't want to wrongly lock people
      // out on a transient network error).
      return SubscriptionStatus.unknown;
    }
  }

  SubscriptionStatus _statusFromRow(Map<String, dynamic>? row) {
    if (row == null) return SubscriptionStatus.unknown;

    final status = (row['subscription_status'] as String?)?.toLowerCase();
    final plan = row['plan'] as String?;
    final now = DateTime.now();

    // Active paid subscription (optionally still within its store expiry).
    if (status == 'active') {
      final exp = DateTime.tryParse(
          (row['subscription_expires_at'] as String?) ?? '');
      if (exp == null || exp.isAfter(now)) {
        return SubscriptionStatus(state: AccessState.subscribed, plan: plan);
      }
    }

    // Otherwise fall back to the trial window.
    final trialEnds =
        DateTime.tryParse((row['trial_ends_at'] as String?) ?? '');
    if (trialEnds != null && trialEnds.isAfter(now)) {
      final daysLeft = trialEnds.difference(now).inHours / 24;
      return SubscriptionStatus(
        state: AccessState.trial,
        trialEndsAt: trialEnds,
        trialDaysLeft: daysLeft.ceil(),
        plan: plan,
      );
    }

    return SubscriptionStatus(
        state: AccessState.expired, trialEndsAt: trialEnds, plan: plan);
  }

  // ── Server-side plan limits (shared with web via the same RPCs) ────────

  /// Paid plans: gate at quote-creation time, counted per calendar month.
  /// Trial users and unlimited plans always return allowed=true.
  Future<PlanLimitResult> checkQuoteCreationLimit(String userId) async {
    final rows = await _supabase
        .rpc('check_quote_creation_limit', params: {'p_user_id': userId});
    return _firstLimitResult(rows);
  }

  /// Trial: only one quote may ever be sent to a client.
  Future<PlanLimitResult> checkTrialSendLimit(
      String userId, String quoteId) async {
    final rows = await _supabase.rpc('check_trial_send_limit',
        params: {'p_user_id': userId, 'p_quote_id': quoteId});
    return _firstLimitResult(rows);
  }

  /// Trial: only the first (or claimed) quote may be generated/previewed as PDF.
  Future<PlanLimitResult> checkTrialGenerateLimit(
      String userId, String quoteId) async {
    final rows = await _supabase.rpc('check_trial_generate_limit',
        params: {'p_user_id': userId, 'p_quote_id': quoteId});
    return _firstLimitResult(rows);
  }

  /// Trial: the one allowed quote can only be manually saved up to 10 times.
  /// Unlike the other checks, this ALSO records the save atomically
  /// server-side (see check_and_record_trial_edit in the migration).
  Future<PlanLimitResult> checkAndRecordTrialEdit(
      String userId, String quoteId) async {
    final rows = await _supabase.rpc('check_and_record_trial_edit',
        params: {'p_user_id': userId, 'p_quote_id': quoteId});
    return _firstLimitResult(rows);
  }

  PlanLimitResult _firstLimitResult(dynamic rows) {
    if (rows is List && rows.isNotEmpty) {
      final row = rows.first as Map<String, dynamic>;
      return PlanLimitResult(
        allowed: row['allowed'] as bool? ?? true,
        reason: row['reason'] as String?,
      );
    }
    return const PlanLimitResult(allowed: true);
  }

  /// Persist a verified purchase result to Supabase.
  Future<void> _persistActive(PurchaseDetails purchase) async {
    final platform = Platform.isIOS ? 'ios' : 'android';
    await _supabase.rpc('set_subscription_status', params: {
      'p_status': 'active',
      'p_platform': platform,
      'p_product': purchase.productID,
      // The store auto-renews; we don't always get an explicit expiry here.
      // Leaving it null means "active until the store says otherwise"; a server
      // webhook (future) can refine this.
      'p_expires_at': null,
    });
  }

  // ── In-App Purchase ───────────────────────────────────────────────────────

  /// Whether the device store is available (e.g. false on an emulator without
  /// Play services, or if IAP is restricted).
  Future<bool> isStoreAvailable() => _iap.isAvailable();

  /// Load the subscription products configured in the stores.
  Future<List<ProductDetails>> loadProducts() async {
    final response = await _iap.queryProductDetails(SubscriptionProducts.all);
    if (response.error != null) {
      debugPrint('queryProductDetails error: ${response.error}');
    }
    return response.productDetails;
  }

  /// Listen to the purchase stream. The caller must keep the subscription and
  /// cancel it on dispose. For each successful/restored purchase we persist the
  /// active status and complete the transaction.
  StreamSubscription<List<PurchaseDetails>> listen({
    required void Function() onActivated,
    required void Function(String message) onError,
  }) {
    return _iap.purchaseStream.listen((purchases) async {
      for (final p in purchases) {
        switch (p.status) {
          case PurchaseStatus.purchased:
          case PurchaseStatus.restored:
            try {
              await _persistActive(p);
              onActivated();
            } catch (e) {
              onError('Activation: $e');
            }
            break;
          case PurchaseStatus.error:
            onError(p.error?.message ?? 'Achat échoué');
            break;
          case PurchaseStatus.canceled:
            onError('Achat annulé');
            break;
          case PurchaseStatus.pending:
            // In progress — nothing to do; UI shows a spinner.
            break;
        }
        if (p.pendingCompletePurchase) {
          await _iap.completePurchase(p);
        }
      }
    });
  }

  /// Start the buy flow for a subscription product.
  Future<void> buy(ProductDetails product) async {
    final param = PurchaseParam(productDetails: product);
    // Subscriptions are non-consumable.
    await _iap.buyNonConsumable(purchaseParam: param);
  }

  /// Restore previous purchases (App Store / Play). Results arrive on the
  /// purchase stream as `restored`.
  Future<void> restore() => _iap.restorePurchases();
}
