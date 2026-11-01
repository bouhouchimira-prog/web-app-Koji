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

/// Nouvelle facture depuis un devis signé : type, mode (acompte, %, montant,
/// solde), échéance, note — même formulaire et mêmes contrôles que le site.
///
/// [args] (tous facultatifs) : `quoteId` présélectionne un devis, `chantierId`
/// limite la liste aux devis du chantier, `type` / `amountMode` /
/// `fixedAmount` / `notes` préremplissent (« Refaire la facture corrigée »).
class NouvelleFactureScreen extends ConsumerStatefulWidget {
  const NouvelleFactureScreen({super.key, this.args = const {}});
  final Map<String, dynamic> args;

  @override
  ConsumerState<NouvelleFactureScreen> createState() => _NouvelleFactureScreenState();
}

class _NouvelleFactureScreenState extends ConsumerState<NouvelleFactureScreen> {
  late String? _quoteId = widget.args['quoteId'] as String?;
  late String _type = invoiceTypes.contains(widget.args['type']) ? widget.args['type'] as String : 'Acompte initial';
  late String _mode = amountModes.containsKey(widget.args['amountMode']) ? widget.args['amountMode'] as String : 'deposit';
  late final _fixed = TextEditingController(text: _initialFixed());
  final _percent = TextEditingController(text: '30');
  final _deposit = TextEditingController(text: '30');
  late final _notes = TextEditingController(text: '${widget.args['notes'] ?? ''}');
  DateTime _due = DateTime.now();
  bool _busy = false;
  String _error = '';

  String _initialFixed() {
    final value = widget.args['fixedAmount'];
    return value is num ? toAmount(value).toStringAsFixed(2) : '';
  }

  @override
  void dispose() {
    _fixed.dispose();
    _percent.dispose();
    _deposit.dispose();
    _notes.dispose();
    super.dispose();
  }

  double _num(TextEditingController c) => double.tryParse(c.text.replaceAll(',', '.').trim()) ?? 0;

  String get _dueIso =>
      '${_due.year}-${_due.month.toString().padLeft(2, '0')}-${_due.day.toString().padLeft(2, '0')}';

  Future<void> _pickDue() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _due,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked != null) setState(() => _due = picked);
  }

  Future<void> _create(BillableQuote quote) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final invoice = await ref.read(facturesRepositoryProvider).create(
            quote: quote,
            type: _type,
            amountMode: _mode,
            fixedAmount: _num(_fixed),
            percent: _num(_percent),
            depositPercent: _num(_deposit),
            dueDate: _dueIso,
            notes: _notes.text.trim(),
          );
      if (!mounted) return;
      facturesChanged(ref);
      showFacturesMessage(context, 'Facture ${invoice['invoiceNumber']} créée en brouillon.');
      context.pop();
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = errorText(error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(facturesProvider);
    return async.when(
      loading: () => const KojiPage(
        title: 'Nouvelle facture',
        appBarOnPhone: true,
        main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))],
      ),
      error: (error, _) => KojiPage(
        title: 'Nouvelle facture',
        appBarOnPhone: true,
        main: [
          KojiEmptyState(
            title: 'Devis indisponibles',
            subtitle: errorText(error),
            action: KojiButton(label: 'Réessayer', variant: KojiButtonVariant.secondary, onPressed: () => ref.invalidate(facturesProvider)),
          ),
        ],
      ),
      data: _content,
    );
  }

  Widget _content(FacturesData data) {
    final p = context.koji;
    final chantierId = widget.args['chantierId'] as String?;
    final quotes = data.billable.where((b) => chantierId == null || b.projectId == chantierId).toList();
    final selected = quotes.where((b) => b.id == _quoteId).firstOrNull ?? quotes.firstOrNull;

    if (selected == null) {
      return const KojiPage(
        title: 'Nouvelle facture',
        appBarOnPhone: true,
        main: [
          KojiEmptyState(
            title: 'Aucun devis signé',
            subtitle: 'Une facture part d\'un devis signé par le client. Faites signer un devis pour pouvoir le facturer.',
            icon: KojiIcons.devis,
          ),
        ],
      );
    }

    final summary = selected.summary(data.invoices);
    final preview = previewAmount(_mode, summary, fixed: _num(_fixed), percent: _num(_percent), deposit: _num(_deposit));
    final safe = toAmount(preview.clamp(0, summary.remaining));
    final overLimit = toAmount(preview) > summary.remaining + 0.01;
    final canCreate = safe > 0 && summary.remaining > 0.01 && !overLimit;
    final invoices = selected.invoicesIn(data.invoices);

    return KojiPage(
      title: 'Nouvelle facture',
      subtitle: 'Choisissez un devis signé, puis le montant à facturer.',
      appBarOnPhone: true,
      main: [
        if (quotes.length > 1)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KojiSectionTitle('Devis à facturer · ${quotes.length}'),
                const SizedBox(height: 8),
                for (final b in quotes) _QuotePick(quote: b, summary: b.summary(data.invoices), on: b.id == selected.id, onTap: () => setState(() => _quoteId = b.id)),
              ],
            ),
          ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle(selected.title),
              const SizedBox(height: 16),
              _label('Type'),
              KojiFilterChips<String>(options: {for (final t in invoiceTypes) t: t}, value: _type, onChanged: (v) => setState(() => _type = v)),
              const SizedBox(height: 16),
              _label('Montant'),
              KojiFilterChips<String>(options: amountModes, value: _mode, onChanged: (v) => setState(() => _mode = v)),
              const SizedBox(height: 14),
              if (_mode == 'fixed')
                KojiField(label: 'Montant TTC', controller: _fixed, hint: 'Ex : 1200', keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
              if (_mode == 'percent')
                KojiField(label: 'Pourcentage du devis', controller: _percent, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
              if (_mode == 'deposit')
                KojiField(label: 'Acompte (%)', controller: _deposit, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
              if (_mode != 'remaining') const SizedBox(height: 14),
              _label('Échéance'),
              KojiCard(
                radius: 13,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                onTap: _pickDue,
                child: Row(
                  children: [
                    KojiIcon(KojiIcons.calendrier, size: 18, color: p.muted),
                    const SizedBox(width: 12),
                    Expanded(child: Text(longDay(_dueIso), style: TextStyle(fontSize: 15, color: p.ink))),
                    Text('Modifier', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.heading, decoration: TextDecoration.underline)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              KojiField(label: 'Note', controller: _notes, hint: 'Ex : acompte commande fournitures'),
              if (overLimit) ...[
                const SizedBox(height: 12),
                Text('Ce montant dépasse le solde restant à facturer.', style: TextStyle(fontSize: 13, color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 14),
              FactureKv('Montant de la facture', '${euro(safe)} TTC', strong: true),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(_error, style: TextStyle(fontSize: 13, color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 16),
              KojiButton(label: 'Générer la facture', expand: true, loading: _busy, onPressed: canCreate ? () => _create(selected) : null),
            ],
          ),
        ),
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KojiSectionTitle('Devis ${selected.number}'),
              const SizedBox(height: 8),
              FactureKv('Client', selected.client.isEmpty ? '—' : selected.client),
              FactureKv('Total TTC', euro(summary.total)),
              FactureKv('Déjà facturé', euro(summary.already)),
              FactureKv('Reste à facturer', euro(summary.remaining), strong: true),
            ],
          ),
        ),
        if (invoices.isNotEmpty)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KojiSectionTitle('Factures du chantier · ${invoices.length}'),
                const SizedBox(height: 12),
                for (final invoice in invoices) ...[
                  InvoiceTile(invoice: invoice, onTap: () => showInvoiceActions(context, ref, invoice, data)),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: context.koji.heading)),
      );
}

class _QuotePick extends StatelessWidget {
  const _QuotePick({required this.quote, required this.summary, required this.on, required this.onTap});
  final BillableQuote quote;
  final BillingSummary summary;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: KojiCard(
        radius: 12,
        onTap: onTap,
        borderColor: on ? p.heading : null,
        color: on ? p.surfaceMuted : null,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(euro(summary.remaining), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: p.heading)),
                Text(summary.state, style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
