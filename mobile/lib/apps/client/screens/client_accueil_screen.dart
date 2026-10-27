import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_quote_helpers.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';

/// Client home: devis to sign, works in progress and quick links.
class ClientAccueilScreen extends ConsumerWidget {
  const ClientAccueilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final quotesAsync = ref.watch(clientQuotesProvider);
    final tasksAsync = ref.watch(clientTasksProvider);
    final quotes = quotesAsync.valueOrNull ?? const [];
    final chantiers = ClientChantier.group(tasksAsync.valueOrNull ?? const []);

    final toSign = quotes.where(ClientQuote.isToSign).toList();
    final signed = quotes.where(ClientQuote.isSigned).toList();
    final signedTotal =
        signed.fold<double>(0, (s, q) => s + ClientQuote.ttc(q));
    final inProgress = chantiers.where((c) => !c.finished).length;

    Widget loader() => const Padding(
          padding: EdgeInsets.symmetric(vertical: 28),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        );

    return KojiPage(
      title: 'Bonjour ${account?.firstName ?? ''}'.trim(),
      subtitle: 'Suivez vos travaux et vos devis en temps réel.',
      onRefresh: () async {
        ref.invalidate(clientQuotesProvider);
        ref.invalidate(clientTasksProvider);
      },
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'Devis reçus',
            value: '${quotes.length}',
            sub: toSign.isEmpty ? '' : '${toSign.length} à signer',
            tone: KojiTone.navy,
            icon: KojiIcons.devis,
            onTap: () => context.go('/client/devis'),
          ),
          KojiKpi(
            label: 'À signer',
            value: '${toSign.length}',
            sub: toSign.isEmpty ? 'à jour' : 'en attente',
            tone: KojiTone.amber,
            icon: KojiIcons.clock,
            onTap: () => context.go('/client/devis'),
          ),
          KojiKpi(
            label: 'Chantiers en cours',
            value: '$inProgress',
            sub: 'sur ${chantiers.length}',
            tone: KojiTone.green,
            icon: KojiIcons.chantiers,
            onTap: () => context.go('/client/chantiers'),
          ),
          KojiKpi(
            label: 'Montant signé',
            value: kojiEuro(signedTotal),
            sub: 'TTC',
            tone: KojiTone.navy,
            icon: KojiIcons.euro,
          ),
        ]),
      ],
      main: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle(
                'Devis à signer',
                action: 'Tous mes devis',
                onAction: () => context.go('/client/devis'),
              ),
              const SizedBox(height: 14),
              if (quotesAsync.isLoading && quotes.isEmpty)
                loader()
              else if (toSign.isEmpty)
                KojiEmptyState(
                  compact: true,
                  icon: KojiIcons.check,
                  title: quotes.isEmpty
                      ? 'Aucun devis pour le moment'
                      : 'Tous vos devis sont signés',
                  subtitle: quotes.isEmpty
                      ? 'Les devis envoyés par votre artisan apparaîtront ici.'
                      : null,
                )
              else
                for (final (i, q) in toSign.take(3).indexed) ...[
                  if (i > 0) const SizedBox(height: 10),
                  ClientQuoteCard(quote: q, compact: true),
                ],
            ],
          ),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle(
                'Suivi des travaux',
                action: 'Mes chantiers',
                onAction: () => context.go('/client/chantiers'),
              ),
              const SizedBox(height: 10),
              if (tasksAsync.isLoading && chantiers.isEmpty)
                loader()
              else if (chantiers.isEmpty)
                const KojiEmptyState(
                  compact: true,
                  icon: KojiIcons.chantiers,
                  title: 'Pas encore de travaux à suivre',
                  subtitle:
                      "L'avancement apparaîtra ici dès que votre artisan aura démarré.",
                )
              else
                for (final c in chantiers.take(4))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                c.reference,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  color: p.ink,
                                ),
                              ),
                            ),
                            KojiPill(c.status.$1, tone: c.status.$2),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: KojiProgressBar(
                                value: c.progress,
                                track:
                                    p.isDark ? null : const Color(0xFFF1EEE8),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              '${(c.progress * 100).round()} %',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: p.heading,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              '${c.done}/${c.total} tâches',
                              style: TextStyle(fontSize: 12.5, color: p.muted),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ],
      side: [
        KojiPromoCard(
          eyebrow: 'Une question ?',
          text: 'Écrivez à votre artisan depuis la messagerie de votre devis.',
          actionLabel: 'Ouvrir les messages',
          onAction: () => context.go('/client/messages'),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Documents signés'),
              const SizedBox(height: 8),
              if (signed.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Vos devis signés seront rangés ici.',
                    style: TextStyle(fontSize: 13.5, color: p.muted),
                  ),
                )
              else
                for (final q in signed.take(4))
                  InkWell(
                    onTap: () => ClientQuote.view(context, q),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: p.lineSoft)),
                      ),
                      child: Row(
                        children: [
                          KojiIcon(KojiIcons.file, size: 18, color: p.heading),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Devis signé ${ClientQuote.number(q)}'.trim(),
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: p.ink,
                                  ),
                                ),
                                Text(
                                  ClientQuote.date(q),
                                  style:
                                      TextStyle(fontSize: 12, color: p.muted),
                                ),
                              ],
                            ),
                          ),
                          KojiIcon(KojiIcons.download,
                              size: 16, color: p.muted),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}
