import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/dossier_fin.dart';
import 'package:koji/apps/entreprise/chantiers/pro_dossier_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Dossier de fin de chantier Koji Pro (maquette PRO-02.5, téléphone) :
// « 6 sur 8 », plan des réseaux et réserve R3 à faire, envoi au client.
const _devis = {
  'id': 'q1',
  'projectId': 'c1',
  'quoteNumber': '2026-041',
  'client': 'Mme Lefèvre',
  'clientEmail': 'lefevre@exemple.fr',
  'status': 'Signe',
};
const _factures = [
  {'projectId': 'c1', 'type': 'Acompte initial', 'status': 'Payee', 'amountTtc': 1739.56},
  {'projectId': 'c1', 'type': 'Facture intermédiaire', 'status': 'Emise', 'amountTtc': 2515},
  {'projectId': 'c1', 'type': 'Facture finale', 'status': 'Emise', 'amountTtc': 1580.09, 'invoiceNumber': 'KJ-2026-134'},
];
const _photos = [
  {'lot': 'Dépose', 'phase': 'avant'},
  {'lot': 'Dépose', 'phase': 'apres'},
  {'lot': 'Plomberie', 'phase': 'pendant'},
];
const _reserves = [
  {'id': 'r1', 'numero': 'R1', 'statut': 'levee'},
  {'id': 'r3', 'numero': 'R3', 'statut': 'a_faire'},
];
const _dossier = {
  'dossier': {
    'remisLe': '',
    'pieces': [
      {'kind': 'notice', 'titre': 'chauffe-eau'},
      {'kind': 'notice', 'titre': 'robinetterie'},
    ]
  },
  'decennale': {'insurer': 'MAAF Pro', 'until': '2027-03-31'},
};

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final appels = <String>[];

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async =>
      switch (key) {
        'quotes' => [Map<String, dynamic>.from(_devis)],
        'invoices' => _factures.map(Map<String, dynamic>.from).toList(),
        _ => [],
      };

  @override
  Future<List<Map<String, dynamic>>> reserves(String projectId) async =>
      _reserves.map(Map<String, dynamic>.from).toList();

  @override
  Future<List<Map<String, dynamic>>> photosChantier(String projectId) async =>
      _photos.map(Map<String, dynamic>.from).toList();

  @override
  Future<List<Map<String, dynamic>>> avenants(String quoteId) async => [
        {'numero': 'AV-1', 'status': 'Signe'}
      ];

  @override
  Future<Map<String, dynamic>?> cloture(String projectId) async => {
        'pv': {'numero': 'PV-2026-007', 'signeLe': '2026-12-04T12:00:00Z'}
      };

  @override
  Future<Map<String, dynamic>> dossierFin(String projectId) async =>
      Map<String, dynamic>.from(_dossier);

  @override
  Future<void> ajouterPieceDossier({
    required String projectId,
    required String kind,
    required List<int> octets,
    String type = 'image/jpeg',
    String titre = '',
  }) async =>
      appels.add('piece $kind ${octets.length}');

  @override
  Future<Map<String, dynamic>?> envoyerDossier(String projectId) async {
    appels.add('envoyer $projectId');
    return {};
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

  test('huit pièces, six prêtes (maquette)', () {
    final e = elementsDossierTelephone(
      cloture: {
        'pv': {'signeLe': '2026-12-04T12:00:00Z'}
      },
      devis: _devis,
      avenants: ['AV-1'],
      factures: _factures.map(Map<String, dynamic>.from).toList(),
      factureSolde: _factures.last,
      photos: _photos.map(Map<String, dynamic>.from).toList(),
      pieces: (_dossier['dossier']!['pieces'] as List)
          .map((p) => Map<String, dynamic>.from(p as Map))
          .toList(),
      decennale: _dossier['decennale'],
      reserves: _reserves.map(Reserve.new).toList(),
      aujourdhui: '2026-12-08',
    );
    expect(e.map((x) => '${x.titre} : ${x.detail}${x.ok ? '' : ' (à faire)'}'), [
      'Procès-verbal de réception : signé le 4 déc.',
      'Photos avant / après : 2 photos',
      'Devis et avenant signés : 2026-041 · AV-1',
      'Factures et paiements : acompte, situation, solde',
      'Garanties et notices : chauffe-eau, robinetterie',
      'Attestation décennale : à jour',
      'Plan des réseaux : à ajouter (à faire)',
      'Réserves levées : R3 en attente (à faire)',
    ]);
    expect(e.where((x) => x.ok).length, 6);
  });

  testWidgets('écran, plan en photo et envoi au client', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProDossierScreen(
          projectId: 'c1',
          titreChantier: 'Salle de bain, Paris 10e',
          prisePhoto: () async => [1, 2, 3],
          maintenant: () => DateTime(2026, 12, 8),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Dossier de fin de chantier · 6 sur 8'), findsOneWidget);
    expect(find.text('À faire'), findsNWidgets(2));
    await expectLater(find.byType(ProDossierScreen),
        matchesGoldenFile('goldens/pro_dossier.png'));

    await tester.tap(find.text('Plan des réseaux'));
    await tester.pumpAndSettle();
    expect(serveur.appels.first, 'piece plan 3');
    ScaffoldMessenger.of(tester.element(find.byType(ProDossierScreen)))
        .removeCurrentSnackBar();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Envoyer au client (PDF)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Envoyer'));
    await tester.pumpAndSettle();
    expect(serveur.appels.last, 'envoyer c1');
  });
}
