import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/equipe/compagnon_app.dart';
import 'package:koji/features/equipe/equipe_pro.dart';

// Maquettes PRO-16 à 16.4 (téléphone), semaine du 26 au 30 octobre 2026.
const _roles = {
  'compagnon': {'label': 'Compagnon', 'detail': 'sa journée, ses tâches, pointer, envoyer des photos · aucun prix'},
  'chef': {'label': 'Chef de chantier', 'detail': "en plus : le planning et les chantiers qu'il suit"},
  'dirigeant': {'label': 'Dirigeant', 'detail': 'tout, y compris prix, factures et comptabilité'},
};
final _equipe = <String, dynamic>{
  'aujourdhui': '2026-10-30',
  'roles': _roles,
  'equipe': [
    {'id': 's', 'nom': 'Samir T.', 'metier': 'Chef de chantier', 'statut': 'arrive', 'texte': 'arrivé 7 h 32', 'chantier': 'Caulaincourt'},
    {'id': 'm', 'nom': 'Mehdi B.', 'metier': 'Préparation', 'statut': 'pas_arrive', 'texte': 'pas encore arrivé', 'chantier': 'Salle de bain, Paris 10e', 'telephone': '0600000000'},
    {'id': 'i', 'nom': 'Ionut P.', 'metier': 'Plaquiste', 'statut': 'conge', 'texte': 'congé', 'chantier': ''},
  ],
  'kpis': {'surChantier': 1, 'total': 3, 'heuresSemaine': 8610, 'aValider': true},
  'documents': [{'workerId': 'r', 'nom': 'Rui C.', 'document': 'Carte BTP', 'jusqua': '2026-11-28'}],
  'appris': [{'cle': 'q:1', 'titre': 'Faïence murale, Caulaincourt', 'resume': '51 h faites pour 42 h prévues', 'texte': 'Sur ce lot, la pose vous prend 1,02 h/m².'}],
};
Json _case(String date, String statut, int minutes) => {'date': date, 'statut': statut, 'minutes': minutes};
final _semaine = <String, dynamic>{
  'grille': {'lundi': '2026-10-26', 'total': 4410, 'lignes': [
    {'workerId': 'r', 'nom': 'Rui C.', 'total': 2310, 'cases': [_case('2026-10-26', 'ok', 480), _case('2026-10-27', 'ok', 480), _case('2026-10-28', 'ok', 450), _case('2026-10-29', 'ok', 480), _case('2026-10-30', 'ok', 420)]},
    {'workerId': 'm', 'nom': 'Mehdi B.', 'total': 2100, 'cases': [_case('2026-10-26', 'ok', 420), _case('2026-10-27', 'ok', 420), _case('2026-10-28', 'douteux', 420), _case('2026-10-29', 'ok', 420), _case('2026-10-30', 'ok', 420)]},
  ]},
  'remarques': [{'type': 'depart', 'workerId': 'm', 'date': '2026-10-28', 'texte': "Mehdi B. n'a pas pointé son départ mercredi", 'detail': 'Koji a mis 7 h, comme les autres jours.'}],
  'validation': null,
  'parWorker': {'r': [{'chantier': 'Salle de bain, Paris 10e', 'jours': 5}], 'm': [{'chantier': 'Caulaincourt', 'jours': 2}, {'chantier': 'Paris 10e', 'jours': 3}]},
  'sousTraitants': [{'id': 'x', 'nom': 'Électricité Benarab'}],
};
final _fiche = <String, dynamic>{'roles': _roles, 'fiche': {
  'id': 'r', 'nom': 'Rui C.', 'metier': 'Carreleur', 'role': 'compagnon', 'telephone': '06 12 34 18 44', 'langue': 'pt', 'coutHoraire': 31.5, 'depuis': '2025-03-03',
  'heures': [{'semaine': 'S43', 'minutes': 2190}, {'semaine': 'S44', 'minutes': 2310}],
  'semaine': {'chantiers': ['Salle de bain, Paris 10e'], 'minutes': 2280},
  'documents': [{'id': 'd1', 'nom': 'Carte BTP', 'jusqua': '2028-03-31'}],
  'invitation': {'code': 'K7P2QMXA', 'message': 'Bonjour Rui, ABL Expert Renov vous invite sur Koji…'},
}};

class _FakeRepo extends EquipeRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <String>[];
  @override
  Future<Json> equipe() async => _equipe;
  @override
  Future<Json> semaine(String lundi) async => _semaine;
  @override
  Future<Json> fiche(String id) async => _fiche;
  @override
  Future<Json> agir(Json corps) async {
    appels.add('${corps['action']}');
    return {'ok': true, 'id': 'n1', 'invitation': {'code': 'ABCD2345', 'message': 'Bonjour Ionut…'}};
  }
}

final _vue = <String, dynamic>{
  'entreprise': 'ABL Expert Renov',
  'compagnon': {'prenom': 'Rui', 'nom': 'Rui C.', 'langue': 'pt'},
  'journee': {'jour': '2026-10-30', 'chantier': 'Caulaincourt', 'adresse': '37 rue Exemple, Paris 15e', 'projectId': 'c', 'horaire': '7 h 30 – 16 h', 'avec': ['Samir'], 'conge': false,
    'taches': [{'id': 't1', 'label': 'Finir la faïence de la douche', 'chantier': 'Caulaincourt', 'lot': 'lot 03', 'consigne': 'Faïence 30 × 60 blanc mat', 'quantite': 14, 'unite': 'm²', 'aPrendre': [{'label': 'Colle C2', 'quantite': 2, 'unite': 'sacs'}], 'fait': false}],
    'consignes': ['Ne pas percer le sol : amiante.'], 'pointage': {'arriveA': '', 'ouvert': false, 'minutes': 0}},
  'semaine': {'lundi': '2026-10-26', 'minutes': 1950, 'jours': [
    {'jour': '2026-10-26', 'chantier': 'Caulaincourt', 'avec': [], 'horaire': '7 h 30 – 16 h', 'minutes': 480, 'valide': true},
    {'jour': '2026-10-30', 'chantier': 'Caulaincourt', 'avec': ['Samir'], 'horaire': '7 h 30 – 12 h', 'minutes': 0, 'valide': false, 'aujourdhui': true},
  ]},
  'semainePrecedente': {'minutes': 2340, 'validation': {'lundi': '2026-10-19'}, 'contrat': 35},
  'documents': [], 'messages': [],
};

class _FakeCompagnon extends CompagnonApi {
  _FakeCompagnon() : super(api: KojiProApi(tokenProvider: () async => 'test'));
  final appels = <String>[];
  Json d = _vue;
  @override
  Future<bool> connecte() async => true;
  @override
  Future<Json> vue() async => d;
  @override
  Future<Json> agir(Json corps) async {
    appels.add('${corps['action']}');
    if (corps['action'] == 'arrive') {
      d = {...d, 'journee': {...(d['journee'] as Map), 'pointage': {'arriveA': '07:58', 'ouvert': true, 'minutes': 372}}};
      return d;
    }
    return {'ok': true};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, [_FakeRepo? repo]) async {
  tester.view.physicalSize = const Size(430, 2600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [equipeRepositoryProvider.overrideWithValue(repo ?? _FakeRepo())], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('heures, initiales, invitation', () {
    expect(heuresDecimales(510), '8,5 h');
    expect(heuresDecimales(2400), '40 h');
    expect(heuresMinutes(372), '6 h 12');
    expect(initiales('Rui C.'), 'RC');
    expect(lundiDe('2026-10-30'), '2026-10-26');
    expect(dateLongue('2026-10-30'), 'vendredi 30 octobre');
    expect(estCodeInvitation('k7p2qmxa'), isTrue);
    expect(estCodeInvitation('OUV-ABC234'), isFalse);
    expect(smsUri('06 12 34 18 44', 'Bonjour Rui').toString(), 'sms:0612341844?&body=Bonjour%20Rui');
  });

  testWidgets("PRO-16 : qui est où aujourd'hui, ce que Koji a appris", (tester) async {
    await _pump(tester, const EquipeScreen());
    expect(_contient('1 sur 3'), findsWidgets);
    expect(_contient('143,5 h'), findsWidgets);
    expect(_contient('arrivé 7 h 32'), findsWidgets);
    expect(_contient('pas encore arrivé'), findsWidgets);
    expect(_contient("Mehdi n'est pas encore arrivé"), findsWidgets);
    expect(_contient('Carte BTP de Rui C.'), findsWidgets);
    expect(_contient('51 h faites pour 42 h prévues'), findsWidgets);
  });

  testWidgets('PRO-16.2 : heures de la semaine, sous-traitant non compté, valider', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const HeuresEquipeScreen(), repo);
    expect(_contient('38,5 h'), findsWidgets);
    expect(_contient('Caulaincourt · 2 jours, Paris 10e · 3 jours'), findsWidgets);
    expect(_contient("Mehdi B. n'a pas pointé son départ mercredi"), findsWidgets);
    expect(_contient('sous-traitant · non compté'), findsWidgets);
    await tester.tap(find.text('Valider la semaine'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('valider'));
  });

  testWidgets('PRO-16.1 : fiche compagnon', (tester) async {
    await _pump(tester, const FicheCompagnonScreen(id: 'r'));
    expect(_contient('Carreleur · Compagnon'), findsWidgets);
    expect(_contient('portugais'), findsWidgets);
    expect(_contient('31,50 € · vous seul le voyez'), findsWidgets);
    expect(_contient('38,5 h'), findsWidgets);
    expect(_contient("valable jusqu'en mars 2028"), findsWidgets);
    expect(_contient('K7P2QMXA'), findsWidgets);
  });

  testWidgets('PRO-16.3 : ajouter un compagnon, trois rôles', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const AjouterCompagnonScreen(), repo);
    expect(_contient('Chef de chantier'), findsWidgets);
    expect(_contient('aucun prix'), findsWidgets);
    await tester.enterText(find.byType(TextField).first, 'Ionut P.');
    await tester.pumpAndSettle();
    await tester.tap(find.text("Envoyer l'invitation"));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('ajouter'));
    expect(_contient('ABCD2345'), findsWidgets);
  });

  testWidgets('PRO-16.4 : journée du compagnon, je suis arrivé, ma semaine', (tester) async {
    tester.view.physicalSize = const Size(430, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _FakeCompagnon();
    await tester.pumpWidget(MaterialApp(home: CompagnonApp(api: api)));
    await tester.pumpAndSettle();
    expect(_contient('Bonjour Rui'), findsWidgets);
    expect(_contient('vendredi 30 octobre'), findsWidgets);
    expect(_contient('7 h 30 · avec Samir'), findsWidgets);
    expect(_contient('Ne pas percer le sol : amiante.'), findsWidgets);
    expect(_contient('€'), findsNothing);
    await tester.tap(find.text('Je suis arrivé'));
    await tester.pumpAndSettle();
    expect(api.appels, contains('arrive'));
    expect(_contient('arrivé à 7 h 58'), findsWidgets);
    expect(_contient('6 h 12'), findsWidgets);
    expect(find.text('Je pars'), findsOneWidget);
    await tester.tap(find.text('Ma semaine'));
    await tester.pumpAndSettle();
    expect(_contient('32 h 30 pointé'), findsWidgets);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finir la faïence de la douche'));
    await tester.pumpAndSettle();
    expect(_contient('À PRENDRE AU DÉPÔT'), findsWidgets);
    expect(_contient('Colle C2 · 2 sacs'), findsWidgets);
  });
}
