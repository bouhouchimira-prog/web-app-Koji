import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/calendrier_pro/calendrier_pro.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;

// Maquettes PRO-11 à 11.2 (téléphone), semaine 46 de 2026.
final semaine = <String, dynamic>{
  'semaine': [
    for (final (i, n) in [2, 3, 0, 5, 2, 0, 0].indexed) {'jour': '2026-11-${'${9 + i}'.padLeft(2, '0')}', 'ferie': i == 2, 'n': n},
  ],
  'conflits': [
    {'worker': 'Rénov Horizon', 'jour': '2026-11-12', 'taches': [{'chantier': 'Caulaincourt', 'label': 'lot 06'}, {'chantier': 'Auteuil', 'label': 'lot 06'}], 'proposition': {'taskId': 'a6', 'chantier': 'Auteuil', 'debut': '2026-11-13'}},
  ],
  'agenda': {'jour': '2026-11-12', 'items': [
    {'type': 'chantier', 'heure': '8 h', 'titre': 'Démarrage · Salle de bain Lefèvre', 'detail': 'Lot 01 dépose · Équipe ABL'},
    {'type': 'livraison', 'heure': '10 h', 'titre': 'Livraison Plateforme du Bâtiment → Lefèvre', 'detail': 'BC-0042'},
    {'type': 'relance', 'heure': '17 h', 'titre': 'Relancer Copropriété Exemple', 'detail': 'Devis 2026-039'},
  ]},
  'livraisonsBloquantes': [{'fournisseur': 'Cedeo', 'date': '2026-11-13', 'raison': 'lieu à confirmer'}],
  'documents': <Json>[],
  'aPlanifier': [{'projectId': 'lef', 'chantier': 'Salle de bain Lefèvre', 'lot': 'Lot 04 électricité', 'jours': 1, 'workerIds': ['rh'], 'apres': '2026-11-27', 'lotPrecedent': 'Lot 03 carrelage'}],
  'chantiers': [{'projectId': 'lef', 'title': 'Salle de bain Lefèvre', 'lots': ['Lot 03 carrelage', 'Lot 04 électricité']}],
  'workers': [{'id': 'rh', 'name': 'Rénov Horizon', 'type': 'Sous-traitant'}],
};

class _FakeRepo extends CalendrierRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <Json>[];

  @override
  Future<Json> action(Json corps) async {
    appels.add(corps);
    if (corps['action'] == 'proposer') return {'creneau': {'debut': '2026-11-27', 'fin': '2026-11-27'}};
    return {'debut': '2026-11-27', 'fin': '2026-11-27'};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, List<Override> overrides) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: overrides, child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('semaines et jours', () {
    expect(lundiDe('2026-11-15'), '2026-11-09');
    expect(semaineIso('2026-11-12'), 46);
    expect(jourLong('2026-11-13'), 'ven. 13 nov.');
  });

  testWidgets('agenda du jour : semaine, conflit et proposition, planifier un lot', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const CalendrierProScreen(aujourdhui: '2026-11-12'), [
      calendrierRepositoryProvider.overrideWithValue(repo),
      calendrierJourProvider('2026-11-12').overrideWith((ref) async => semaine),
    ]);
    expect(_contient('Semaine 46'), findsWidgets);
    expect(find.text('férié'), findsOneWidget);
    expect(_contient('Rénov Horizon sur deux chantiers'), findsWidgets);
    expect(_contient('Relancer Copropriété Exemple'), findsWidgets);
    expect(_contient('Livraison Cedeo, ven. 13 nov.'), findsWidgets);
    await tester.tap(find.text('Décaler Auteuil au ven. 13 nov.'));
    await tester.pumpAndSettle();
    expect(repo.appels.last, {'action': 'decaler', 'taskId': 'a6', 'debut': '2026-11-13'});
    await tester.tap(find.text('Placer'));
    await tester.pumpAndSettle();
    expect(_contient('Proposé : ven. 27 nov.'), findsWidgets);
    await tester.tap(find.text('Planifier').last);
    await tester.pumpAndSettle();
    expect(repo.appels.last['action'], 'planifier-lot');
    expect(repo.appels.last['lot'], 'Lot 04 électricité');
    expect(repo.appels.last['workerIds'], ['rh']);
  });
}
