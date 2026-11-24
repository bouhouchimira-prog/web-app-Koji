import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/factures/factures_repository.dart';
import 'package:koji/features/factures/factures_widgets.dart';
import 'package:koji/features/factures/paiement_en_ligne_pro.dart';

const encaissementsRoute = '/facturation/encaissements';

const _mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/// « Situation 1 · Appartement Caulaincourt · Mme Lefèvre » (colonne Objet du site).
String encaissementObjet(Invoice invoice) {
  final type = '${invoice['type'] ?? 'Facture'}';
  final court = RegExp('acompte', caseSensitive: false).hasMatch(type)
      ? 'Acompte'
      : RegExp('finale|solde', caseSensitive: false).hasMatch(type)
          ? 'Solde'
          : type;
  return [court, '${invoice['projectTitle'] ?? ''}', '${invoice['client'] ?? ''}'].where((t) => t.trim().isNotEmpty).join(' · ');
}

/// Factures envoyées, celles qui restent dues d'abord (échéance la plus proche).
List<Invoice> encaissementsList(List<Invoice> all) {
  final dues = <Invoice>[];
  final others = <Invoice>[];
  for (final f in all) {
    if (isCreditNote(f) || f['archived'] == true || f['status'] == 'Brouillon') continue;
    (f['status'] == 'Emise' && dueOn(f, all) > 0.01 ? dues : others).add(f);
  }
  dues.sort((a, b) => '${a['dueDate'] ?? '9'}'.compareTo('${b['dueDate'] ?? '9'}'));
  others.sort((a, b) => '${b['paidAt'] ?? b['updatedAt'] ?? ''}'.compareTo('${a['paidAt'] ?? a['updatedAt'] ?? ''}'));
  return [...dues, ...others];
}

KojiTone _tone(String state) => switch (state) {
      'En retard' => KojiTone.coral,
      'Payée' => KojiTone.green,
      'À encaisser' => KojiTone.amber,
      _ => KojiTone.grey,
    };

/// Encaissements (maquette PRO-06.3, téléphone) : trois chiffres, état de
/// paiement de chaque facture, « Marquer payée » sur celles qui restent dues ;
/// mêmes règles que l'onglet Encaissements de /facturation.
class EncaissementsScreen extends ConsumerWidget {
  const EncaissementsScreen({super.key, this.now});

  /// Date du jour, fixée par les tests.
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(facturesProvider);
    return async.when(
      loading: () => const KojiPage(appBarOnPhone: true, title: 'Encaissements', main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (error, _) => KojiPage(appBarOnPhone: true, title: 'Encaissements', main: [KojiEmptyState(title: 'Encaissements indisponibles', subtitle: errorText(error), icon: KojiIcons.factures)]),
      data: (data) => _content(context, ref, data),
    );
  }

  Widget _content(BuildContext context, WidgetRef ref, FacturesData data) {
    final p = context.koji;
    final today = now ?? DateTime.now();
    final stats = collectionStats(data.invoices, now: today);
    final list = encaissementsList(data.invoices);
    final dues = list.where((f) => f['status'] == 'Emise' && dueOn(f, data.invoices) > 0.01).toList();
    return KojiPage(appBarOnPhone: true,
      title: 'Encaissements',
      subtitle: '${euro(stats.collected)} en ${_mois[today.month - 1]}',
      onRefresh: () => ref.refresh(facturesProvider.future),
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'Encaissé',
            value: euro(stats.collected),
            sub: stats.paymentsCount == 0 ? 'aucun paiement' : '${stats.paymentsCount} paiement${stats.paymentsCount > 1 ? 's' : ''}',
            tone: KojiTone.green,
          ),
          KojiKpi(
            label: 'À encaisser',
            value: euro(stats.toCollect),
            sub: stats.dueCount == 0 ? 'rien en attente' : '${stats.dueCount} facture${stats.dueCount > 1 ? 's' : ''}',
            tone: KojiTone.amber,
          ),
          KojiKpi(
            label: 'En retard',
            value: '${stats.lateCount}',
            sub: stats.next == null ? 'aucune échéance' : 'prochaine : ${shortDay(stats.next!['dueDate'])}',
            tone: KojiTone.coral,
          ),
        ]),
      ],
      main: [
        if (list.isEmpty)
          const KojiEmptyState(compact: true, icon: KojiIcons.factures, title: 'Aucune facture envoyée pour l\'instant.', subtitle: 'Les factures envoyées apparaîtront ici avec leur paiement.')
        else
          for (final invoice in list) _row(context, ref, data, invoice, today, p),
        if (dues.isNotEmpty)
          KojiButton(
            label: 'Marquer une facture payée',
            expand: true,
            onPressed: () => dues.length == 1 ? showPaymentSheet(context, ref, dues.first, data) : _pick(context, ref, data, dues),
          ),
        // Paiement en ligne (Stripe Connect) : rien tant qu'il n'est pas ouvert.
        const PaiementEnLigneCarte(),
      ],
    );
  }

  Widget _row(BuildContext context, WidgetRef ref, FacturesData data, Invoice invoice, DateTime today, KojiPalette p) {
    final state = paymentState(invoice, data.invoices, now: today);
    final due = state.state == 'À encaisser' || state.state == 'En retard';
    return InkWell(
      onTap: () => due ? showPaymentSheet(context, ref, invoice, data) : showInvoiceActions(context, ref, invoice, data),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text('${invoice['invoiceNumber'] ?? ''}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                    KojiPill(state.state, tone: _tone(state.state)),
                  ]),
                  const SizedBox(height: 4),
                  Text(encaissementObjet(invoice), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.35)),
                  const SizedBox(height: 2),
                  Text(state.text, style: TextStyle(fontSize: 12, color: state.state == 'En retard' ? p.toneFg(KojiTone.coral) : p.faint)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(euro(amountOf(invoice)), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.heading)),
          ],
        ),
      ),
    );
  }

  Future<void> _pick(BuildContext context, WidgetRef ref, FacturesData data, List<Invoice> dues) async {
    final picked = await showModalBottomSheet<Invoice>(
      context: context,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (sheetContext) {
        final p = sheetContext.koji;
        return ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
          children: [
            Text('Quelle facture ?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
            const SizedBox(height: 8),
            for (final f in dues)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${f['invoiceNumber']} · ${euro(dueOn(f, data.invoices))}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                subtitle: Text(encaissementObjet(f), style: TextStyle(color: p.muted)),
                onTap: () => Navigator.of(sheetContext).pop(f),
              ),
          ],
        );
      },
    );
    if (picked != null && context.mounted) await showPaymentSheet(context, ref, picked, data);
  }
}
