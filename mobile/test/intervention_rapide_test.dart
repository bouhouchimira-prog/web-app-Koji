import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/intervention_rapide/intervention_rapide.dart';

// Maquette PRO-17.1 : Mme Lefèvre, fuite sous l'évier.
Json _intervention(String etape, {Json? devis, Json? facture}) => {
      'id': 'int-1', 'reference': 'INT-2026-0001', 'client': 'Mme Lefèvre', 'telephone': '', 'email': '', 'site': '12 rue Exemple, Paris 10e', 'acces': '3e gauche · code 4521B',
      'probleme': "Fuite sous l'évier", 'urgence': 'maintenant', 'prix': {'deplacement': 89, 'demiHeure': 35}, 'etape': etape,
      'accepteLe': '2026-10-30T09:19:00Z', 'prixEnvoyeLe': '2026-10-30T09:18:00Z', 'enRouteLe': '2026-10-30T09:20:00Z', 'arriveeVers': '10:42', 'arriveLe': '',
      'devis': devis ?? {'lignes': [], 'enPlus': [], 'pieces': '', 'signeLe': ''}, 'photos': [], 'total': 101, 'totalEnPlus': 0,
      'mention': 'Réparation urgente demandée par le client, limitée au strict nécessaire : pas de délai de rétractation.', 'mentionEnPlus': 'Devis séparé : 14 jours pour se rétracter, rien à payer avant 7 jours.',
      'itineraire': 'https://www.google.com/maps/dir/?api=1&destination=x', 'lienClient': 'https://getkoji.io/intervention/abc', 'invoiceId': facture == null ? '' : 'fac-1', 'facture': facture,
    };

class _FakeRepo extends InterventionRapideRepository {
  _FakeRepo(this.etape) : super(KojiProApi(tokenProvider: () async => 'test'), token: () async => 'test');
  final String etape;
  final appels = <String>[];
  @override
  Future<Json> liste() async => {'entreprise': 'Karim B. Plomberie', 'prix': {'deplacement': 89, 'demiHeure': 35}, 'interventions': []};
  @override
  Future<Json> une(String id) async => {
        'intervention': _intervention(etape),
        'moyens': {'terminal': 'Carte, mon terminal', 'especes': 'Espèces', 'virement': 'Virement', 'cheque': 'Chèque'},
        'pieces': {'garde': 'Le client garde les pièces remplacées', 'refuse': "Le client n'en veut pas"},
        'entreprise': 'Karim B. Plomberie',
      };
  @override
  Future<Json> agir(Json corps) async {
    appels.add('${corps['action']}');
    return {'intervention': _intervention(etape), 'message': ''};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, _FakeRepo repo) async {
  tester.view.physicalSize = const Size(430, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [interventionRapideRepositoryProvider.overrideWithValue(repo)], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('prix écrits et montants', () {
    expect(messagePrix('Karim B. Plomberie', {'deplacement': 89, 'demiHeure': 35}), 'Karim B. Plomberie : déplacement et 1re demi-heure 89 € TTC, puis 35 € la demi-heure. Devis gratuit, signé avant tout travail.');
    expect(messagePrix('K', {}), '');
    expect(euros2(101), '101,00 €');
    expect(euros2(1450.5), '1 450,50 €');
    expect(totalLignes([{'ttc': 89}, {'ttc': 12}]), 101);
  });

  testWidgets('nouvelle intervention : prix envoyés, créer et partir', (tester) async {
    final repo = _FakeRepo('creee');
    await _pump(tester, const NouvelleInterventionScreen(), repo);
    expect(_contient('déplacement et 1re demi-heure 89 € TTC'), findsWidgets);
    expect(_contient('Oui, ce matin'), findsWidgets);
    await tester.enterText(find.byType(TextField).first, 'Mme Lefèvre');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Créer et partir'));
    await tester.pump();
    expect(repo.appels, contains('creer'));
  });

  testWidgets('en route : arrivée vers, je suis arrivé', (tester) async {
    final repo = _FakeRepo('en_route');
    await _pump(tester, const SuiviInterventionScreen(id: 'int-1'), repo);
    expect(_contient('prix accepté par écrit'), findsWidgets);
    expect(_contient('arrivée vers 10:42'), findsWidgets);
    expect(_contient('Itinéraire'), findsWidgets);
    await tester.tap(find.text('Je suis arrivé'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('arrive'));
  });

  testWidgets('sur place : devis avant travaux en deux blocs, signature', (tester) async {
    await _pump(tester, const SuiviInterventionScreen(id: 'int-1'), _FakeRepo('sur_place'));
    expect(_contient('Urgence · le strict nécessaire'), findsWidgets);
    expect(_contient('89,00 €'), findsWidgets);
    expect(_contient('pas de délai de rétractation'), findsWidgets);
    expect(_contient('Proposé en plus · devis séparé'), findsWidgets);
    expect(_contient('Le client garde les pièces remplacées'), findsWidgets);
    expect(_contient('Signature de Mme Lefèvre'.toUpperCase()), findsWidgets);
  });

  testWidgets('terminer : payé par, facture', (tester) async {
    final repo = _FakeRepo('devis_signe');
    await _pump(tester, const SuiviInterventionScreen(id: 'int-1'), repo);
    expect(_contient('Carte, mon terminal'), findsWidgets);
    expect(_contient('Paiement dans Koji : prévu dans une version suivante.'), findsWidgets);
    await tester.tap(find.text('Encaissé, créer la facture'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('terminer'));
  });
}
