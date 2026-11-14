import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/factures/chantier_factures_screen.dart';
import 'package:koji/features/factures/factures_repository.dart';
import 'package:koji/features/factures/factures_screen.dart';
import 'package:koji/features/factures/nouvelle_facture_screen.dart';

String _day(int offset) => DateTime.now().add(Duration(days: offset)).toIso8601String().substring(0, 10);

final _data = FacturesData(
  company: 'ABL Expert Renov',
  projects: const [
    {'id': 'c1', 'title': 'Rénovation Martin', 'client': 'martin', 'status': 'En cours'},
  ],
  quotes: const [
    {'id': 'q1', 'status': 'Signe', 'projectId': 'c1', 'quoteNumber': '2026_1050', 'totalTtc': 10000},
  ],
  invoices: [
    {'id': 'f1', 'invoiceNumber': 'FAC-2026-0001', 'quoteId': 'q1', 'projectId': 'c1', 'client': 'martin', 'projectTitle': 'Rénovation Martin', 'type': 'Acompte initial', 'status': 'Emise', 'dueDate': _day(-20), 'amountTtc': 3000, 'clientEmail': 'martin@example.com', 'createdAt': '2026-10-01'},
    {'id': 'f2', 'invoiceNumber': 'FAC-2026-0002', 'quoteId': 'q1', 'projectId': 'c1', 'client': 'martin', 'type': 'Facture intermédiaire', 'status': 'Brouillon', 'dueDate': _day(10), 'amountTtc': 2000, 'createdAt': '2026-10-20'},
    {'id': 'f3', 'invoiceNumber': 'FAC-2026-0003', 'quoteId': 'q1', 'projectId': 'c1', 'client': 'martin', 'type': 'Acompte initial', 'status': 'Annulee', 'amountTtc': 999, 'createdAt': '2026-09-01'},
  ],
);

Widget _app(Widget child) => ProviderScope(
      overrides: [facturesProvider.overrideWith((ref) async => _data)],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: child),
    );

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('Factures : indicateurs, onglets et liste comme sur le site', (tester) async {
    tester.view.physicalSize = const Size(1400, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(const FacturesScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Factures'), findsOneWidget);
    expect(find.text('En retard · 1'), findsOneWidget);
    expect(find.text('Brouillons · 1'), findsOneWidget);
    // L'annulée n'est pas listée.
    expect(find.text('Toutes · 2'), findsOneWidget);
    expect(find.textContaining('FAC-2026-0003'), findsNothing);
    // Reste à facturer : 10 000 − 3 000 − 2 000.
    expect(find.text('Devis à facturer · 1'), findsOneWidget);

    await tester.tap(find.text('Brouillons · 1'));
    await tester.pumpAndSettle();
    expect(find.textContaining('FAC-2026-0001'), findsNothing);
    expect(find.textContaining('FAC-2026-0002'), findsOneWidget);
  });

  testWidgets('une facture en retard propose Relancer et Créer un avoir', (tester) async {
    tester.view.physicalSize = const Size(1400, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(const FacturesScreen()));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('FAC-2026-0001'));
    await tester.pumpAndSettle();

    expect(find.text('Facture FAC-2026-0001'), findsOneWidget);
    expect(find.text('Marquer payée'), findsOneWidget);
    expect(find.text('Relancer'), findsOneWidget);
    expect(find.text('Créer un avoir'), findsOneWidget);

    await tester.tap(find.text('Relancer'));
    await tester.pumpAndSettle();
    // 20 jours de retard : relance ferme proposée, signée de la raison sociale.
    final message = tester.widget<TextField>(find.byType(TextField).last).controller!.text;
    expect(message, contains('Malgré notre précédent rappel'));
    expect(message, endsWith('ABL Expert Renov'));
  });

  testWidgets("avoir : HT et TVA au taux d'origine, facture refaite à 10 % (PRO-06.1)", (tester) async {
    tester.view.physicalSize = const Size(1400, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(const FacturesScreen()));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('FAC-2026-0001'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Créer un avoir'));
    await tester.pumpAndSettle();
    String normalize(String s) => s.replaceAll(RegExp('[  ]'), ' ');
    List<String> textes() => tester.widgetList<Text>(find.byType(Text)).map((t) => normalize(t.data ?? '')).toList();
    expect(textes(), containsAll(['− 2 500,00 €', '− 500,00 €', '− 3 000,00 €', "TVA 20 % (taux d'origine)"]));
    await tester.tap(find.textContaining('Refaire la facture à 10 %'));
    await tester.pumpAndSettle();
    expect(textes().any((t) => t.startsWith('Refaire la facture à 10 % · 2 750,00 €')), isTrue);
    expect(find.text('Émettre'), findsOneWidget);
    expect(find.textContaining('un seul message à martin@example.com'), findsOneWidget);
  });

  testWidgets('chantier et nouvelle facture : reste à facturer et acompte 30 %', (tester) async {
    tester.view.physicalSize = const Size(1400, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(const ChantierFacturesScreen(chantier: {'id': 'c1', 'reference': 'Rénovation Martin'})));
    await tester.pumpAndSettle();
    expect(find.text('Devis 2026_1050'), findsOneWidget);
    expect(find.text('Partielle'), findsOneWidget);
    expect(find.text('Factures du chantier · 3'), findsOneWidget);

    await tester.pumpWidget(_app(const NouvelleFactureScreen(args: {'quoteId': 'q1'})));
    await tester.pumpAndSettle();
    String normalize(String s) => s.replaceAll(RegExp('[  ]'), ' ');
    final amounts = tester.widgetList<Text>(find.byType(Text)).map((t) => normalize(t.data ?? '')).toList();
    expect(amounts, contains('5 000,00 €')); // reste à facturer
    expect(amounts, contains('3 000,00 € TTC')); // acompte 30 % du devis
  });
}
