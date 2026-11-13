import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/pro_taches_screen.dart';
import 'package:koji/apps/entreprise/chantiers/taches_chantier.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Tâches du chantier Koji Pro (maquette PRO-02.7, fin octobre 2025) : mêmes
// exemples que le site (tests/unit/taches-chantier.test.js).
const _auj = '2025-10-30';
final _devis = {
  'id': 'q1',
  'projectId': 'c1',
  'items': [for (final r in ['Dépose', 'Électricité', 'Carrelage', 'Plomberie', 'Menuiserie', 'Peinture']) {'room': r}],
};
final _taches = <Map<String, dynamic>>[
  {'id': '1', 'projectId': 'c1', 'room': 'Carrelage', 'label': 'Finir la faïence de la douche', 'assignedTo': 'Rui C.', 'startDate': '2025-10-30', 'endDate': '2025-10-30'},
  {'id': '2', 'projectId': 'c1', 'room': 'Carrelage', 'label': 'Joints mur gauche', 'assignedTo': 'Rui C.', 'startDate': '2025-10-30', 'done': true},
  {'id': '3', 'projectId': 'c1', 'room': 'Carrelage', 'label': 'Joint silicone receveur', 'assignedTo': 'Rui C.', 'startDate': '2025-10-31'},
  {'id': '4', 'projectId': 'c1', 'room': 'Plomberie', 'label': 'Raccorder le mitigeur', 'assignedTo': 'Mehdi B.', 'startDate': '2025-11-03'},
  {'id': '5', 'projectId': 'c1', 'room': 'Plomberie', 'label': "Essai d'étanchéité", 'assignedTo': 'Mehdi B.', 'startDate': '2025-11-03', 'bloquant': {'raison': 'receveur livré vendredi'}},
  {'id': '6', 'projectId': 'c1', 'room': 'Peinture', 'label': 'Plafond 2 couches', 'assignedTo': 'À affecter', 'startDate': '2025-11-10'},
  {'id': '7', 'projectId': 'c1', 'room': 'Peinture', 'label': 'Porte et huisserie', 'assignedTo': '', 'startDate': '2025-11-12'},
];
const _equipe = [
  {'id': 'w1', 'name': 'Rui C.'},
  {'id': 'w2', 'name': 'Mehdi B.'},
];

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final appels = <String>[];
  Map<String, dynamic>? creee;

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async => switch (key) {
        'tasks' => _taches,
        'quotes' => [_devis],
        'workers' => _equipe.map(Map<String, dynamic>.from).toList(),
        _ => [],
      };

  @override
  Future<Map<String, dynamic>> basculerTache(String id) async {
    appels.add('basculer $id');
    return {'id': id};
  }

  @override
  Future<Map<String, dynamic>> enregistrerTache(Map<String, dynamic> tache, {String? id}) async {
    if (id == null) creee = tache;
    appels.add(id == null ? 'creer' : '${tache['action']} $id');
    return {...tache, 'id': id ?? 'tnew'};
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

  test('règles du site : lots, lignes, filtres, dictée', () {
    expect(tachesParLot(_taches, _devis).map((l) => '${l.titre} ${l.faites} / ${l.taches.length}'),
        ['Lot 03 · Carrelage 1 / 3', 'Lot 04 · Plomberie 0 / 2', 'Lot 06 · Peinture 0 / 2']);
    expect(ligneTache(_taches[0], _auj), 'Rui C. · jeu. 30');
    expect(ligneTache(_taches[3], _auj), 'Mehdi B. · lun. 3 nov.');
    expect(ligneTache(_taches[4], _auj), 'Mehdi B. · lun. 3 nov. · bloquant : receveur livré vendredi');
    expect(ligneTache(_taches[5], _auj), 'à affecter · sem. 46');
    expect(ligneTache({'assignedTo': 'Equipe', 'startDate': '2025-11-10'}, _auj), 'Équipe · lun. 10 nov.');
    expect(ligneTache({'assignedTo': 'Rui C.', 'startDate': '2025-10-27', 'endDate': '2025-10-29'}, _auj), 'Rui C. · lun. 27 → mer. 29');
    expect(semaine('2025-11-12'), 46);
    expect(etatTache(_taches[1], _auj), 'Fait');
    expect(etatTache(_taches[4], _auj), 'Bloquant');
    expect(etatTache({'startDate': '2025-10-20'}, _auj), 'En retard');
    expect(filtrerTaches(_taches, 'aujourdhui', _auj).map((t) => t['id']), ['1']);
    expect(filtrerTaches(_taches, 'bloquees', _auj).map((t) => t['id']), ['5']);
    expect(compterTaches(_taches, _auj), {'toutes': 7, 'faites': 1, 'aujourdhui': 1, 'bloquees': 1});

    final lots = ['Carrelage', 'Plomberie', 'Peinture'];
    final equipe = _equipe.map(Map<String, dynamic>.from).toList();
    final a = comprendreDictee('Poser les plinthes carrelées vendredi avec Rui', lots: lots, compagnons: equipe, aujourdhui: '2025-10-29');
    expect([a.label, a.lot, a.compagnonId, a.compagnonNom, a.jour], ['Poser les plinthes carrelées', 'Carrelage', 'w1', 'Rui C.', '2025-10-31']);
    final b = comprendreDictee('Mehdi purge les radiateurs demain', lots: lots, compagnons: equipe, aujourdhui: '2025-10-29');
    expect([b.label, b.compagnonId, b.jour], ['Purge les radiateurs', 'w2', '2025-10-30']);
    expect(comprendreDictee('Retouches peinture le 4', lots: lots, aujourdhui: '2025-10-29').jour, '2025-11-04');
    expect(comprendreDictee('Retouches peinture mercredi prochain', lots: lots, aujourdhui: '2025-10-29').jour, '2025-11-05');
  });

  testWidgets('liste, filtre, fait coché, tâche dictée', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProTachesScreen(projectId: 'c1', titreChantier: 'Caulaincourt', maintenant: () => DateTime(2025, 10, 30, 9)),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Tâches · 7 · 1 faite'), findsOneWidget);
    expect(find.text('Lot 03 · Carrelage'), findsOneWidget);
    await expectLater(find.byType(ProTachesScreen), matchesGoldenFile('goldens/pro_taches.png'));

    await tester.tap(find.textContaining('Bloquées'));
    await tester.pumpAndSettle();
    expect(find.text("Essai d'étanchéité"), findsOneWidget);
    expect(find.text('Raccorder le mitigeur'), findsNothing);
    await tester.tap(find.text('Toutes'));
    await tester.pumpAndSettle();

    // Cocher « Finir la faïence de la douche ».
    final ligne = find.ancestor(of: find.text('Finir la faïence de la douche'), matching: find.byType(Row)).first;
    await tester.tap(find.descendant(of: ligne, matching: find.byType(InkWell)).last);
    await tester.pumpAndSettle();
    expect(serveur.appels, contains('basculer 1'));

    // Ajouter en dictant.
    await tester.tap(find.text('Ajouter une tâche'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Poser les plinthes carrelées vendredi avec Rui');
    await tester.pumpAndSettle();
    expect(find.text('KOJI A COMPRIS'), findsOneWidget);
    expect(find.text('ven. 31 oct.'), findsOneWidget);
    await expectLater(find.byType(ProNouvelleTacheScreen), matchesGoldenFile('goldens/pro_nouvelle_tache.png'));
    await tester.tap(find.text('Ajouter'));
    await tester.pumpAndSettle();
    expect(serveur.creee?['label'], 'Poser les plinthes carrelées');
    expect(serveur.creee?['room'], 'Carrelage');
    expect(serveur.creee?['workerIds'], ['w1']);
    expect(serveur.creee?['startDate'], '2025-10-31');
  });
}
