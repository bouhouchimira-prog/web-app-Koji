import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/app/koji_pro_api.dart';

/// Access state of the signed-in entreprise.
///
/// Koji Pro sells nothing inside the app (decided 2026-11-09, App Store
/// guideline 3.1.3(f) "free stand-alone app" companion to the paid web
/// service): the subscription is taken on getkoji.io (Stripe) and the app
/// only reflects it. There is therefore no "expired" state that would lock
/// the app — exactly like the website, an account without a paid plan stays
/// on the trial plan, whose usage caps are enforced server-side.
enum AccessState {
  /// No paid plan: the website's "trial" plan (usage caps, no time limit).
  trial,

  /// Paid plan active on the website.
  subscribed,

  /// Couldn't determine yet (still loading or offline).
  unknown,
}

class SubscriptionStatus {
  final AccessState state;

  /// Plan id as computed by koji-web (lib/user-profile.js buildWebUser):
  /// 'trial' | 'pro' | 'business' | … — null while unknown.
  final String? plan;

  const SubscriptionStatus({required this.state, this.plan});

  bool get hasAccess => state != AccessState.unknown;

  static const unknown = SubscriptionStatus(state: AccessState.unknown);

  /// Maps koji-web's plan id to the app's access state. Any plan other than
  /// "trial" (or empty) is a paid one: the website grants full access to
  /// "pro", "business" and to the legacy "premium" / "active" / "subscribed".
  factory SubscriptionStatus.fromWebPlan(String? plan) {
    final p = (plan ?? '').trim().toLowerCase();
    if (p.isEmpty || p == 'trial') {
      return const SubscriptionStatus(state: AccessState.trial, plan: 'trial');
    }
    return SubscriptionStatus(state: AccessState.subscribed, plan: p);
  }
}

/// Result of a server-side plan-limit RPC check (see
/// supabase/migrations/0006_subscription_plans.sql). [allowed] mirrors web's
/// lib/plan.js `{ allowed, reason }` shape.
class PlanLimitResult {
  final bool allowed;
  final String? reason;

  const PlanLimitResult({required this.allowed, this.reason});
}

/// Reads the entreprise's plan from koji-web — the same value the website
/// uses — and runs the trial usage-cap checks (Supabase RPCs shared with the
/// web's lib/plan.js rules).
class SubscriptionRepository {
  SubscriptionRepository(this._supabase, this._api);

  final SupabaseClient _supabase;
  final KojiProApi _api;

  /// Current access status, from GET /api/auth/profile (Bearer token): the
  /// plan there is resolved by koji-web from the Stripe subscription
  /// (business_info._billingPlan), the grandfathered flag or "trial".
  Future<SubscriptionStatus> resolveStatus() async {
    try {
      final body = await _api.get('/api/auth/profile');
      final user = body['user'];
      if (user is! Map) return SubscriptionStatus.unknown;
      return SubscriptionStatus.fromWebPlan(user['plan'] as String?);
    } catch (e) {
      debugPrint('resolveStatus failed: $e');
      // Never lock anyone out on a network error: "unknown" is not gated.
      return SubscriptionStatus.unknown;
    }
  }

  // ── Server-side trial usage caps (shared with web via the same RPCs) ─────

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
}
