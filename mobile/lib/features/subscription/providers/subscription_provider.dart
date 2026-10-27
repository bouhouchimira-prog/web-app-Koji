import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/features/subscription/data/subscription_repository.dart';

final subscriptionRepositoryProvider =
    Provider<SubscriptionRepository>((ref) {
  return SubscriptionRepository(SupabaseConfig.client);
});

/// Resolves and caches the current access status (trial / subscribed / expired)
/// for the signed-in entreprise. Re-fetched after a purchase via [refresh].
class SubscriptionStatusNotifier
    extends StateNotifier<AsyncValue<SubscriptionStatus>> {
  SubscriptionStatusNotifier(this._repo)
      : super(const AsyncValue.loading());

  final SubscriptionRepository _repo;

  Future<void> load() async {
    final userId = SupabaseConfig.client.auth.currentUser?.id;
    if (userId == null) {
      state = const AsyncValue.data(SubscriptionStatus.unknown);
      return;
    }
    state = const AsyncValue.loading();
    try {
      final status = await _repo.resolveStatus(userId);
      state = AsyncValue.data(status);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// After a purchase/restore is persisted, re-read the status so the gate
  /// reopens immediately.
  Future<void> refresh() => load();
}

final subscriptionStatusProvider = StateNotifierProvider<
    SubscriptionStatusNotifier, AsyncValue<SubscriptionStatus>>((ref) {
  return SubscriptionStatusNotifier(
      ref.watch(subscriptionRepositoryProvider));
});

/// Convenience: true when the entreprise may use gated features (trial active
/// OR subscribed). Defaults to true while still loading/unknown so we never
/// block on a transient state — the explicit `expired` state is what gates.
final hasAccessProvider = Provider<bool>((ref) {
  final async = ref.watch(subscriptionStatusProvider);
  return async.maybeWhen(
    data: (s) => s.state != AccessState.expired,
    orElse: () => true,
  );
});

/// Plan-limit checks (quote-count per plan, trial send/generate/edit caps).
/// Call before quote creation/send/generate/manual-save; on `allowed: false`
/// show `reason` in a blocking dialog (mirrors how hasAccessProvider/paywall
/// gating already blocks screens).
///
/// Wired in: quote_detail_screen.dart's _generateQuote() calls
/// canCreateQuote()/canSaveQuote() before every save (new devis vs. manual
/// save on an existing one). NOT yet wired: canSendQuote()/canGenerateQuote()
/// — those belong in the PDF/share/send flow (quote_success_screen.dart),
/// which wasn't touched in this pass.
final planLimitsProvider = Provider<_PlanLimits>((ref) {
  return _PlanLimits(ref.watch(subscriptionRepositoryProvider));
});

class _PlanLimits {
  _PlanLimits(this._repo);
  final SubscriptionRepository _repo;

  String? get _userId => SupabaseConfig.client.auth.currentUser?.id;

  Future<PlanLimitResult> canCreateQuote() async {
    final uid = _userId;
    if (uid == null) return const PlanLimitResult(allowed: true);
    return _repo.checkQuoteCreationLimit(uid);
  }

  Future<PlanLimitResult> canSendQuote(String quoteId) async {
    final uid = _userId;
    if (uid == null) return const PlanLimitResult(allowed: true);
    return _repo.checkTrialSendLimit(uid, quoteId);
  }

  Future<PlanLimitResult> canGenerateQuote(String quoteId) async {
    final uid = _userId;
    if (uid == null) return const PlanLimitResult(allowed: true);
    return _repo.checkTrialGenerateLimit(uid, quoteId);
  }

  Future<PlanLimitResult> canSaveQuote(String quoteId) async {
    final uid = _userId;
    if (uid == null) return const PlanLimitResult(allowed: true);
    return _repo.checkAndRecordTrialEdit(uid, quoteId);
  }
}
