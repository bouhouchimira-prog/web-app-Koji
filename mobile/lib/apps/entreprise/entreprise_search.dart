import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/apps/entreprise/entreprise_actions.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/models/quote_status.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart';

/// Search across the entreprise's chantiers and devis, opened from the top
/// band ("Rechercher un chantier, un devis…").
Future<void> showEntrepriseSearch(BuildContext context, WidgetRef ref) async {
  final hit = await showDialog<_SearchHit>(
    context: context,
    barrierColor: KojiColors.navyDeep.withValues(alpha: 0.45),
    builder: (_) => const _SearchDialog(),
  );
  if (hit == null || !context.mounted) return;
  if (hit.isQuote) {
    await openSavedQuote(context, ref, hit.row);
  } else {
    openChantier(context, hit.row);
  }
}

class _SearchHit {
  const _SearchHit(this.row, {required this.isQuote});

  final Map<String, dynamic> row;
  final bool isQuote;
}

class _SearchDialog extends ConsumerStatefulWidget {
  const _SearchDialog();

  @override
  ConsumerState<_SearchDialog> createState() => _SearchDialogState();
}

class _SearchDialogState extends ConsumerState<_SearchDialog> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  bool _matches(List<String?> fields, String q) =>
      fields.any((f) => (f ?? '').toLowerCase().contains(q));

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final user = ref.watch(authRepositoryProvider).currentUser;
    final chantiers = user == null
        ? const <Map<String, dynamic>>[]
        : ref.watch(userChantiersProvider(user.id)).valueOrNull ?? const [];
    final quotes = user == null
        ? const <Map<String, dynamic>>[]
        : ref.watch(userQuotesProvider(user.id)).valueOrNull ?? const [];

    final q = _query.text.trim().toLowerCase();
    final foundChantiers = q.isEmpty
        ? chantiers.take(5).toList()
        : chantiers
            .where((c) => _matches([
                  c['title'] as String?,
                  c['reference'] as String?,
                  c['city'] as String?,
                  c['street'] as String?,
                  c['client_email'] as String?,
                ], q))
            .take(8)
            .toList();
    final foundQuotes = q.isEmpty
        ? quotes.take(5).toList()
        : quotes
            .where((d) {
              final client = d['client'] as Map<String, dynamic>? ?? const {};
              return _matches([
                (d['quoteNumber'] ?? d['reference'])?.toString(),
                client['name'] as String?,
                client['email'] as String?,
                d['siteAddress'] as String?,
              ], q);
            })
            .take(8)
            .toList();

    return Dialog(
      alignment: const Alignment(0, -0.6),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620, maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
              child: TextField(
                controller: _query,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Rechercher un chantier, un devis, un client…',
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 16, right: 10),
                    child: KojiIcon(KojiIcons.search, size: 17, color: p.faint),
                  ),
                  prefixIconConstraints:
                      const BoxConstraints(minWidth: 0, minHeight: 0),
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 14),
                children: [
                  _header(context, 'Chantiers', foundChantiers.length),
                  if (foundChantiers.isEmpty)
                    _none(context)
                  else
                    for (final c in foundChantiers)
                      _ResultTile(
                        icon: KojiIcons.chantiers,
                        title: chantierTitle(c),
                        subtitle: chantierPlace(c),
                        trailing: KojiPill(
                          (c['status'] as String?) ?? 'En attente',
                          tone: isChantierActive(c)
                              ? KojiTone.info
                              : KojiTone.green,
                        ),
                        onTap: () => Navigator.pop(
                            context, _SearchHit(c, isQuote: false)),
                      ),
                  const SizedBox(height: 8),
                  _header(context, 'Devis', foundQuotes.length),
                  if (foundQuotes.isEmpty)
                    _none(context)
                  else
                    for (final d in foundQuotes) _quoteTile(context, d),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quoteTile(BuildContext context, Map<String, dynamic> d) {
    final client = d['client'] as Map<String, dynamic>? ?? const {};
    final name = (client['name'] as String?)?.trim();
    final totals = d['totals'] as Map<String, dynamic>? ?? const {};
    final ttc = (totals['ttc'] as num?)?.toDouble() ?? 0;
    final signed = QuoteStatus.isSigned(d);
    return _ResultTile(
      icon: KojiIcons.devis,
      title: (name != null && name.isNotEmpty) ? name : 'Client',
      subtitle:
          '${d['quoteNumber'] ?? d['reference'] ?? ''} · ${kojiEuro(ttc)}',
      trailing: KojiPill(signed ? 'Signé' : 'En cours',
          tone: signed ? KojiTone.green : KojiTone.amber),
      onTap: () => Navigator.pop(context, _SearchHit(d, isQuote: true)),
    );
  }

  Widget _header(BuildContext context, String label, int count) {
    final p = context.koji;
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
      child: Text(
        '${label.toUpperCase()} · $count',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
          color: p.faint,
        ),
      ),
    );
  }

  Widget _none(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(10, 2, 10, 8),
        child: Text('Aucun résultat',
            style: TextStyle(fontSize: 13.5, color: context.koji.muted)),
      );
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  final String icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: p.navActiveBg,
                borderRadius: BorderRadius.circular(11),
              ),
              alignment: Alignment.center,
              child: KojiIcon(icon, size: 18, color: p.heading),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: p.ink)),
                  if (subtitle.isNotEmpty)
                    Text(subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12.5, color: p.muted)),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 10), trailing!],
          ],
        ),
      ),
    );
  }
}
