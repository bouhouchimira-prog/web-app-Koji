import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/factures/factures_repository.dart';
import 'package:koji/features/factures/factures_widgets.dart';

/// Facturation d'un chantier : pour chaque devis signé, total / déjà facturé /
/// reste à facturer, puis les factures du chantier (même calcul que le site).
class ChantierFacturesScreen extends ConsumerWidget {
  const ChantierFacturesScreen({super.key, required this.chantier});

  /// La ligne `chantiers` passée par le tableau de bord du chantier.
  final Map<String, dynamic> chantier;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chantierId = '${chantier['id'] ?? ''}';
    final title = '${chantier['reference'] ?? chantier['title'] ?? 'Chantier'}';
    final async = ref.watch(facturesProvider);
    return async.when(
      loading: () => KojiPage(
        title: title,
        subtitle: 'Facturation',
        appBarOnPhone: true,
        main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))],
      ),
      error: (error, _) => KojiPage(
        title: title,
        subtitle: 'Facturation',
        appBarOnPhone: true,
        main: [
          KojiEmptyState(
            title: 'Facturation indisponible',
            subtitle: errorText(error),
            action: KojiButton(label: 'Réessayer', variant: KojiButtonVariant.secondary, onPressed: () => ref.invalidate(facturesProvider)),
          ),
        ],
      ),
      data: (data) {
        final quotes = data.billable.where((b) => b.projectId == chantierId).toList();
        final quoteIds = quotes.map((b) => b.id).toSet();
        final invoices = data.invoices.where((i) => i['projectId'] == chantierId || quoteIds.contains(i['quoteId'])).toList()
          ..sort((a, b) => '${b['createdAt'] ?? ''}'.compareTo('${a['createdAt'] ?? ''}'));
        final canBill = quotes.any((b) => b.summary(data.invoices).remaining > 0.01);
        return KojiPage(
          title: title,
          subtitle: 'Facturation',
          appBarOnPhone: true,
          onRefresh: () => ref.refresh(facturesProvider.future),
          actions: [
            if (canBill)
              KojiButton(
                label: 'Nouvelle facture',
                leadingIcon: KojiIcons.plus,
                onPressed: () => context.push(nouvelleFactureRoute, extra: {'chantierId': chantierId}),
              ),
          ],
          main: [
            if (quotes.isEmpty)
              const KojiEmptyState(
                title: 'Aucun devis signé',
                subtitle: 'La facturation part d\'un devis signé par le client.',
                icon: KojiIcons.devis,
              )
            else
              for (final quote in quotes) _QuoteSummary(quote: quote, summary: quote.summary(data.invoices)),
          ],
          side: [
            KojiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KojiSectionTitle('Factures du chantier · ${invoices.length}'),
                  const SizedBox(height: 12),
                  if (invoices.isEmpty)
                    Text('Aucune facture pour ce chantier.', style: TextStyle(fontSize: 13, color: context.koji.muted))
                  else
                    for (final invoice in invoices) ...[
                      InvoiceTile(invoice: invoice, onTap: () => showInvoiceActions(context, ref, invoice, data)),
                      const SizedBox(height: 10),
                    ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _QuoteSummary extends StatelessWidget {
  const _QuoteSummary({required this.quote, required this.summary});
  final BillableQuote quote;
  final BillingSummary summary;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final tone = switch (summary.state) {
      'Soldée' => KojiTone.green,
      'Partielle' => KojiTone.amber,
      _ => KojiTone.grey,
    };
    return KojiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Devis ${quote.number}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.heading))),
              KojiPill(summary.state, tone: tone),
            ],
          ),
          const SizedBox(height: 10),
          FactureKv('Client', quote.client.isEmpty ? '—' : quote.client),
          FactureKv('Total TTC', euro(summary.total)),
          FactureKv('Déjà facturé', euro(summary.already)),
          FactureKv('Reste à facturer', euro(summary.remaining), strong: true),
          if (summary.total > 0) ...[
            const SizedBox(height: 10),
            KojiProgressBar(value: (summary.already / summary.total).clamp(0.0, 1.0)),
          ],
          if (summary.remaining > 0.01) ...[
            const SizedBox(height: 14),
            KojiButton(
              label: 'Facturer ce devis',
              variant: KojiButtonVariant.secondary,
              expand: true,
              onPressed: () => context.push(nouvelleFactureRoute, extra: {'quoteId': quote.id}),
            ),
          ],
        ],
      ),
    );
  }
}
