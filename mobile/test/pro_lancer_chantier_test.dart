import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/chantiers_liste.dart';
import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/pro_lancer_chantier_screen.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Lancer le chantier (maquette PRO-02.1) : planning proposé (mêmes dates
// que le site, tests/unit/planning-chantier.test.js), règle « à lancer » de
// la liste, et parcours complet avec un faux serveur getkoji.io.
Map<String, dynamic> _l(
        String room, String code, String label, num ht, num h) =>
    {
      'room': room,
      'code': code,
      'label': label,
      'totalHt': ht,
      'correctedTimeHours': h,
      'unit': 'u',
      'quantity': 1
    };

final _devis = {
  'id': 'q1',
  'projectId': 'c1',
  'quoteNumber': '2026-041',
  'status': 'Signe',
  'client': 'Mme Lefèvre',
  'clientEmail': 'lefevre@exemple.fr',
  'totalHt': 5271.4,
  'items': [
    _l('Dépose et préparation', 'D1', 'Déposer la baignoire', 180, 4),
    _l('Dépose et préparation', 'D2', 'Déposer le carrelage', 543.2, 7.76),
    _l('Dépose et préparation', 'E1', 'Évacuer les gravats', 260, 2),
    _l('Plomberie', 'P1', "Créer l'alimentation", 420, 7),
    _l('Plomberie', 'P2', 'Poser le receveur', 690, 6),
    _l('Plomberie', 'P3', 'Poser la colonne', 540, 5),
    _l('Carrelage et faïence', 'C1', 'Poser le carrelage', 551, 12),
    _l('Carrelage et faïence', 'C2', 'Poser la faïence', 1707.2, 30),
    _l('Électricité', 'L1', 'Créer le circuit', 380, 6),
  ],
};

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final taches = <Map<String, dynamic>>[];
  var suivi = false;

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async =>
      switch (path) {
        '/api/projects' => [
            {
              'id': 'c1',
              'title': 'Salle de bain, Paris 10e',
              'address': '12 rue Exemple, 75010 Paris'
            }
          ],
        '/api/quotes' => [_devis],
        '/api/workers' => [
            {'id': 'w1', 'name': 'Bâti Nord', 'type': 'Sous-traitant'}
          ],
        _ => [],
      };

  @override
  Future<Map<String, dynamic>> profil() async => {
        'business': {'hoursPerDay': 7}
      };

  @override
  Future<Map<String, dynamic>?> accesClient(String projectId) async => null;

  @override
  Future<void> activerSuiviClient(String p, String e, String t) async =>
      suivi = true;

  @override
  Future<Map<String, dynamic>> enregistrerTache(Map<String, dynamic> tache,
      {String? id}) async {
    taches.add(tache);
    return {'id': 't${taches.length}', ...tache};
  }
}

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _chargerDmSans();
  });

  test('planning de la maquette : 12 jours ouvrés, 11 novembre sauté', () {
    expect(joursFeries(2026).contains('2026-05-25'), isTrue);
    expect(estOuvre('2026-11-11'), isFalse);
    expect(demarragePropose('2026-11-06'), '2026-11-12');
    final p = proposerPlanning(_devis, debut: '2026-11-12');
    expect([
      for (final l in p.lots) (l.numero, l.debut, l.fin, l.jours)
    ], [
      ('01', '2026-11-12', '2026-11-13', 2),
      ('02', '2026-11-16', '2026-11-18', 3),
      ('03', '2026-11-19', '2026-11-26', 6),
      ('04', '2026-11-27', '2026-11-27', 1),
    ]);
    expect((p.fin, p.joursOuvres), ('2026-11-27', 12));
    expect(p.lots.first.montantHt, 983.2);
    final p2 =
        proposerPlanning(_devis, debut: '2026-11-12', durees: {'Plomberie': 1});
    expect(p2.lots[2].debut, '2026-11-17');
  });

  test('un chantier signé sans rien de planifié reste « à lancer »', () {
    final [l] = lignesChantiers(
      maintenant: DateTime(2026, 11, 12),
      projects: [
        {'id': 'c1', 'title': 'Salle de bain'}
      ],
      quotes: [_devis],
    );
    expect((l.onglet, l.aLancer, l.etiquette),
        ('a_planifier', true, 'À planifier'));
    expect(l.jalon, 'Chantier à lancer : planning à valider');
  });

  testWidgets('créer le chantier planifie chaque ligne à la date de son lot',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ProLancerChantierScreen(
                        projectId: 'c1', aujourdhui: DateTime(2026, 11, 6)))),
                child: const Text('ouvrir'),
              ),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    // 12 novembre 2026 est un jeudi (la maquette dit « Mercredi »).
    expect(find.text('Jeudi 12 nov.'), findsOneWidget);
    expect(find.text('27 nov. · 12 j ouvrés'), findsOneWidget);
    expect(find.text('Lot 03 · Carrelage et faïence'), findsOneWidget);
    await expectLater(find.byType(ProLancerChantierScreen),
        matchesGoldenFile('goldens/pro_lancer_chantier.png'));

    await tester.tap(find.text('Créer le chantier'));
    await tester.pumpAndSettle();
    expect(serveur.taches.length, 9);
    final carrelage =
        serveur.taches.where((t) => t['room'] == 'Carrelage et faïence');
    expect(
        carrelage.every((t) =>
            t['startDate'] == '2026-11-19' && t['endDate'] == '2026-11-26'),
        isTrue);
    expect(serveur.suivi, isTrue);
    expect(find.byType(ProLancerChantierScreen), findsNothing);
  });
}
