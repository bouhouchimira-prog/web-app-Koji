import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/factures/factures_repository.dart';
import 'package:koji/features/factures/impayes_screen.dart';

DateTime _jour(int offset) {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day + offset, 12);
}

String _day(int offset) => _jour(offset).toIso8601String().substring(0, 10);
String _at(int offset) => _jour(offset).toUtc().toIso8601String();

// Maquette PRO-06.2 : trois factures échues, 8 372,46 €.
final _data = FacturesData(
  projects: const [],
  quotes: const [
    {'id': 'q1', 'clientType': 'particulier'},
    {'id': 'q2', 'clientType': 'societe'},
    {'id': 'q3', 'clientType': 'societe'},
  ],
  invoices: [
    {'id': 'f1', 'invoiceNumber': 'KJ-2026-118', 'quoteId': 'q1', 'type': 'Acompte initial', 'status': 'Emise', 'client': 'Mme Lefèvre', 'amountTtc': 1739.56, 'dueDate': _day(-24), 'issuedAt': _at(-31),
      'reminders': [{'level': 'aimable', 'channel': 'email', 'at': _at(-21)}, {'level': 'ferme', 'channel': 'email', 'at': _at(-9)}]},
    {'id': 'f2', 'invoiceNumber': 'KJ-2026-130', 'quoteId': 'q2', 'type': 'Situation 2', 'status': 'Emise', 'client': 'Caulaincourt', 'amountTtc': 1712.9, 'dueDate': _day(-9),
      'reminders': [{'level': 'aimable', 'channel': 'email', 'at': _at(-5)}]},
    {'id': 'f3', 'invoiceNumber': 'KJ-2026-109', 'quoteId': 'q3', 'type': 'Facture', 'status': 'Emise', 'client': 'SCI Bureaux Auteuil', 'amountTtc': 4920, 'dueDate': _day(-2)},
    {'id': 'f4', 'invoiceNumber': 'KJ-2026-100', 'type': 'Facture', 'status': 'Payee', 'client': 'X', 'amountTtc': 1000, 'dueDate': _day(-40)},
  ],
);

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('impayés : total, retards, étapes et mise en demeure préparée', (tester) async {
    tester.view.physicalSize = const Size(430, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        facturesProvider.overrideWith((ref) async => _data),
        autoRemindersProvider.overrideWith((ref) async => true),
      ],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: const ImpayesScreen()),
    ));
    await tester.pumpAndSettle();
    String n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
    final textes = tester.widgetList<Text>(find.byType(Text)).map((t) => n(t.data ?? '')).toList();
    expect(textes, contains('3 factures · 8 372,46 €'));
    expect(textes, containsAll(['24 j de retard', '9 j de retard', '2 j de retard']));
    expect(textes, contains('Acompte KJ-2026-118 · 1 739,56 €'));
    expect(textes.any((t) => t.startsWith('Mme Lefèvre · particulière · 2e relance envoyée le')), isTrue);
    expect(textes, contains('SCI Bureaux Auteuil · société · rappel aimable prévu demain'));
    expect(textes, contains('Relances automatiques activées'));

    await tester.tap(find.text('Préparer la mise en demeure'));
    await tester.pumpAndSettle();
    final courrier = tester.widgetList<TextField>(find.byType(TextField)).map((f) => f.controller?.text ?? '').firstWhere((t) => t.startsWith('Objet'));
    expect(courrier, contains("la facture d'acompte KJ-2026-118"));
    expect(courrier, contains('intérêts au taux légal'));
  });
}
