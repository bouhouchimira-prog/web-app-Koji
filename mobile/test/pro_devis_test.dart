import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/devis/devis_liste.dart';
import 'package:koji/apps/entreprise/devis/pro_devis_screen.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Liste des devis Koji Pro (maquette PRO-03, 29 octobre 2026) : mêmes
// exemples que le site (tests/unit/devis-liste.test.js).
const _auj = '2026-10-29';
final _devis = <Map<String, dynamic>>[
  {'id': 'q41', 'quoteNumber': '2026-041', 'client': 'Mme Lefèvre', 'project': 'Salle de bain, Paris 10e', 'totalHt': 5271.4, 'status': 'Brouillon', 'updatedAt': '2026-10-29T12:42:00', 'createdAtIso': '2026-10-29T08:00:00Z'},
  {'id': 'q40', 'quoteNumber': '2026-040', 'client': 'Marc Lenoir', 'project': 'Peinture séjour et couloir, Paris 18e', 'totalHt': 3640, 'status': 'Envoye', 'sentAt': '2026-10-27T09:00:00Z', 'viewedAt': '2026-10-27T20:00:00Z', 'createdAtIso': '2026-10-26T08:00:00Z'},
  {'id': 'q39', 'quoteNumber': '2026-039', 'client': 'Copropriété Exemple', 'project': "Reprise cage d'escalier, Paris 20e", 'totalHt': 12480, 'status': 'Envoye', 'sentAt': '2026-10-14T09:00:00Z', 'clientEmail': 'syndic@exemple.fr', 'createdAtIso': '2026-10-13T08:00:00Z'},
  {'id': 'q38', 'quoteNumber': '2026-038', 'client': 'Nadia Benarab', 'project': 'Tableau électrique, Saint-Ouen', 'totalHt': 1420, 'status': 'Envoye', 'sentAt': '2026-10-25T09:00:00Z', 'createdAtIso': '2026-10-24T08:00:00Z'},
  {'id': 'q37', 'quoteNumber': '2026-037', 'client': 'SCI Bureaux Auteuil', 'project': 'Bureaux Auteuil', 'totalHt': 48200, 'status': 'Signe', 'signatureStatus': 'Signe', 'signedAt': '2026-10-09T10:00:00Z', 'projectId': 'p37', 'createdAtIso': '2026-10-01T08:00:00Z'},
  {'id': 'q36', 'quoteNumber': '2026-036', 'client': 'Mme Lefèvre', 'project': 'Rénovation, Caulaincourt', 'totalHt': 27900, 'status': 'Signe', 'signedAt': '2026-09-02T10:00:00Z', 'createdAtIso': '2026-08-30T08:00:00Z'},
  {'id': 'q34', 'quoteNumber': '2026-034', 'client': 'Julien Morel', 'project': 'Cuisine, Paris 15e', 'totalHt': 9850, 'status': 'Envoye', 'sentAt': '2026-09-20T09:00:00Z', 'validityDays': 30, 'createdAtIso': '2026-09-19T08:00:00Z'},
];

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final appels = <String>[];

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async => switch (key) {
        'quotes' => _devis,
        'projects' => [
            {'id': 'p37', 'status': 'En cours'}
          ],
        _ => [],
      };

  @override
  Future<Map<String, dynamic>> relancerDevis(String id, String message) async {
    appels.add('relancer $id');
    return {};
  }

  @override
  Future<Map<String, dynamic>> dupliquerDevis(Map<String, dynamic> devis) async {
    appels.add('dupliquer ${devis['id']}');
    return {'quoteNumber': '2026-042'};
  }
}

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _chargerDmSans();
  });

  test('statuts, dernière action, actions, compteurs (règles du site)', () {
    expect(_devis.map((q) => statutDevis(q, _auj).label), ['Brouillon', 'Envoyé', 'À relancer', 'Envoyé', 'Signé', 'Signé', 'Expiré']);
    expect(derniereAction(_devis[1], _auj), 'Envoyé le 27 oct. · vu par le client');
    expect(derniereAction(_devis[2], _auj), 'Envoyé le 14 oct. · sans réponse');
    expect(derniereAction(_devis[3], _auj), 'Envoyé le 25 oct.');
    expect(derniereAction(_devis[4], _auj, chantierEnCours: true), 'Signé le 9 oct. · chantier en cours');
    expect(derniereAction(_devis[6], _auj), 'Validité dépassée le 20 oct.');
    expect(_devis.map((q) => actionDevis(q, _auj).label), ['Reprendre', 'Voir', 'Relancer', 'Voir', 'Voir', 'Voir', 'Dupliquer']);
    final c = compterDevis(_devis, _auj);
    expect([c['tous'], c['brouillon'], c['envoye'], c['signe'], c['termine'], c['relancer'], c['badge']], [7, 1, 3, 2, 1, 1, 1]);
    expect(resumeDevis(c), '7 devis · 3 envoyés en attente · 1 à relancer · 1 brouillon');
    expect(resumeDevis(c, avecTotal: false), '3 envoyés · 1 à relancer · 1 brouillon');
    final relance = {..._devis[2], 'relances': [{'le': '2026-10-27T09:00:00Z'}]};
    expect(statutDevis(relance, _auj).label, 'Envoyé');
    expect(derniereAction(relance, _auj), 'Relancé le 27 oct.');
    expect(messageRelance(_devis[2], entreprise: 'ABL Expert Renov'),
        contains("devis 2026-039 (Reprise cage d'escalier, Paris 20e), envoyé le 14 oct. Il reste valable jusqu'au 13 nov."));
  });

  testWidgets('liste, onglets, relance et duplication', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    final ouverts = <String>[];
    await tester.pumpWidget(ProviderScope(
      overrides: [
        proKojiWebProvider.overrideWithValue(serveur),
        currentAccountProvider.overrideWith((ref) async => null),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: ProDevisScreen(
            maintenant: () => DateTime(2026, 10, 29, 20),
            ouvrir: (context, ref, q) async => ouverts.add(q['id'] as String),
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('3 envoyés · 1 à relancer · 1 brouillon'), findsOneWidget);
    expect(find.text('Tous 7'), findsOneWidget);
    expect(find.text('À relancer'), findsOneWidget);
    await expectLater(find.byType(ProDevisScreen), matchesGoldenFile('goldens/pro_devis.png'));

    await tester.tap(find.text('Signés 2'));
    await tester.pumpAndSettle();
    expect(find.text('Signé le 9 oct. · chantier en cours'), findsOneWidget);
    await tester.tap(find.text('Bureaux Auteuil'));
    await tester.pumpAndSettle();
    expect(ouverts, ['q37']);

    await tester.tap(find.text('Envoyés 3'));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Reprise cage d'escalier, Paris 20e"));
    await tester.pumpAndSettle();
    expect(find.text('Relancer le devis 2026-039'), findsOneWidget);
    await tester.tap(find.text('Envoyer la relance'));
    await tester.pumpAndSettle();
    expect(serveur.appels, ['relancer q39']);
    ScaffoldMessenger.of(tester.element(find.byType(ProDevisScreen))).removeCurrentSnackBar();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tous 7'));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(find.text('Cuisine, Paris 15e'), find.byType(ListView), const Offset(0, -200));
    await tester.tap(find.text('Cuisine, Paris 15e'));
    await tester.pumpAndSettle();
    expect(serveur.appels.last, 'dupliquer q34');
  });
}
