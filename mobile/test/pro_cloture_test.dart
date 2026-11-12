import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/chantiers/pro_cloture_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Clôture Koji Pro (maquette PRO-02.4, téléphone) : mêmes chiffres que le
// site (tests/unit/cloture-chantier.test.js), écran, PV signé au doigt.
const _devis = {
  'id': 'q1',
  'projectId': 'c1',
  'quoteNumber': '2026-041',
  'client': 'Mme Lefèvre',
  'status': 'Signe',
  'totalHt': 5271.4,
  'totalTtc': 5798.54,
  'items': [
    {'room': 'Dépose'},
    {'room': 'Plomberie'},
    {'room': 'Carrelage'},
    {'room': 'Électricité'},
  ],
};
const _avenants = [
  {'numero': 'AV-1', 'status': 'Signe', 'totalHtDelta': 312, 'totalTtcDelta': 343.2},
  {'numero': 'AV-2', 'status': 'Brouillon', 'totalHtDelta': 900, 'totalTtcDelta': 990},
];
const _factures = [
  {'projectId': 'c1', 'quoteId': 'q1', 'type': 'Acompte initial', 'status': 'Payee', 'amountTtc': 1739.56},
  {'projectId': 'c1', 'quoteId': 'q1', 'type': 'Facture intermédiaire', 'status': 'Emise', 'amountTtc': 2515},
  {'projectId': 'c1', 'quoteId': 'q1', 'type': 'Facture intermédiaire', 'status': 'Annulee', 'amountTtc': 800},
];
const _reserves = [
  {'id': 'r1', 'numero': 'R1', 'titre': 'Joint silicone', 'statut': 'levee'},
  {'id': 'r2', 'numero': 'R2', 'titre': 'Carreau fêlé', 'statut': 'levee'},
  {'id': 'r3', 'numero': 'R3', 'titre': 'Spot de douche', 'statut': 'a_faire', 'pourLe': '2026-12-05'},
];

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final signes = <String>[];

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
  Future<List<Map<String, dynamic>>> avenants(String quoteId) async =>
      _avenants.map(Map<String, dynamic>.from).toList();

  @override
  Future<Map<String, dynamic>?> cloture(String projectId) async => signes.isEmpty
      ? null
      : {
          'pv': {
            'numero': 'PV-2026-007',
            'signeLe': '2026-12-04T12:00:00Z',
            'reserves': [
              {'numero': 'R3'}
            ]
          }
        };

  @override
  Future<Map<String, dynamic>?> signerPv({
    required String projectId,
    required String signataire,
    required List<int> signatureClient,
    required List<int> signaturePro,
  }) async {
    signes.add('$signataire ${signatureClient.length} ${signaturePro.length}');
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

  test('facture de solde et étapes (chiffres du site)', () {
    final factures = facturesDuChantier(
        _factures.map(Map<String, dynamic>.from).toList(),
        projectId: 'c1',
        quoteId: 'q1');
    final s = montantsSolde(
        devis: _devis,
        avenants: _avenants.map(Map<String, dynamic>.from).toList(),
        factures: factures,
        taux: 5);
    expect([s.travauxHt, s.travauxTtc, s.dejaHt, s.retenueHt, s.retenueTtc, s.soldeHt, s.soldeTtc],
        [5583.4, 6141.74, 3867.78, 279.17, 307.09, 1436.45, 1580.09]);
    expect(s.avenants, ['AV-1']);
    expect(euro(s.soldeTtc), '1 580,09 €');
    expect(noteSolde(s, '2026-12-04T12:00:00Z'),
        contains('Retenue de garantie 5 % : 307,09 € TTC, libérable le 4 déc. 2027'));
    expect(travauxReceptionnes(_devis, 4, s.avenants),
        '4 lots · devis 2026-041 et avenant AV-1');
    expect(plusAns('2028-02-29', 1), '2029-02-28');

    final reserves = _reserves.map(Reserve.new).toList();
    final avant = etapesCloture(reserves: reserves, solde: s);
    expect(avant.map((e) => e.etat), ['cur', 'todo', 'todo', 'todo', 'todo']);
    expect(avant[1].court, '2 levées sur 3 · R3 avant le 5 déc.');
    expect(avant[1].action, 'Lever la réserve R3');
    expect(avant[2].court, '1 580,09 € TTC · prête');

    final apres = etapesCloture(
      cloture: {
        'pv': {
          'signeLe': '2026-12-04T12:00:00Z',
          'reserves': [
            {'numero': 'R3'}
          ]
        }
      },
      reserves: reserves.take(2).toList(),
      solde: s,
    );
    expect(apres.map((e) => e.etat), ['ok', 'ok', 'cur', 'todo', 'todo']);
    expect(apres[0].court, 'PV signé le 4 déc. · 1 réserve (R3)');
    expect(apres[2].action, 'Émettre la facture de solde');
  });

  testWidgets('écran de clôture et PV signé au doigt', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProClotureScreen(
          projectId: 'c1',
          titreChantier: 'Salle de bain, Paris 10e',
          rendu: (traits, taille) async => List.filled(traits.length * 10, 1),
          maintenant: () => DateTime(2026, 12, 4, 17, 20),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Réception'), findsOneWidget);
    expect(find.text('2 levées sur 3 · R3 avant le 5 déc.'), findsOneWidget);
    expect(find.text('1 887,18 € TTC · prête'), findsOneWidget);
    await expectLater(find.byType(ProClotureScreen),
        matchesGoldenFile('goldens/pro_cloture.png'));

    // Faire signer le PV.
    await tester.tap(find.text('Faire signer le PV'));
    await tester.pumpAndSettle();
    expect(find.text('Réception avec 1 réserve'), findsOneWidget);
    expect(find.text('R3 · Spot de douche · à lever avant le 5 déc.'),
        findsOneWidget);
    expect(find.text('4 lots · devis 2026-041 et avenant AV-1'), findsOneWidget);
    for (final zone in find.byType(SignatureZone).evaluate().toList()) {
      final centre = tester.getCenter(find.byWidget(zone.widget));
      final geste = await tester.startGesture(centre - const Offset(80, 0));
      for (var i = 1; i <= 8; i++) {
        await geste.moveBy(Offset(20, i.isEven ? 14 : -14));
      }
      await geste.up();
    }
    await tester.pumpAndSettle();
    await expectLater(find.byType(ProPvScreen),
        matchesGoldenFile('goldens/pro_pv.png'));
    await tester.tap(find.text('Valider la réception'));
    await tester.pumpAndSettle();
    expect(serveur.signes.single, 'Mme Lefèvre 10 10');
    expect(find.text('PV signé le 4 déc. · 1 réserve (R3)'), findsOneWidget);
  });
}
