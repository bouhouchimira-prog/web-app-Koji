import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/quote/providers/quote_message_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart';
import 'package:koji/features/quote/repositories/quote_message_repository.dart';

/// Global inbox listing every devis conversation in one place, with the latest
/// message preview and an unread indicator for new client messages. Tapping a
/// row opens that devis' chat (/quote/messages).
class QuoteMessagesInboxScreen extends ConsumerStatefulWidget {
  const QuoteMessagesInboxScreen({super.key});

  @override
  ConsumerState<QuoteMessagesInboxScreen> createState() =>
      _QuoteMessagesInboxScreenState();
}

class _QuoteMessagesInboxScreenState
    extends ConsumerState<QuoteMessagesInboxScreen> {
  static const _navy = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Veuillez vous connecter')),
      );
    }

    final quotesAsync = ref.watch(userQuotesProvider(user.id));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: quotesAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Erreur: $e', textAlign: TextAlign.center),
                  ),
                ),
                data: (quotes) => _InboxList(quotes: quotes),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      color: const Color(0xFFF5F0EB),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.chevron_left_rounded,
                color: _navy, size: 30),
          ),
          const SizedBox(width: 4),
          const Text(
            'Messages',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _navy,
            ),
          ),
        ],
      ),
    );
  }
}

/// Loads message summaries for the given quotes + the "seen" timestamps, then
/// renders the conversation list. Pulled into its own widget so it can manage
/// the async summary load while the quotes stream stays live above it.
class _InboxList extends ConsumerStatefulWidget {
  const _InboxList({required this.quotes});

  final List<Map<String, dynamic>> quotes;

  @override
  ConsumerState<_InboxList> createState() => _InboxListState();
}

class _InboxListState extends ConsumerState<_InboxList> {
  static const _navy = Color(0xFF0F172A);
  static const _gold = Color(0xFFA18B73);
  static const _notifiedMessagesKey = 'notified_client_message_at';

  bool _loading = true;
  Map<String, QuoteMessageSummary> _summaries = const {};
  Map<String, String> _seenAt = const {};
  String _companyEmail = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _InboxList oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reload summaries if the set of quotes changed (e.g. a new devis).
    if (oldWidget.quotes.length != widget.quotes.length) _load();
  }

  Future<void> _load() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;

    // Company email (to tell our own messages from the client's).
    _companyEmail = user.email ?? '';
    try {
      final userData = await ref.read(userRepositoryProvider).getUser(user.id);
      final biz = userData?['business_info'] as Map<String, dynamic>?;
      final emailPro = (biz?['emailPro'] as String?)?.trim() ?? '';
      if (emailPro.isNotEmpty) _companyEmail = emailPro;
    } catch (_) {/* keep fallback */}

    final quoteIds = widget.quotes
        .map((q) => (q['id'] ?? '').toString())
        .where((id) => id.isNotEmpty)
        .toList();

    Map<String, QuoteMessageSummary> summaries = const {};
    try {
      summaries = await ref
          .read(quoteMessageRepositoryProvider)
          .messageSummariesForQuotes(quoteIds, _companyEmail);
    } catch (_) {/* messaging unavailable — show empty */}

    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getStringList(_notifiedMessagesKey) ?? <String>[];
    final seen = <String, String>{};
    for (final e in stored) {
      final i = e.indexOf('=');
      if (i > 0) seen[e.substring(0, i)] = e.substring(i + 1);
    }

    if (!mounted) return;
    setState(() {
      _summaries = summaries;
      _seenAt = seen;
      _loading = false;
    });
  }

  /// Persist that this quote's latest client message has been seen, so the
  /// unread dot clears here and the home screen won't re-alert.
  Future<void> _markSeen(String quoteId, String? lastClientAt) async {
    if (lastClientAt == null) return;
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getStringList(_notifiedMessagesKey) ?? <String>[];
    final seen = <String, String>{};
    for (final e in stored) {
      final i = e.indexOf('=');
      if (i > 0) seen[e.substring(0, i)] = e.substring(i + 1);
    }
    seen[quoteId] = lastClientAt;
    await prefs.setStringList(
      _notifiedMessagesKey,
      seen.entries.map((e) => '${e.key}=${e.value}').toList(),
    );
    if (mounted) setState(() => _seenAt = seen);
  }

  bool _isUnread(QuoteMessageSummary s) {
    final lastClient = s.lastClientAt;
    if (lastClient == null) return false; // no client message -> nothing unread
    final seen = _seenAt[s.quoteId];
    return seen == null || lastClient.compareTo(seen) > 0;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Build the rows: only quotes that have at least one message, newest first.
    final clientNameById = <String, String>{};
    for (final q in widget.quotes) {
      final id = (q['id'] ?? '').toString();
      final client = q['client'] as Map<String, dynamic>? ?? {};
      final name = (client['name'] as String?)?.trim();
      final ref = (q['quoteNumber'] as String?)?.trim();
      clientNameById[id] = (name != null && name.isNotEmpty)
          ? name
          : (ref != null && ref.isNotEmpty ? ref : 'Client');
    }

    final rows = _summaries.values.toList()
      ..sort((a, b) => b.lastAt.compareTo(a.lastAt));

    if (rows.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: rows.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        thickness: 1,
        color: Colors.black.withValues(alpha: 0.05),
        indent: 76,
      ),
      itemBuilder: (context, i) {
        final s = rows[i];
        final clientName = clientNameById[s.quoteId] ?? 'Client';
        return _buildTile(s, clientName);
      },
    );
  }

  Widget _buildTile(QuoteMessageSummary s, String clientName) {
    final unread = _isUnread(s);
    final preview = s.lastText.trim().isEmpty
        ? '📎 Pièce jointe'
        : '${s.lastFromCompany ? 'Vous : ' : ''}${s.lastText.trim()}';

    return InkWell(
      onTap: () {
        _markSeen(s.quoteId, s.lastClientAt);
        context.push('/quote/messages', extra: {
          'quoteId': s.quoteId,
          'clientName': clientName,
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        color: Colors.transparent,
        child: Row(
          children: [
            // Avatar with client initial.
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                clientName.isNotEmpty ? clientName[0].toUpperCase() : '?',
                style: const TextStyle(
                  color: _gold,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          clientName,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight:
                                unread ? FontWeight.bold : FontWeight.w600,
                            color: _navy,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _formatTime(s.lastAt),
                        style: TextStyle(
                          fontSize: 11,
                          color: unread ? _gold : const Color(0xFF94A3B8),
                          fontWeight:
                              unread ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: unread
                                ? _navy
                                : const Color(0xFF64748B),
                            fontWeight:
                                unread ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                      ),
                      if (unread) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 10,
                          height: 10,
                          decoration: const BoxDecoration(
                            color: _gold,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.forum_outlined, color: _gold, size: 30),
            ),
            const SizedBox(height: 16),
            const Text(
              'Aucune conversation',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: _navy,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Les échanges avec vos clients sur les devis apparaîtront ici.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      final sameDay =
          dt.year == now.year && dt.month == now.month && dt.day == now.day;
      return sameDay
          ? DateFormat('HH:mm').format(dt)
          : DateFormat('dd/MM').format(dt);
    } catch (_) {
      return '';
    }
  }
}
