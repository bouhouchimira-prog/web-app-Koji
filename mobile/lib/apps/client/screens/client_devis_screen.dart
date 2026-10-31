import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/apps/client/client_quote_helpers.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';

/// "Devis reçus" : sur le site (app/client/devis/page.jsx, lu en entier),
/// cette page ne liste QUE les devis déjà signés, avec un lien PDF — jamais
/// les devis en attente de signature. La maquette 03_devis-recus montre des
/// pastilles "Meilleur prix"/"Mieux noté" et un bouton "Accepter" qui
/// n'existent pas sur le site : volontairement pas repris ici.
class ClientDevisScreen extends ConsumerWidget {
  const ClientDevisScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotesAsync = ref.watch(clientQuotesProvider);
    final quotes = quotesAsync.valueOrNull ?? const [];
    final signed = quotes.where(ClientQuote.isSigned).toList();

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
    } else if (signed.isEmpty) {
      list = const KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.devis,
          title: 'Aucun devis signé',
          subtitle: 'Vos devis signés apparaîtront ici, prêts à télécharger.',
        ),
      );
    } else {
      list = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, q) in signed.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            ClientQuoteCard(quote: q),
          ],
        ],
      );
    }

    return KojiPage(
      title: 'Devis reçus',
      subtitle: 'Vos devis signés, prêts à télécharger.',
      onRefresh: () async => ref.invalidate(clientQuotesProvider),
      main: [list],
    );
  }
}
