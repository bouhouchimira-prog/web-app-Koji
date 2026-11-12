import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;

/// Report / block for content written by other users (App Store guideline
/// 1.2): client messages on a devis and particulier offers on the Radar.
///
/// • Report → POST /api/support/report (existing route: saved in
///   technicalReports and e-mailed to the Koji team), tagged
///   « [Signalement contenu] » so it stands out from technical reports.
/// • Block → kept on the device: the blocked conversation's client messages
///   and notifications are hidden, the blocked offer disappears from the
///   Radar. The Koji team is told of every block (same route) so it can act
///   on the author's account.
class ModerationState {
  const ModerationState({
    this.blockedQuotes = const {},
    this.hiddenOffers = const {},
  });

  /// Devis whose client conversation is blocked.
  final Set<String> blockedQuotes;

  /// Radar offers hidden by the pro.
  final Set<String> hiddenOffers;

  ModerationState copyWith({
    Set<String>? blockedQuotes,
    Set<String>? hiddenOffers,
  }) =>
      ModerationState(
        blockedQuotes: blockedQuotes ?? this.blockedQuotes,
        hiddenOffers: hiddenOffers ?? this.hiddenOffers,
      );
}

class ModerationNotifier extends StateNotifier<ModerationState> {
  ModerationNotifier() : super(const ModerationState()) {
    _load();
  }

  static const _quotesKey = 'moderation_blocked_quotes';
  static const _offersKey = 'moderation_hidden_offers';

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      state = ModerationState(
        blockedQuotes: (prefs.getStringList(_quotesKey) ?? const []).toSet(),
        hiddenOffers: (prefs.getStringList(_offersKey) ?? const []).toSet(),
      );
    } catch (_) {
      // Storage unavailable: start with nothing blocked.
    }
  }

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_quotesKey, state.blockedQuotes.toList());
      await prefs.setStringList(_offersKey, state.hiddenOffers.toList());
    } catch (_) {}
  }

  Future<void> setQuoteBlocked(String quoteId, bool blocked) async {
    final next = {...state.blockedQuotes};
    blocked ? next.add(quoteId) : next.remove(quoteId);
    state = state.copyWith(blockedQuotes: next);
    await _save();
  }

  Future<void> setOfferHidden(String offerId, bool hidden) async {
    final next = {...state.hiddenOffers};
    hidden ? next.add(offerId) : next.remove(offerId);
    state = state.copyWith(hiddenOffers: next);
    await _save();
  }
}

final moderationProvider =
    StateNotifierProvider<ModerationNotifier, ModerationState>(
        (ref) => ModerationNotifier());

/// Reads the blocked devis straight from storage, for code that runs outside
/// the widget tree's lifetime (the activity watcher's timers).
Future<Set<String>> readBlockedQuotes() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(ModerationNotifier._quotesKey) ?? const [])
        .toSet();
  } catch (_) {
    return const {};
  }
}

const reportReasons = [
  'Contenu offensant ou injurieux',
  'Harcèlement ou menace',
  'Arnaque ou fraude',
  'Spam ou publicité',
  'Contenu inapproprié (photos, propos)',
  'Autre',
];

/// What is being reported, for the team's e-mail.
class ReportTarget {
  const ReportTarget({
    required this.kind,
    required this.id,
    required this.label,
    this.excerpt = '',
  });

  /// 'message_devis' | 'offre_radar'
  final String kind;
  final String id;

  /// Human label, e.g. « Conversation du devis avec Dupont ».
  final String label;

  /// The reported text (trimmed), so the team sees it without looking it up.
  final String excerpt;
}

Future<void> _sendToTeam(
  KojiProApi api, {
  required String tag,
  required ReportTarget target,
  required String details,
}) {
  final excerpt = target.excerpt.trim();
  final message = [
    '[$tag] ${target.label}',
    'Type : ${target.kind} · id : ${target.id}',
    if (details.isNotEmpty) details,
    if (excerpt.isNotEmpty)
      'Contenu : « ${excerpt.length > 500 ? '${excerpt.substring(0, 500)}…' : excerpt} »',
  ].join('\n');
  return api.post('/api/support/report', {
    'message': message,
    'accountType': 'entreprise',
    'page': 'koji-pro/${target.kind}/${target.id}',
  });
}

/// Asks for a reason and sends the report. Returns true when sent.
Future<bool> showReportDialog(
  BuildContext context,
  WidgetRef ref,
  ReportTarget target,
) async {
  final api = ref.read(kojiProApiProvider);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final commentController = TextEditingController();
  String? reason;

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setLocal) => AlertDialog(
        title: const Text('Signaler ce contenu'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'L\'équipe Koji examine chaque signalement sous 24 heures et '
                'retire le contenu et son auteur s\'il enfreint nos règles.',
              ),
              const SizedBox(height: 8),
              for (final r in reportReasons)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(reason == r
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked),
                  title: Text(r),
                  onTap: () => setLocal(() => reason = r),
                ),
              TextField(
                controller: commentController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Précisions (facultatif)',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: reason == null ? null : () => Navigator.pop(ctx, true),
            child: const Text('Signaler'),
          ),
        ],
      ),
    ),
  );
  // Not disposed: the dialog's closing animation still uses it (see
  // account_deletion.dart).
  final comment = commentController.text.trim();
  if (confirmed != true || reason == null) return false;

  try {
    await _sendToTeam(
      api,
      tag: 'Signalement contenu',
      target: target,
      details: [
        'Motif : $reason',
        if (comment.isNotEmpty) 'Précisions : $comment',
      ].join('\n'),
    );
    messenger?.showSnackBar(const SnackBar(
      content: Text('Signalement envoyé. Merci, l\'équipe Koji va l\'examiner.'),
    ));
    return true;
  } catch (err) {
    messenger?.showSnackBar(SnackBar(
      content: Text(err is KojiWebApiException
          ? err.message
          : 'Impossible d\'envoyer le signalement. Écrivez à contact@getkoji.io.'),
    ));
    return false;
  }
}

/// Confirms, then blocks (hides on the device and tells the Koji team).
/// Returns true when blocked.
Future<bool> confirmBlock(
  BuildContext context,
  WidgetRef ref, {
  required ReportTarget target,
  required String title,
  required String explanation,
  required Future<void> Function() apply,
}) async {
  final api = ref.read(kojiProApiProvider);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(explanation),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Bloquer'),
        ),
      ],
    ),
  );
  if (confirmed != true) return false;

  await apply();
  messenger?.showSnackBar(const SnackBar(content: Text('Bloqué.')));
  // Best effort: the block already applies on the device.
  _sendToTeam(api, tag: 'Blocage', target: target, details: '')
      .catchError((_) => <String, dynamic>{});
  return true;
}
