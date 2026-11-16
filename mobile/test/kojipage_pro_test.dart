import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/kojipage/kojipage_pro.dart';

// Maquettes PRO-13 à 13.4 (téléphone).
final page = <String, dynamic>{
  'site': {'title': 'ABL Expert Renov', 'tagline': 'Rénovation intérieure · Paris', 'contactName': 'Bilal A.', 'contactPhone': '06 00 00 00 00', 'contactEmail': 'contact@exemple.invalid', 'specialties': ['Salle de bain', 'Peinture'], 'zoneIntervention': 'Paris 10e', 'prestations': [], 'sections': {}, 'couleur': 'marine'},
  'enLigne': true, 'nonPubliees': 2, 'url': 'https://getkoji.io/site/abl-expert-renov', 'qr': '',
  'offre': {'niveau': 'business', 'demandes': true, 'carte': true, 'couleur': true},
  'completude': {'pct': 80, 'prochaine': 'ajouter le prix de « Cloisons et faux plafonds »'},
  'visites': {'total': 412}, 'demandes': {'mois': 9, 'nouvelles': 2}, 'delai': 3, 'avisStats': {'moyenne': 4.8, 'nombre': 12},
  'realisations': {'publiee': 6, 'brouillon': 2}, 'carte': {'ouvertures': 38, 'contacts': 12},
  'couleurs': [{'id': 'marine', 'hex': '#0B1530'}], 'chantiers': [{'projectId': 'c1', 'titre': 'Peinture séjour', 'lieu': 'Paris 20e', 'termineLe': '2026-10-20', 'avant': 6, 'apres': 4}],
};
final demandes = <String, dynamic>{'demandes': [
  {'id': 'l1', 'titre': "Salle d'eau à refaire, 5 m²", 'client': 'Laura M.', 'ville': 'Paris 11e', 'createdAt': '2026-11-15T08:00:00Z', 'etat': 'a_repondre', 'etatTexte': 'À répondre', 'sourceTexte': 'via votre carte de visite', 'budget': 'budget compatible'},
]};
final demande = <String, dynamic>{'demande': {
  'id': 'l1', 'titre': "Salle d'eau à refaire, 5 m²", 'ville': 'Paris 11e', 'createdAt': '2026-11-15T08:00:00Z', 'etat': 'a_repondre', 'etatTexte': 'À répondre', 'sourceTexte': 'via votre carte de visite',
  'client': {'nom': 'Laura M.', 'masque': true}, 'message': 'Douche à la place de la baignoire.', 'projet': {'piece': 'Salle de bain', 'surface': 5, 'travaux': ['Tout refaire']},
  'photos': [], 'base': null, 'budgetDetail': {'compatible': true}, 'quoteId': '', 'messageDevis': '…',
}};

class _FakeRepo extends KojiPageRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <String>[];
  @override
  Future<Json> page() async => page_;
  @override
  Future<Json> demandes() async => demandes_;
  @override
  Future<Json> demande(String id) async => demande_;
  @override
  Future<Json> agir(String id, Json corps) async {
    appels.add('agir $id ${corps['action']}');
    return {'ok': true};
  }
  @override
  Future<Json> modifier(Json champs) async {
    appels.add('modifier ${champs.keys.join(',')}');
    return {'ok': true};
  }
  @override
  Future<Json> action(Json corps) async {
    appels.add('action ${corps['action']}');
    return {'ok': true};
  }
}
final page_ = page;
final demandes_ = demandes;
final demande_ = demande;

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, _FakeRepo repo) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [kojiPageRepositoryProvider.overrideWithValue(repo)], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('résumé : indicateurs, nouvelle demande, jauge, publier', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const KojiPageScreen(), repo);
    expect(_contient('412'), findsWidgets);
    expect(_contient("Salle d'eau à refaire"), findsWidgets);
    expect(_contient('Page complète à 80 %'), findsWidgets);
    expect(_contient('Cloisons et faux plafonds'), findsWidgets);
    await tester.tap(find.text('Publier les modifications (2)'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('action publier'));
  });

  testWidgets('demande : projet, base préparée par Koji', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const DemandeKojiPageScreen(id: 'l1'), repo);
    expect(_contient('Coordonnées complètes après votre réponse'), findsWidgets);
    expect(_contient('Tout refaire'), findsWidgets);
    expect(_contient('compatible'), findsWidgets);
    await tester.tap(find.text('Koji prépare une base de devis'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('agir l1 preparer'));
  });

  testWidgets('réglages : bouton de demande', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const ReglagesKojiPageScreen(), repo);
    expect(_contient('6 publiées · 2 brouillons'), findsWidgets);
    await tester.tap(find.byType(Switch).at(1));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('modifier sections'));
  });

  testWidgets('carte de visite : contenu et partage', (tester) async {
    await _pump(tester, const CarteKojiPageScreen(), _FakeRepo());
    expect(_contient('Bilal A. · Dirigeant'), findsWidgets);
    expect(_contient('Salle de bain · Peinture'), findsWidgets);
    expect(find.text('WhatsApp'), findsOneWidget);
  });
}
