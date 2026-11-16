import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/bibliotheque/bibliotheque_logic.dart';
import 'package:koji/features/bibliotheque/bibliotheque_repository.dart';
import 'package:koji/features/bibliotheque/bibliotheque_screens.dart';

// Maquettes PRO-08 à 08.3 : mêmes chiffres que tests/unit/bibliotheque.test.js.
final car010 = <String, dynamic>{'id': 'koji-car-010', 'code': 'CAR-010', 'label': 'Poser un carrelage au sol', 'family': 'Carrelage', 'familyCode': 'CAR', 'unit': 'm²', 'normativeTime': 0.6, 'hourlyRate': 55, 'tauxSource': 'metier', 'confidence': 'C', 'synonyms': ['carrelage sol']};
final receveur = <String, dynamic>{'id': 'koji-plo-120', 'code': 'PLO-120', 'label': 'Poser un receveur de douche', 'family': 'Plomberie', 'familyCode': 'PLO', 'unit': 'u', 'normativeTime': 3.5, 'fixedTime': 0.5, 'hourlyRate': 0, 'confidence': 'C'};
final taux = <String, dynamic>{
  'taux': {'Carreleur': 55},
  'parFamille': {'CAR': 55},
  'valides': {'Carreleur': '2026-11-02'},
  'defautsFamille': {'CAR': 55, 'PLO': 60},
  'defautsMetier': {'Carreleur': 55, 'Plombier': 60},
};

final analyseTest = <String, dynamic>{
  'fichiers': [
    {'id': 'f1', 'nom': 'Facture 2026-031.pdf', 'date': '2026-10-12', 'lignes': 14, 'statut': 'lue', 'garde': false},
  ],
  'lignes': {'total': 16, 'comprises': 14, 'aVerifier': 1, 'ecartees': 1},
  'questions': [
    {'id': 'l9', 'designation': 'Divers plomberie', 'quantite': 0, 'total': 180, 'unite': '', 'question': '« Divers plomberie », 180 € : quel ouvrage ?', 'motif': 'forfait sans quantité'},
  ],
  'metiers': [
    {'metier': 'Carreleur', 'activite': 'Carrelage, faïence', 'lignes': 14, 'taux': 58, 'bas': 52, 'haut': 63, 'confiance': 'moyenne', 'regle': 48, 'proposition': {'action': 'appliquer', 'libelle': 'Appliquer', 'texte': 'Votre taux réglé est trop bas.', 'taux': 58}, 'ecart': 17},
  ],
  'exemple': null,
  'periode': '2026',
  'garder': false,
  'partage': false,
};

class _FakeRepo extends BibliothequeRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <List<Object?>>[];

  @override
  Future<Json> actionFactures(String action, [Json extra = const {}]) async {
    appels.add([action, extra]);
    return analyseTest;
  }

  @override
  Future<Json> enregistrerTaux(Map<String, num?> taux, {List<String> valider = const []}) async {
    appels.add(['taux', taux, valider]);
    return {'taux': taux};
  }

  @override
  Future<Json> analyse() async => analyseTest;
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

  test("main-d'œuvre, code proposé, sensibilité, recherche (comme le site)", () {
    expect(moOuvrage(car010, 55).parUnite, 33);
    final r = moOuvrage(receveur, 60);
    expect(r.parUnite, 210);
    expect(r.fixe, 30);
    expect(detailMo(car010, 55), '0,6 h/m² × 55 €/h');
    expect(prochainCode('PLO', [for (var i = 10; i <= 150; i += 10) 'PLO-${'$i'.padLeft(3, '0')}']), 'PLO-160');
    expect(prochainCode('CAR', const []), 'CAR-010');
    expect(niveauSensibilite(0.45).id, 'moyenne');
    expect(niveauSensibilite(1).label, 'Forte');
    expect(rechercherOuvrages([car010, receveur], 'carreler').map((o) => o['code']), ['CAR-010']);
    expect(rechercherOuvrages([car010, receveur], 'douche').map((o) => o['code']), ['PLO-120']);
    expect(etatTaux(taux: 0, defaut: 60).texte, 'Koji utilise 60 € en attendant');
    expect(etatTaux(taux: 55, valideLe: '02/11').etat, 'valide');
    expect(tauxOuvrage(receveur, tauxFamille: 0, tauxDefaut: 60), 60);
  });

  testWidgets('Bibliothèque : lignes des ouvrages et Mes prix', (tester) async {
    await _pump(tester, const BibliothequeProScreen(), [
      ouvragesProvider.overrideWith((ref) async => [car010, receveur]),
      tauxProvider.overrideWith((ref) async => taux),
      analyseFacturesProvider.overrideWith((ref) async => analyseTest),
    ]);
    expect(_contient('CAR-010 · 0,6 h/m² × 55 €/h'), findsWidgets);
    expect(_contient('33,00 €'), findsWidgets);
    expect(_contient('PLO-120 · 3,5 h/u × 60 €/h'), findsWidgets);

    await tester.tap(find.text('Mes prix'));
    await tester.pumpAndSettle();
    expect(_contient('validé le 02/11'), findsWidgets);
    expect(_contient('Koji utilise 60 € en attendant'), findsWidgets);
    expect(_contient('trop bas d\'environ 17 %'), findsWidgets);
  });

  testWidgets('Taux d\'après mes factures : appliquer la proposition', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const TauxFacturesScreen(), [
      bibliothequeRepositoryProvider.overrideWithValue(repo),
      analyseFacturesProvider.overrideWith((ref) async => analyseTest),
    ]);
    expect(_contient('Carrelage, faïence'), findsWidgets);
    expect(_contient('52 à 63 €'), findsWidgets);
    expect(_contient('1 ligne à vérifier'), findsWidgets);
    await tester.tap(find.text('Appliquer la proposition'));
    await tester.pumpAndSettle();
    expect(repo.appels.single[0], 'appliquer');
    expect(((repo.appels.single[1] as Map)['metiers'] as List).single, {'metier': 'Carreleur', 'taux': 58});
  });
}
