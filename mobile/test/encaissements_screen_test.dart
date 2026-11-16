import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/factures/encaissements_screen.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/factures/factures_repository.dart';

// Maquette PRO-06.3 : 20 novembre 2026, encaissé 3 550,01 €, à encaisser 6 633 €.
final _now = DateTime(2026, 11, 20, 12);

final _invoices = <Invoice>[
  {'id': 'f125', 'invoiceNumber': 'KJ-2026-125', 'quoteId': 'q1', 'type': 'Situation 1', 'projectTitle': 'Appartement Caulaincourt', 'client': 'Mme Lefèvre', 'clientEmail': 'client@exemple.invalid', 'amountTtc': 2515, 'status': 'Emise', 'dueDate': '2026-12-20'},
  {'id': 'f115', 'invoiceNumber': 'KJ-2026-115', 'quoteId': 'q2', 'type': 'Facture finale', 'projectTitle': 'Bureaux Auteuil', 'client': 'SCI Bureaux Auteuil', 'amountTtc': 4118, 'status': 'Emise', 'dueDate': '2026-11-12',
    'reminders': [{'level': 'aimable', 'channel': 'email', 'at': '2026-11-16T09:00:00Z'}]},
  {'id': 'f118', 'invoiceNumber': 'KJ-2026-118', 'quoteId': 'q2', 'type': 'Acompte initial', 'projectTitle': 'Bureaux Auteuil', 'client': 'SCI Bureaux Auteuil', 'amountTtc': 1810.45, 'status': 'Payee', 'paidAt': '2026-11-09',
    'payments': [{'id': 'p1', 'amount': 1810.45, 'date': '2026-11-09', 'moyen': 'virement'}]},
  {'id': 'f121', 'invoiceNumber': 'KJ-2026-121', 'quoteId': 'q3', 'type': 'Situation 1', 'projectTitle': 'Salle de bain, Paris 10e', 'client': 'Mme Lefèvre', 'amountTtc': 2743.63, 'status': 'Emise', 'dueDate': '2026-11-30'},
  {'id': 'f112', 'invoiceNumber': 'KJ-2026-112', 'quoteId': 'q3', 'type': 'Acompte initial', 'projectTitle': 'Salle de bain, Paris 10e', 'client': 'Mme Lefèvre', 'amountTtc': 1739.56, 'status': 'Payee', 'paidAt': '2026-11-02',
    'payments': [{'id': 'p2', 'amount': 1739.56, 'date': '2026-11-02', 'moyen': 'carte'}]},
  {'id': 'av4', 'kind': 'avoir', 'invoiceNumber': 'AV-2026-004', 'refInvoiceId': 'f121', 'quoteId': 'q3', 'amountTtc': -2743.63, 'status': 'Emise', 'client': 'Mme Lefèvre'},
];

final _data = FacturesData(
  projects: const [],
  quotes: const [
    {'id': 'q1', 'totalTtc': 4095.1, 'clientType': 'particulier'},
    {'id': 'q2', 'totalTtc': 5928.45, 'clientType': 'societe'},
    {'id': 'q3', 'totalTtc': 5798.54, 'clientType': 'particulier'},
  ],
  invoices: _invoices,
);

class _FakeRepository extends FacturesRepository {
  _FakeRepository() : super(KojiProApi(tokenProvider: () async => 'test'));
  final calls = <Map<String, dynamic>>[];

  @override
  Future<Invoice> pay(Invoice invoice, {required double amount, required String date, required String moyen, String reference = '', bool receipt = false}) async {
    calls.add({'id': invoice['id'], 'amount': amount, 'date': date, 'moyen': moyen, 'reference': reference, 'receipt': receipt});
    return {
      ...invoice,
      'status': amount >= amountOf(invoice) - 0.01 ? 'Payee' : 'Emise',
      'payments': [
        {'id': 'n', 'amount': amount, 'date': date, 'moyen': moyen, 'recuEnvoye': receipt},
      ],
    };
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('logique : chiffres, états et reste dû comme lib/encaissements.js', () {
    final stats = collectionStats(_invoices, now: _now);
    expect(stats.collected, 3550.01);
    expect(stats.paymentsCount, 2);
    expect(stats.toCollect, 6633);
    expect(stats.dueCount, 2);
    expect(stats.lateCount, 1);
    expect(stats.next?['invoiceNumber'], 'KJ-2026-125');

    String texte(String id) => paymentState(_invoices.firstWhere((f) => f['id'] == id), _invoices, now: _now).text;
    expect(texte('f125'), 'échéance 20 déc.');
    expect(texte('f115'), 'échue depuis 8 j · relance 1 envoyée');
    expect(texte('f118'), 'virement reçu le 9 nov.');
    expect(texte('f121'), 'annulée par avoir AV-2026-004');
    expect(paymentState(_invoices[3], _invoices, now: _now).state, 'Annulée');

    final partiel = {..._invoices[0], 'payments': [{'amount': 1000, 'date': '2026-11-18', 'moyen': 'cheque'}]};
    expect(dueOn(partiel, _invoices), 1515);
    expect(_n(paymentState(partiel, _invoices, now: _now).text), 'échéance 20 déc. · 1 000,00 € reçus');
    // Une facture payée avant PRO-06.3 a un paiement implicite à paidAt.
    expect(paidOn({'status': 'Payee', 'amountTtc': 500, 'paidAt': '2026-10-01'}), 500);
  });

  testWidgets('écran : trois chiffres, états, marquer payée avec reste chantier', (tester) async {
    tester.view.physicalSize = const Size(430, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = _FakeRepository();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        facturesProvider.overrideWith((ref) async => _data),
        facturesRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: EncaissementsScreen(now: _now)),
    ));
    await tester.pumpAndSettle();
    List<String> textes() => tester.widgetList<Text>(find.byType(Text)).map((t) => _n(t.data ?? '')).toList();
    expect(textes(), containsAll(['3 550,01 € en novembre', '3 550,01 €', '6 633,00 €', '1']));
    expect(textes(), containsAll(['À encaisser', 'En retard', 'Payée', 'Annulée']));
    expect(textes(), contains('Situation 1 · Appartement Caulaincourt · Mme Lefèvre'));
    expect(textes(), contains('Solde · Bureaux Auteuil · SCI Bureaux Auteuil'));
    expect(textes(), contains('échue depuis 8 j · relance 1 envoyée'));

    await tester.tap(find.text('KJ-2026-125'));
    await tester.pumpAndSettle();
    expect(textes(), contains('Marquer payée · KJ-2026-125'));
    expect(textes(), contains('Tout · 2 515,00 €'));
    // Devis 4 095,10 € − 2 515,00 € reçus = 1 580,10 € (maquette).
    expect(textes(), contains('1 580,10 €'));
    expect(textes(), contains('Envoyer un reçu à Mme Lefèvre'));

    await tester.ensureVisible(find.text('Espèces'));
    await tester.tap(find.text('Espèces'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Espèces limitées à 1', findRichText: true), findsOneWidget);
    await tester.ensureVisible(find.text('Virement'));
    await tester.tap(find.text('Virement'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'VIR LEFEVRE SIT1');

    await tester.ensureVisible(find.text('Enregistrer le paiement'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer le paiement'));
    await tester.pumpAndSettle();
    expect(repo.calls, hasLength(1));
    expect(repo.calls.single, containsPair('id', 'f125'));
    expect(repo.calls.single, containsPair('amount', 2515.0));
    expect(repo.calls.single, containsPair('moyen', 'virement'));
    expect(repo.calls.single, containsPair('reference', 'VIR LEFEVRE SIT1'));
    expect(repo.calls.single, containsPair('receipt', true));
    expect(repo.calls.single['date'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
    expect(find.text('Facture KJ-2026-125 payée, reçu envoyé au client.'), findsOneWidget);
  });
}
