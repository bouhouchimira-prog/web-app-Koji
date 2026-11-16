import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart';
import 'package:koji/features/depenses/depenses_repository.dart';
import 'package:koji/features/depenses/depenses_screens.dart';

// Maquettes PRO-09 à 09.4.
Json piece(Json o) => {'statut': 'a_ranger', 'type': 'ticket', 'source': 'photo', 'lignes': <Json>[], 'tva': 0, 'tauxTva': 20, 'categorie': 'Fournitures', ...o};
final cedeo = piece({'id': 'p1', 'fournisseur': 'Cedeo', 'date': '2026-10-28', 'ht': 386.2, 'tva': 77.24, 'ttc': 463.44, 'proposition': {'projectId': 'sdb', 'title': 'Salle de bain, Paris 10e', 'lot': 'Plomberie', 'sur': true, 'raison': '3 articles sur 3 prévus au devis', 'autres': <Json>[]}});
final vue = <String, dynamic>{
  'aRanger': [
    cedeo,
    piece({'id': 'p3', 'fournisseur': 'Total', 'date': '2026-10-27', 'ht': 60.33, 'ttc': 72.4, 'proposition': {'fraisGeneraux': true, 'sur': true, 'raison': 'carburant, aucun chantier'}}),
    piece({'id': 'p4', 'fournisseur': 'Point P', 'date': '2026-10-26', 'ht': 1070.5, 'ttc': 1284.6, 'doublonDe': 'p2', 'proposition': {'projectId': 'cau', 'title': 'Appartement Caulaincourt', 'sur': true}}),
  ],
  'recues': <Json>[],
  'rangeesMois': {'nombre': 31, 'ht': 19842},
  'sures': 2,
  'chantiers': [
    {'projectId': 'sdb', 'title': 'Salle de bain, Paris 10e', 'lots': ['Plomberie']},
    {'projectId': 'cau', 'title': 'Appartement Caulaincourt', 'lots': ['Carrelage']},
  ],
  'reglages': {'comptableEmail': '', 'envoiAuto': false},
  'business': true,
};
Json lot(String l, num prevu, num depense, String etat) => {'lot': l, 'prevu': prevu, 'depense': depense, 'ecart': depense - prevu, 'etat': etat};
final cout = <String, dynamic>{
  'devisHt': 38900, 'avenantsHt': 0, 'totalHt': 38900, 'avancement': 60,
  'lots': [lot('Démolition', 2400, 2610, 'fait'), lot('Carrelage', 3100, 5400, 'en_cours'), lot('Plomberie', 4200, 3150, 'en_cours')],
  'autres': 0, 'mo': {'suivi': true, 'heures': 74, 'depense': 2331, 'prevu': 8800},
  'depense': 22281, 'margePrevue': {'pct': 28, 'euros': 10892}, 'margeFinale': {'pct': 21, 'euros': 8382, 'delta': -2510},
  'etat': 'regarder', 'phrase': 'Carrelage : fournitures au-dessus du prévu', 'depasse': lot('Carrelage', 3100, 5400, 'en_cours'),
};

class _FakeRepo extends DepensesRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <List<Object?>>[];

  @override
  Future<Json> action(String action, [Json extra = const {}]) async {
    appels.add([action, extra]);
    return vue;
  }

  @override
  Future<Json> deposer({required String nom, required String data}) async {
    appels.add(['deposer', data.startsWith('data:image/jpeg;base64,')]);
    return {...vue, 'pieceId': 'p1'};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, List<Override> overrides) async {
  tester.view.physicalSize = const Size(430, 2600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: overrides, child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('affichage des coûts et périodes (comme le site)', () {
    expect(_n(resumeCarte(cout)), '60 % fait · marge 28 % → 21 %');
    expect(resumeCarte({...cout, 'margePrevue': null}), '60 % fait');
    expect(_n(ecartLot(lot('Carrelage', 3100, 5400, 'en_cours'))), '+ 2 300');
    expect(ecartLot(lot('Plomberie', 4200, 3150, 'en_cours')), 'en cours');
    expect(ecartLot(lot('Démolition', 2400, 2610, 'fait')), '+ 210');
    expect(lotDepasse(lot('Carrelage', 3100, 5400, 'en_cours')), isTrue);
    expect(jourCourt('2026-10-28'), '28 oct.');
    expect(periodesExport(DateTime(2026, 11, 15)), [('2026-10', 'Octobre'), ('2026-11', 'Novembre'), ('2026-T4', 'Trimestre')]);
    expect(periodesExport(DateTime(2027, 1, 5)).first, ('2026-12', 'Décembre'));
    expect(etatCout('regarder').label, 'À regarder');
  });

  testWidgets('À ranger : ranger les sûres, photo lue par Koji puis rangée', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, DepensesScreen(prisePhoto: () async => [1, 2, 3]), [
      depensesRepositoryProvider.overrideWithValue(repo),
      depensesProvider.overrideWith((ref) async => vue),
    ]);
    expect(_contient('Cedeo · 463,44 €'), findsWidgets);
    expect(_contient('doublon possible · Appartement Caulaincourt'), findsWidgets);
    expect(_contient('Déjà rangées ce mois : 31 pièces'), findsWidgets);

    await tester.tap(find.text('Ranger les 2 sûres'));
    await tester.pumpAndSettle();
    expect(repo.appels.last[0], 'rangerSures');

    await tester.tap(find.text("Photo d'un ticket"));
    await tester.pumpAndSettle();
    expect(repo.appels.last, ['deposer', true]);
    expect(_contient('Salle de bain, Paris 10e · proposé par Koji'), findsWidgets);
    await tester.tap(find.text('Ranger').last);
    await tester.pumpAndSettle();
    expect(repo.appels.last, ['ranger', {'id': 'p1', 'projectId': 'sdb', 'lot': 'Plomberie'}]);
  });

  testWidgets('Coût des chantiers', (tester) async {
    await _pump(tester, const DepensesScreen(onglet: 'chantiers'), [
      depensesProvider.overrideWith((ref) async => vue),
      coutChantiersProvider.overrideWith((ref) async => {'coutHoraire': 40, 'chantiers': [{'projectId': 'cau', 'title': 'Appartement Caulaincourt', ...cout}]}),
    ]);
    expect(_contient('60 % fait · marge 28 % → 21 %'), findsWidgets);
    expect(_contient('Dépensé 22 281 €'), findsWidgets);
    expect(_contient('À regarder'), findsWidgets);
  });

  testWidgets('Coût d\'un chantier : lots, heures, avenant, historique', (tester) async {
    await _pump(tester, const CoutChantierScreen(projectId: 'cau'), [
      coutChantierProvider('cau').overrideWith((ref) async => {
            'chantier': {'projectId': 'cau', 'title': 'Appartement Caulaincourt'},
            'devis': {'id': 'q', 'items': <Json>[], 'totalHt': 38900},
            'cout': cout,
            'coutHoraire': 40,
            'pieces': <Json>[],
            'doublons': ['x1'],
            'historique': [
              {'type': 'heures', 'date': '2026-10-30', 'titre': 'Pointage Rui C. · 7 h 45', 'detail': 'Carrelage', 'montant': 449.55, 'id': 'h1'},
              {'type': 'encaissements', 'date': '2026-10-20', 'titre': 'Acompte reçu', 'detail': 'FAC-2026-0115', 'montant': -1810.45, 'id': 'h3'},
            ],
          }),
    ]);
    expect(_contient('prévu 3 100 € · + 2 300'), findsWidgets);
    expect(_contient('Carrelage : 5 400 € pour 3 100 € prévus'), findsWidgets);
    expect(_contient('74 h pointées'), findsWidgets);
    expect(find.text('Préparer un avenant'), findsOneWidget);
    expect(_contient('− 1 810,45 €'), findsWidgets);
    await tester.tap(find.text('Heures'));
    await tester.pumpAndSettle();
    expect(_contient('Acompte reçu'), findsNothing);
    expect(_contient('Pointage Rui C.'), findsWidgets);
  });
}
