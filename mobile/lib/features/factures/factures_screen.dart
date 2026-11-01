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

const _tabs = {
  'toutes': 'Toutes',
  'Retard': 'En retard',
  'Emise': 'À échéance',
  'Payee': 'Payées',
  'Brouillon': 'Brouillons',
};

String _plural(int n, String word) => '$n $word${n > 1 ? 's' : ''}';

/// Factures (PRO-06) : indicateurs, onglets, recherche et liste, comme la
/// page /facturation du site, sur les mêmes données.
class FacturesScreen extends ConsumerStatefulWidget {
  const FacturesScreen({super.key});

  @override
  ConsumerState<FacturesScreen> createState() => _FacturesScreenState();
}

class _FacturesScreenState extends ConsumerState<FacturesScreen> {
  String _tab = 'toutes';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _newInvoice([String? quoteId]) => context.push(nouvelleFactureRoute, extra: {if (quoteId != null) 'quoteId': quoteId});

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(facturesProvider);
    final newButton = KojiButton(label: 'Nouvelle facture', leadingIcon: KojiIcons.plus, onPressed: _newInvoice);
    return async.when(
      loading: () => KojiPage(title: 'Factures', actions: [newButton], main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (error, _) => KojiPage(
        title: 'Factures',
        main: [
          KojiEmptyState(
            title: 'Factures indisponibles',
            subtitle: errorText(error),
            icon: KojiIcons.factures,
            action: KojiButton(label: 'Réessayer', variant: KojiButtonVariant.secondary, onPressed: () => ref.invalidate(facturesProvider)),
          ),
        ],
      ),
      data: (data) => _content(data, newButton),
    );
  }

  Widget _content(FacturesData data, Widget newButton) {
    final shown = data.shown;
    final stats = facturesStats(shown);
    final counts = <String, int>{'toutes': shown.length, 'Retard': 0, 'Emise': 0, 'Payee': 0, 'Brouillon': 0};
    for (final invoice in shown) {
      final bucket = invoiceBucket(invoice);
      if (counts.containsKey(bucket)) counts[bucket] = counts[bucket]! + 1;
    }
    final needle = _search.text.trim().toLowerCase();
    final rows = shown
        .where((i) => _tab == 'toutes' || invoiceBucket(i) == _tab)
        .where((i) => needle.isEmpty || [i['invoiceNumber'], i['client'], i['projectTitle']].any((v) => '${v ?? ''}'.toLowerCase().contains(needle)))
        .toList();

    final now = DateTime.now();
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    final eyebrow = [
      months[now.month - 1],
      if (stats.lateCount > 0) '${_plural(stats.lateCount, 'facture')} en retard',
      if (stats.pendingCount > 0) '${stats.pendingCount} à échéance',
    ].join(' · ');

    final toBill = data.billable.where((b) => b.summary(data.invoices).remaining > 0.01).toList();
    final p = context.koji;

    return KojiPage(
      title: 'Factures',
      subtitle: eyebrow,
      actions: [newButton],
      onRefresh: () => ref.refresh(facturesProvider.future),
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'Encaissé ce mois',
            value: euro(stats.paidThisMonth),
            sub: stats.paidThisMonthCount > 0 ? _plural(stats.paidThisMonthCount, 'facture') : 'aucune',
            tone: KojiTone.green,
            icon: KojiIcons.euro,
          ),
          KojiKpi(
            label: 'En attente',
            value: euro(stats.pending),
            sub: stats.pendingCount > 0 ? 'à échéance' : 'aucune',
            icon: KojiIcons.clock,
            onTap: () => setState(() => _tab = 'Emise'),
          ),
          KojiKpi(
            label: 'En retard',
            value: euro(stats.late),
            sub: stats.lateCount > 0 ? _plural(stats.lateCount, 'facture') : 'aucun retard',
            tone: stats.lateCount > 0 ? KojiTone.coral : KojiTone.navy,
            icon: KojiIcons.alert,
            onTap: () => setState(() => _tab = 'Retard'),
          ),
          KojiKpi(
            label: 'À émettre',
            value: '${stats.draftCount}',
            sub: stats.draftCount > 1 ? 'brouillons' : 'brouillon',
            icon: KojiIcons.file,
            onTap: () => setState(() => _tab = 'Brouillon'),
          ),
        ]),
      ],
      main: [
        KojiFilterChips<String>(
          options: {for (final e in _tabs.entries) e.key: '${e.value} · ${counts[e.key]}'},
          value: _tab,
          onChanged: (tab) => setState(() => _tab = tab),
        ),
        TextField(
          controller: _search,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Client, chantier, numéro',
            prefixIcon: Padding(padding: const EdgeInsets.only(left: 14, right: 10), child: KojiIcon(KojiIcons.search, size: 17, color: p.faint)),
            prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
          ),
        ),
        if (rows.isEmpty)
          KojiEmptyState(
            compact: true,
            icon: KojiIcons.factures,
            title: needle.isNotEmpty ? 'Aucune facture ne correspond à cette recherche.' : 'Aucune facture ici.',
            subtitle: needle.isEmpty && shown.isEmpty ? 'Une facture se crée depuis un devis signé.' : null,
          )
        else
          for (final invoice in rows) InvoiceTile(invoice: invoice, onTap: () => showInvoiceActions(context, ref, invoice, data)),
        Text(
          'Une facture envoyée dont l\'échéance est passée apparaît « En retard ». Touchez une facture pour ses actions.',
          style: TextStyle(fontSize: 12.5, color: p.faint),
        ),
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle('Devis à facturer · ${toBill.length}'),
              const SizedBox(height: 8),
              if (toBill.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('Aucun devis signé en attente de facturation.', style: TextStyle(fontSize: 13, color: p.muted)),
                )
              else
                for (final b in toBill) _QuoteToBill(quote: b, summary: b.summary(data.invoices), onTap: () => _newInvoice(b.id)),
            ],
          ),
        ),
      ],
    );
  }
}

class _QuoteToBill extends StatelessWidget {
  const _QuoteToBill({required this.quote, required this.summary, required this.onTap});
  final BillableQuote quote;
  final BillingSummary summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(quote.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
                  const SizedBox(height: 2),
                  Text([quote.client, quote.number].where((t) => t.isNotEmpty).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: p.muted)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(euro(summary.remaining), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: p.heading)),
                Text(summary.state, style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
            const SizedBox(width: 6),
            KojiIcon(KojiIcons.chevronRight, size: 16, color: p.faint),
          ],
        ),
      ),
    );
  }
}
