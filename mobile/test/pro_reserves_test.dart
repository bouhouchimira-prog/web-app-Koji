import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Réserves Koji Pro (maquette PRO-02.3, téléphone) : règles du site
// (tests/unit/reserves.test.js), écran, ajout en photo, validation.
final _reserves = [
  {
    'id': 'r1',
    'numero': 'R1',
    'titre': 'Joint silicone du receveur',
    'statut': 'a_faire',
    'attribueeNom': 'Rui C.',
    'pourLe': '2026-12-02'
  },
  {
    'id': 'r2',
    'numero': 'R2',
    'titre': 'Rayure sur la porte',
    'statut': 'faite',
    'attribueeNom': 'Menuiserie Ortega · sous-traitant',
    'note': 'Porte reprise.'
  },
  {
    'id': 'r3',
    'numero': 'R3',
    'titre': 'Spot de douche',
    'statut': 'a_faire',
    'attribueeNom': 'Électricité Benarab · sous-traitant',
    'pourLe': '2026-11-05'
  },
  {
    'id': 'r4',
    'numero': 'R4',
    'titre': 'Peinture plafond',
    'statut': 'levee',
    'leveeLe': '2026-11-28T14:00:00Z'
  },
];

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final creees = <Map<String, dynamic>>[];
  final photos = <(String, String)>[];
  final actions = <(String, String)>[];

  @override
  Future<List<Map<String, dynamic>>> reserves(String projectId) async =>
      _reserves;

  @override
  Future<List<Map<String, dynamic>>> photosChantier(String projectId) async =>
      [];

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async => [
        {'id': 'w1', 'name': 'Rui C.', 'type': 'Ouvrier'}
      ];

  @override
  Future<Map<String, dynamic>> creerReserve(Map<String, dynamic> r) async {
    creees.add(r);
    return {'id': 'r5', 'numero': 'R5', ...r};
  }

  @override
  Future<Map<String, dynamic>> envoyerPhoto({
    required String projectId,
    required String lot,
    required String phase,
    required List<int> octets,
    String type = 'image/jpeg',
    String reserveId = '',
  }) async {
    photos.add((phase, reserveId));
    return {'id': 'p${photos.length}'};
  }

  @override
  Future<Map<String, dynamic>> actionReserve(String id, String action,
      [Map<String, dynamic> extra = const {}]) async {
    actions.add((id, action));
    return {'id': id, 'numero': 'R2', 'statut': 'levee'};
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

  test('étiquettes, lignes et compteurs (règles du site)', () {
    final rs = _reserves.map(Reserve.new).toList();
    expect(etiquetteReserve(rs[0], '2026-12-01').label, 'À faire');
    expect(etiquetteReserve(rs[2], '2026-12-01'),
        (label: 'En retard', plein: true));
    expect(etiquetteReserve(rs[1], '2026-12-01').label, 'À vérifier');
    expect(etiquetteReserve(rs[3], '2026-12-01').label, 'Levée');
    expect(ligneReserve(rs[0]), 'Rui C. · pour le 2 déc.');
    expect(ligneReserve(rs[3]), 'Levée le 28 nov.');
    expect(compterReserves(rs), {
      'toutes': 4,
      'a_faire': 2,
      'faite': 1,
      'levee': 1,
      'proposee': 0,
      'badge': 3
    });
  });

  testWidgets('écran, ajout en photo, validation de la levée', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProReservesScreen(
          projectId: 'c1',
          titreChantier: 'Salle de bain, Paris 10e',
          prisePhoto: () async => [1, 2, 3],
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Réserves · 4'), findsOneWidget);
    expect(find.text('R2 · Rayure sur la porte'), findsOneWidget);
    await expectLater(find.byType(ProReservesScreen),
        matchesGoldenFile('goldens/pro_reserves.png'));

    // Ajouter une réserve en photo.
    await tester.tap(find.text('Ajouter une réserve en photo'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byType(TextField).first, 'Carreau fêlé derrière le WC');
    await tester.enterText(find.byType(TextField).at(1), 'Mur WC');
    await tester.tap(find.text('Rui C.').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Créer la réserve'));
    await tester.pumpAndSettle();
    expect(serveur.creees.single['titre'], 'Carreau fêlé derrière le WC');
    expect(serveur.creees.single['attribueeA'], 'w1');
    expect(serveur.photos.single, ('reserve', 'r5'));

    // Valider la levée de R2.
    await tester.tap(find.text('R2 · Rayure sur la porte'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Valider la levée'));
    await tester.pumpAndSettle();
    expect(serveur.actions.single, ('r2', 'valider'));
  });
}
