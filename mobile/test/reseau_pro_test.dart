import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/reseau_pro/reseau_pro.dart';

// Maquettes PRO-14 et 14.1 (téléphone).
final reseau = <String, dynamic>{
  'locked': false,
  'me': {'companyName': 'ABL Expert Renov', 'professions': ['Plomberie'], 'city': 'Paris 10e'},
  'besoins': [
    {'id': 'b1', 'mine': true, 'companyName': 'ABL Expert Renov', 'metier': 'Plomberie', 'title': 'création alimentation et évacuation, receveur', 'startDate': '2026-11-16', 'endDate': '2026-11-18', 'days': 3, 'city': 'Paris 10e', 'distanceKm': null, 'budgetHt': 1650, 'responses': 2, 'myEchangeId': '', 'status': 'ouvert'},
    {'id': 'b2', 'mine': false, 'companyName': 'Rénov Horizon', 'metier': 'Électricité', 'title': 'tableau et circuits, appartement 62 m²', 'startDate': '2026-11-23', 'endDate': '2026-11-26', 'days': 4, 'city': 'Saint-Ouen', 'distanceKm': 3.8, 'budgetHt': 2400, 'responses': 4, 'myEchangeId': '', 'status': 'ouvert'},
  ],
  'pros': [{'id': 'p1', 'companyName': 'Bâti Nord', 'metiers': ['Plomberie', 'chauffage'], 'zone': 'Paris', 'availableFrom': '2026-11-20', 'documentsOk': true, 'distanceKm': 2.1}],
  'lots': [{'cle': 'c1|Lot 04 Électricité', 'projectId': 'c1', 'projectTitle': 'Salle de bain, Paris 10e', 'lot': 'Lot 04 Électricité', 'debut': '2026-11-20', 'fin': '2026-11-21', 'totalHt': 900, 'moHt': 600, 'publie': false}],
  'echanges': [{'id': 'e1', 'besoinId': 'b1', 'besoinTitle': 'création alimentation et évacuation', 'iOwnBesoin': true, 'other': {'companyName': 'Bâti Nord', 'initials': 'BN'}, 'status': 'retenu', 'messages': [{'id': 'm1', 'mine': false, 'text': 'Disponible le 16, 1 600 € HT.'}]}],
};
final contrat = <String, dynamic>{'contrat': {
  'id': 'st1', 'sousTraitant': 'Rénov Horizon Carrelage', 'lot': 'lot carrelage', 'chantier': 'Appartement Caulaincourt, Paris', 'prixHt': 9800, 'debut': '2026-11-16', 'fin': '2026-11-27', 'paiement': '30 jours, après situation acceptée',
  'etat': {'cle': 'presente', 'label': 'Présenté au client · accord en attente'}, 'manques': <String>[], 'presenteLe': '2026-11-12T10:00:00Z', 'relance': '2026-11-14', 'envoyeLe': '', 'accepteLe': '', 'refuseLe': '', 'garantie': '',
  'lignes': [['Entreprise principale', 'ABL Expert Renov'], ['Prix', '9 800,00 € HT · autoliquidation de la TVA'], ['Délais', 'du 16 au 27 nov.']],
  'garanties': {'delegation': 'Délégation de paiement par le client', 'caution': 'Caution bancaire'},
}};

class _FakeRepo extends ReseauRepository {
  _FakeRepo({this.verrouille = false}) : super(KojiProApi(tokenProvider: () async => 'test'));
  final bool verrouille;
  final appels = <String>[];
  @override
  Future<Json> reseau() async => verrouille ? {'locked': true, 'vitrine': {'total': 38, 'parMetier': [{'metier': 'Plomberie', 'n': 11}, {'metier': 'Électricité', 'n': 9}]}} : reseau_;
  @override
  Future<Json> contrat(String id) async => contrat_;
  @override
  Future<Json> agir(Json corps) async {
    appels.add('agir ${corps['action']}');
    return {'ok': true};
  }
  @override
  Future<Json> majContrat(String id, Json corps) async {
    appels.add('contrat ${corps['action']} ${corps['garantie'] ?? ''}'.trim());
    return {'ok': true};
  }
}
final reseau_ = reseau;
final contrat_ = contrat;

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, _FakeRepo repo) async {
  tester.view.physicalSize = const Size(430, 2600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [reseauRepositoryProvider.overrideWithValue(repo)], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('besoins, lots sans intervenant, pros', (tester) async {
    await _pump(tester, const ReseauProScreen(), _FakeRepo());
    expect(_contient('Plomberie · création alimentation'), findsWidgets);
    expect(_contient('1 650 € HT'), findsWidgets);
    expect(_contient('Réponses (2)'), findsWidgets);
    expect(_contient('Lot 04 Électricité'), findsWidgets);
    await tester.tap(_contient('Pros 1').first);
    await tester.pumpAndSettle();
    expect(_contient('Bâti Nord'), findsWidgets);
    expect(_contient('Documents à jour'), findsWidgets);
  });

  testWidgets('vitrine Start', (tester) async {
    await _pump(tester, const ReseauProScreen(), _FakeRepo(verrouille: true));
    expect(_contient('38 pros dans le réseau'), findsWidgets);
    expect(_contient('Plomberie 11 · Électricité 9'), findsWidgets);
    expect(find.text('Publier un besoin'), findsNothing);
  });

  testWidgets('échange : pro retenu, préparer le contrat', (tester) async {
    await _pump(tester, const EchangeReseauScreen(id: 'e1'), _FakeRepo());
    expect(_contient('Disponible le 16'), findsWidgets);
    expect(find.text('Préparer le contrat'), findsOneWidget);
    expect(find.text('Retenir ce pro'), findsNothing);
  });

  testWidgets('contrat : lignes, accord en attente, garantie', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const ContratReseauScreen(id: 'st1'), repo);
    expect(_contient('9 800,00 € HT · autoliquidation de la TVA'), findsWidgets);
    expect(_contient('en attente · relance le'), findsWidgets);
    await tester.tap(find.text('Caution bancaire'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('contrat garantie caution'));
  });
}
