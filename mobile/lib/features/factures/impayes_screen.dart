import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/factures/factures_repository.dart';
import 'package:koji/features/factures/factures_widgets.dart';

const impayesRoute = '/facturation/impayes';

final autoRemindersProvider = FutureProvider.autoDispose<bool>((ref) => ref.watch(facturesRepositoryProvider).autoReminders());

String _typeCourt(Invoice invoice) {
  final type = '${invoice['type'] ?? ''}';
  if (RegExp('acompte', caseSensitive: false).hasMatch(type)) return 'Acompte';
  if (RegExp('situation', caseSensitive: false).hasMatch(type)) return type;
  return 'Facture';
}

/// Impayés (maquette PRO-06.2, téléphone) : factures échues, étape de
/// relance, mise en demeure préparée par Koji ; mêmes règles que la page
/// /facturation/impayes du site.
class ImpayesScreen extends ConsumerWidget {
  const ImpayesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(facturesProvider);
    return async.when(
      loading: () => const KojiPage(appBarOnPhone: true, title: 'Impayés', main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (error, _) => KojiPage(appBarOnPhone: true, title: 'Impayés', main: [KojiEmptyState(title: 'Impayés indisponibles', subtitle: errorText(error), icon: KojiIcons.factures)]),
      data: (data) => _content(context, ref, data),
    );
  }

  Widget _content(BuildContext context, WidgetRef ref, FacturesData data) {
    final p = context.koji;
    final list = data.invoices.where((i) => isUnpaid(i, data.invoices)).toList()..sort((a, b) => daysLate(b).compareTo(daysLate(a)));
    final total = toAmount(list.fold<double>(0, (s, i) => s + amountOf(i) - creditedOn(i, data.invoices)));
    final aPreparer = list.where((i) => relanceAction(i) == 'demeure').toList();
    final auto = ref.watch(autoRemindersProvider);
    return KojiPage(appBarOnPhone: true,
      title: 'Impayés',
      subtitle: list.isEmpty ? 'aucune facture échue' : '${list.length} facture${list.length > 1 ? 's' : ''} · ${euro(total)}',
      onRefresh: () => ref.refresh(facturesProvider.future),
      main: [
        if (list.isEmpty)
          const KojiEmptyState(compact: true, icon: KojiIcons.factures, title: 'Aucune facture échue.', subtitle: 'Les factures en retard apparaîtront ici.')
        else
          for (final invoice in list)
            InkWell(
              onTap: () => showReminderSheet(context, ref, invoice, data, level: relanceAction(invoice) == 'demeure' ? 'demeure' : null),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${daysLate(invoice)} j de retard', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: p.toneFg(KojiTone.coral))),
                    const SizedBox(height: 3),
                    Text('${_typeCourt(invoice)} ${invoice['invoiceNumber']} · ${euro(amountOf(invoice) - creditedOn(invoice, data.invoices))}',
                        style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                    const SizedBox(height: 2),
                    Text(
                      '${invoice['client'] ?? 'Client'} · ${isCompanyClient(invoice, data.quotes) ? 'société' : 'particulière'} · ${relanceStep(invoice)}',
                      style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.35),
                    ),
                  ],
                ),
              ),
            ),
        if (aPreparer.isNotEmpty)
          KojiButton(
            label: 'Préparer la mise en demeure',
            expand: true,
            onPressed: () => showReminderSheet(context, ref, aPreparer.first, data, level: 'demeure'),
          ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Relances automatiques'),
              const SizedBox(height: 8),
              for (final palier in relancePaliers)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text('J+${palier.jours} · ${palier.label}${palier.level == 'demeure' ? ' préparée, envoyée par vous' : ' par e-mail'}', style: TextStyle(fontSize: 13, color: p.heading)),
                ),
              const SizedBox(height: 6),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text('Relances automatiques ${auto.valueOrNull == true ? 'activées' : 'désactivées'}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
                subtitle: Text('Désactivables facture par facture.', style: TextStyle(fontSize: 12.5, color: p.muted)),
                value: auto.valueOrNull == true,
                onChanged: auto.isLoading
                    ? null
                    : (v) async {
                        try {
                          await ref.read(facturesRepositoryProvider).setAutoReminders(v);
                          ref.invalidate(autoRemindersProvider);
                        } catch (error) {
                          if (context.mounted) showFacturesMessage(context, errorText(error));
                        }
                      },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
