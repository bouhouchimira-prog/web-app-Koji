import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/home/notifications/models/notification_model.dart';
import 'package:koji/features/home/notifications/providers/notification_provider.dart';
import 'package:koji/features/home/notifications/repositories/notification_repository.dart';
import 'package:koji/features/quote/models/quote_status.dart';
import 'package:koji/features/quote/providers/quote_message_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/subscription/providers/subscription_provider.dart';

/// Background activity of the entreprise session — previously run by the home
/// screen, now hosted by the app shell so it keeps running whichever page is
/// open (on the web layout the side menu replaces pages instead of stacking
/// them over the home screen):
///  • starts the trial / loads the subscription status,
///  • raises a notification when a client signs a devis,
///  • polls for new client messages and worker reports.
class EntrepriseActivityWatcher extends ConsumerStatefulWidget {
  const EntrepriseActivityWatcher({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<EntrepriseActivityWatcher> createState() =>
      _EntrepriseActivityWatcherState();
}

class _EntrepriseActivityWatcherState
    extends ConsumerState<EntrepriseActivityWatcher> {
  static const _notifiedSignaturesKey = 'notified_signed_quote_ids';
  // Guards the very first stream emission: on cold start every already-signed
  // quote would otherwise look "new". We seed the persisted set on first run
  // instead of spamming the user with historical signatures.
  bool _signatureBaselineDone = false;

  // Same idea for inbound client messages: remember the latest client-message
  // timestamp we have already alerted per quote, and skip the noisy toast on
  // the first emission after launch.
  static const _notifiedMessagesKey = 'notified_client_message_at';
  bool _messageBaselineDone = false;
  // The company's own email, used to tell our outbound messages from the
  // client's so we only get notified about the client's replies.
  String _companyEmail = '';
  // The quotes provider changes on quote updates, not on new messages — so it
  // can't be the only trigger for message notifications. We cache the latest
  // quotes and poll for new client messages on a timer while the app is open.
  List<Map<String, dynamic>> _latestQuotes = const [];
  Timer? _messagePollTimer;
  // Guards against the listener and the poll timer running the message check
  // at the same time (which could double-notify or race on prefs).
  bool _handlingMessages = false;

  // Worker reports (réclamation/retard/blocage/dépassement) sent from the worker
  // space. We poll them on a timer and raise an idempotent bell notification per
  // report. The persisted timestamp is the high-water mark of what we've seen,
  // so reopening the app doesn't re-notify older reports.
  static const _notifiedWorkerReportsKey = 'notified_worker_report_at';
  Timer? _workerReportsPollTimer;
  bool _handlingWorkerReports = false;
  final _chantierRepo = ChantierRepository();

  @override
  void initState() {
    super.initState();
    final user = ref.read(authRepositoryProvider).currentUser;
    if (user == null) return;

    _loadCompanyEmail(user.id);
    // Start the trial (first time) and resolve trial/subscription status so
    // the banner + gate know whether access is active.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(subscriptionStatusProvider.notifier).load();
    });
    ref.listenManual<AsyncValue<List<Map<String, dynamic>>>>(
      userQuotesProvider(user.id),
      (previous, next) {
        final quotes = next.valueOrNull;
        if (quotes != null) {
          _latestQuotes = quotes;
          _handleSignedQuotes(quotes);
          _handleNewMessages(quotes);
        }
      },
      fireImmediately: true,
    );

    // Poll for new client messages independently of the quotes provider so a
    // message raises a notification even when no quote field changes.
    _messagePollTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      if (_latestQuotes.isNotEmpty) _handleNewMessages(_latestQuotes);
    });

    // Poll for new worker reports so a signalement raises a bell notification
    // while the app is open. Fires once now to catch anything sent while closed.
    _handleWorkerReports();
    _workerReportsPollTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _handleWorkerReports();
    });
  }

  @override
  void dispose() {
    _messagePollTimer?.cancel();
    _workerReportsPollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;

  void _openDevisTab() {
    ref.read(entrepriseHomeTabProvider.notifier).state = 1;
    GoRouter.of(context).go('/home');
  }

  /// Fetch worker reports newer than the last seen timestamp and raise an
  /// idempotent bell notification for each. The first run after install (no
  /// stored timestamp) seeds the high-water mark silently so we don't flood the
  /// bell with the entire history.
  Future<void> _handleWorkerReports() async {
    if (_handlingWorkerReports) return;
    _handlingWorkerReports = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final storedIso = prefs.getString(_notifiedWorkerReportsKey);
      final since = storedIso != null ? DateTime.tryParse(storedIso) : null;
      final isBaseline = since == null;

      final reports = await _chantierRepo.getCompanyWorkerReports(since: since);
      if (reports.isEmpty) return;

      DateTime newest = since ?? DateTime.fromMillisecondsSinceEpoch(0);

      for (final r in reports) {
        final createdAt = DateTime.tryParse(r['created_at'] as String? ?? '') ??
            DateTime.now();
        if (createdAt.isAfter(newest)) newest = createdAt;

        // On the first run we only establish the baseline — no bell spam.
        if (isBaseline) continue;

        final id = r['id']?.toString() ?? '';
        if (id.isEmpty) continue;
        final kind = r['kind'] as String? ?? '';
        final worker = (r['worker_name'] as String?)?.trim();
        final ouvrage = (r['ouvrage_title'] as String?)?.trim();
        final chantier = (r['chantier_reference'] as String?)?.trim();
        final msg = (r['message'] as String?)?.trim() ?? '';

        final who =
            (worker != null && worker.isNotEmpty) ? worker : 'Un ouvrier';
        final where = [
          if (ouvrage != null && ouvrage.isNotEmpty) ouvrage,
          if (chantier != null && chantier.isNotEmpty) chantier,
        ].join(' · ');

        await ref.read(notificationRepositoryProvider).addOnce(
              type: NotificationType.workerReport,
              dedupeKey: 'wreport_$id',
              title: '${_reportEmoji(kind)} ${_reportTitle(kind)}',
              message: [
                '$who${where.isNotEmpty ? ' — $where' : ''}',
                if (msg.isNotEmpty) msg,
              ].join('\n'),
            );
        ref.invalidate(notificationsProvider);
      }

      await prefs.setString(
          _notifiedWorkerReportsKey, newest.toUtc().toIso8601String());
    } catch (_) {
      // Worker tables unavailable / not migrated yet — fail quietly.
    } finally {
      _handlingWorkerReports = false;
    }
  }

  String _reportTitle(String kind) => switch (kind) {
        'reclamation' => 'Réclamation reçue',
        'retard' => 'Retard signalé',
        'blocage' => 'Blocage signalé',
        'depassement' => 'Dépassement de temps',
        'commentaire' => 'Nouveau commentaire',
        _ => 'Signalement ouvrier',
      };

  String _reportEmoji(String kind) => switch (kind) {
        'reclamation' => '⚠️',
        'retard' => '⏰',
        'blocage' => '🚧',
        'depassement' => '⏱️',
        'commentaire' => '💬',
        _ => '🔔',
      };

  Future<void> _loadCompanyEmail(String userId) async {
    // Fall back to the auth email until the business profile resolves.
    _companyEmail = ref.read(authRepositoryProvider).currentUser?.email ?? '';
    try {
      final userData = await ref.read(userRepositoryProvider).getUser(userId);
      final biz = userData?['business_info'] as Map<String, dynamic>?;
      final emailPro = (biz?['emailPro'] as String?)?.trim() ?? '';
      if (emailPro.isNotEmpty) _companyEmail = emailPro;
    } catch (_) {
      // Keep the auth-email fallback.
    }
  }

  /// Detect quotes that became signed since we last looked, notify once each.
  ///
  /// Two layers, intentionally separate:
  ///  - The in-app bell notification is created for *every* signed quote that
  ///    doesn't already have one (idempotent by `sign_<quoteId>`), so a
  ///    signature is visible even if the client signed while the app was closed.
  ///  - The noisy OS toast + in-app snackbar only fire for signatures detected
  ///    *while the app is open* (i.e. after the first emission).
  Future<void> _handleSignedQuotes(List<Map<String, dynamic>> quotes) async {
    final signed = quotes.where((q) => QuoteStatus.isSigned(q)).toList();

    final isBaseline = !_signatureBaselineDone;
    _signatureBaselineDone = true;

    final prefs = await SharedPreferences.getInstance();
    final alerted = prefs.getStringList(_notifiedSignaturesKey)?.toSet() ?? {};

    for (final q in signed) {
      final id = (q['id'] ?? '').toString();
      if (id.isEmpty) continue;

      final client = q['client'] as Map<String, dynamic>? ?? {};
      final clientName = (client['name'] as String?)?.trim().isNotEmpty == true
          ? (client['name'] as String)
          : 'Un client';
      final totals = q['totals'] as Map<String, dynamic>? ?? {};
      final amount = (totals['ttc'] as num?)?.toDouble() ?? 0;
      final amountLabel = amount > 0 ? kojiEuro(amount) : null;

      await ref.read(notificationRepositoryProvider).addOnce(
            type: NotificationType.quoteSigned,
            dedupeKey: 'sign_$id',
            quoteId: id,
            title: 'Devis signé ✍️',
            message: amountLabel != null
                ? '$clientName a signé le devis ($amountLabel).'
                : '$clientName a signé le devis.',
          );
      ref.invalidate(notificationsProvider);

      if (!isBaseline && !alerted.contains(id)) {
        await NotificationService.instance.notifySignature(
          quoteId: id,
          clientName: clientName,
          amountLabel: amountLabel,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$clientName a signé un devis ✍️'),
              action: SnackBarAction(label: 'Voir', onPressed: _openDevisTab),
            ),
          );
        }
      }

      alerted.add(id);
    }

    await prefs.setStringList(_notifiedSignaturesKey, alerted.toList());
  }

  /// Detect new inbound (client-authored) messages on the user's devis and
  /// raise a notification once per new message (bell entry idempotent by
  /// `msg_<quoteId>_<createdAt>`, toast only for messages arriving while the
  /// app is open). The latest alerted timestamp per quote is persisted.
  Future<void> _handleNewMessages(List<Map<String, dynamic>> quotes) async {
    if (_handlingMessages) return;
    _handlingMessages = true;
    try {
      await _checkNewMessages(quotes);
    } finally {
      _handlingMessages = false;
    }
  }

  Future<void> _checkNewMessages(List<Map<String, dynamic>> quotes) async {
    // Without the company email we can't tell our own messages from the
    // client's, so we'd wrongly notify on outbound messages. Wait for it.
    if (_companyEmail.trim().isEmpty) return;

    final quoteIds = quotes
        .map((q) => (q['id'] ?? '').toString())
        .where((id) => id.isNotEmpty)
        .toList();
    if (quoteIds.isEmpty) return;

    Map<String, String> latest;
    try {
      latest = await ref
          .read(quoteMessageRepositoryProvider)
          .latestClientMessageAtForQuotes(quoteIds, _companyEmail);
    } catch (_) {
      return; // messaging tables unavailable — fail quietly
    }
    if (latest.isEmpty) {
      _messageBaselineDone = true;
      return;
    }

    final isBaseline = !_messageBaselineDone;
    _messageBaselineDone = true;

    final prefs = await SharedPreferences.getInstance();
    // Stored as "<quoteId>=<iso>" entries (SharedPreferences has no map type).
    final stored = prefs.getStringList(_notifiedMessagesKey) ?? <String>[];
    final seenAt = <String, String>{};
    for (final e in stored) {
      final i = e.indexOf('=');
      if (i > 0) seenAt[e.substring(0, i)] = e.substring(i + 1);
    }

    final nameById = <String, String>{};
    for (final q in quotes) {
      final id = (q['id'] ?? '').toString();
      final client = q['client'] as Map<String, dynamic>? ?? {};
      final name = (client['name'] as String?)?.trim();
      if (id.isNotEmpty) {
        nameById[id] = (name != null && name.isNotEmpty) ? name : 'Un client';
      }
    }

    latest.forEach((quoteId, createdAt) {
      final previous = seenAt[quoteId];
      final isNew = previous == null || createdAt.compareTo(previous) > 0;
      if (!isNew) return;

      final clientName = nameById[quoteId] ?? 'Un client';

      ref
          .read(notificationRepositoryProvider)
          .addOnce(
            type: NotificationType.newMessage,
            dedupeKey: 'msg_${quoteId}_$createdAt',
            quoteId: quoteId,
            title: 'Nouveau message ✉️',
            message: '$clientName vous a envoyé un message sur un devis.',
          )
          .then((_) => ref.invalidate(notificationsProvider));

      if (!isBaseline && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$clientName vous a envoyé un message ✉️'),
            action: SnackBarAction(
              label: 'Voir',
              onPressed: () =>
                  GoRouter.of(context).push('/quote/messages', extra: {
                'quoteId': quoteId,
                'clientName': clientName,
              }),
            ),
          ),
        );
      }

      seenAt[quoteId] = createdAt;
    });

    await prefs.setStringList(
      _notifiedMessagesKey,
      seenAt.entries.map((e) => '${e.key}=${e.value}').toList(),
    );
  }
}
