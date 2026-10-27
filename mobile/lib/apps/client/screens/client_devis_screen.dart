import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/client/client_quote_helpers.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';

enum _Filter { tous, aSigner, signes }

/// "Devis reçus": every devis addressed to the client, to read and sign.
class ClientDevisScreen extends ConsumerStatefulWidget {
  const ClientDevisScreen({super.key});

  @override
  ConsumerState<ClientDevisScreen> createState() => _ClientDevisScreenState();
}

class _ClientDevisScreenState extends ConsumerState<ClientDevisScreen> {
  _Filter _filter = _Filter.tous;

  @override
  Widget build(BuildContext context) {
    final quotesAsync = ref.watch(clientQuotesProvider);
    final quotes = quotesAsync.valueOrNull ?? const [];
    final toSign = quotes.where(ClientQuote.isToSign).toList();
    final signed = quotes.where(ClientQuote.isSigned).toList();
    final signedTotal =
        signed.fold<double>(0, (s, q) => s + ClientQuote.ttc(q));
    final visible = switch (_filter) {
      _Filter.tous => quotes,
      _Filter.aSigner => toSign,
      _Filter.signes => signed,
    };

    final Widget list;
    if (quotesAsync.isLoading && quotes.isEmpty) {
      list = const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    } else if (quotesAsync.hasError) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.alert,
          title: 'Impossible de charger vos devis',
          subtitle: '${quotesAsync.error}',
          action: KojiButton(
            label: 'Réessayer',
            variant: KojiButtonVariant.secondary,
            onPressed: () => ref.invalidate(clientQuotesProvider),
          ),
        ),
      );
    } else if (visible.isEmpty) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.devis,
          title: quotes.isEmpty
              ? 'Aucun devis reçu'
              : 'Aucun devis dans cette liste',
          subtitle: quotes.isEmpty
              ? "Les devis de votre artisan apparaissent ici dès qu'il vous les envoie."
              : null,
        ),
      );
    } else {
      list = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, q) in visible.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            ClientQuoteCard(quote: q),
          ],
        ],
      );
    }

    return KojiPage(
      title: 'Devis reçus',
      subtitle:
          'Consultez les propositions de vos artisans et signez en ligne.',
      onRefresh: () async => ref.invalidate(clientQuotesProvider),
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'Devis reçus',
            value: '${quotes.length}',
            tone: KojiTone.navy,
            icon: KojiIcons.devis,
          ),
          KojiKpi(
            label: 'À signer',
            value: '${toSign.length}',
            sub: toSign.isEmpty ? '' : 'en attente',
            tone: KojiTone.amber,
            icon: KojiIcons.clock,
          ),
          KojiKpi(
            label: 'Signés',
            value: '${signed.length}',
            tone: KojiTone.green,
            icon: KojiIcons.check,
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
        KojiFilterChips<_Filter>(
          options: {
            _Filter.tous: 'Tous · ${quotes.length}',
            _Filter.aSigner: 'À signer · ${toSign.length}',
            _Filter.signes: 'Signés · ${signed.length}',
          },
          value: _filter,
          onChanged: (f) => setState(() => _filter = f),
        ),
        list,
      ],
      side: [
        const KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle('Avant de signer'),
              SizedBox(height: 10),
              KojiCheckLine(
                  'Vérifiez que le devis couvre bien tous les travaux prévus.'),
              KojiCheckLine(
                  "Regardez les délais, l'acompte et la durée de validité."),
              KojiCheckLine(
                  "Une question ? Posez-la à l'artisan avant de signer."),
            ],
          ),
        ),
        KojiPromoCard(
          eyebrow: 'Besoin de précisions ?',
          text: "Échangez avec votre artisan directement depuis le devis.",
          actionLabel: 'Ouvrir les messages',
          onAction: () => context.go('/client/messages'),
        ),
      ],
    );
  }
}
