import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/pro_situation_screen.dart';

// Situation de travaux (maquette PRO-06) : mêmes exemples que le site
// (tests/unit/situation-travaux.test.js).

Future<void> _polices() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
  final racine = Platform.environment['FLUTTER_ROOT'];
  final icones = File('$racine/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (racine != null && icones.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(icones.readAsBytes().then((b) => ByteData.view(b.buffer)))).load();
  }
}

const _lots = [
  LotSituation('Dépose et préparation', 983.2, 100),
  LotSituation('Plomberie', 1650, 100),
  LotSituation('Carrelage et faïence', 2258.2, 60),
  LotSituation('Électricité', 380, 0),
];

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  test('calcule la situation de la maquette', () {
    final s = calculerSituation(_lots, dejaFactureHt: 1581.42, tauxRetenue: 5, tauxTva: 10);
    expect(s.lots.map((l) => l.montant), [983.2, 1650, 1354.92, 0]);
    expect([s.cumuleHt, s.retenueHt, s.ht, s.tva, s.ttc], [3988.12, 120.34, 2286.36, 228.64, 2515]);
    expect(arrondi5(62), 60);
  });

  testWidgets('écran situation : lots, retenue, envoi', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    SituationChoix? choix;
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ProSituationScreen(
        chantier: 'Salle de bain, Paris 10e',
        client: 'Mme Lefèvre',
        numeroDevis: '2026-041',
        totalDevisHt: 5271.4,
        lots: _lots,
        dejaFactureHt: 1581.42,
        dejaFactureLibelle: 'KJ-2026-118',
        tauxTva: 10,
        email: 's.lefevre.k@exemple.fr',
        maintenant: () => DateTime(2026, 11, 28),
        onValider: (c, {required envoyer}) async {
          choix = c;
          return {'invoiceNumber': 'KJ-2026-121', 'status': envoyer ? 'Emise' : 'Brouillon', 'amountTtc': 2515};
        },
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Retenue de garantie 5 %'));
    await tester.pumpAndSettle();
    expect(find.text('2 515,00 € TTC'), findsOneWidget);
    expect(find.text('3 988,12 €'), findsOneWidget);
    await expectLater(find.byType(ProSituationScreen), matchesGoldenFile('goldens/pro_situation.png'));
    await tester.tap(find.text('Envoyer la situation'));
    await tester.pumpAndSettle();
    expect(choix!.lots['Carrelage et faïence'], 60);
    expect(choix!.tauxRetenue, 5);
    expect(choix!.echeance, '2026-12-28');
    expect(choix!.message, contains('dépose et préparation et plomberie terminés, carrelage et faïence à 60 %'));
    expect(find.textContaining('Situation n° 1 envoyée · KJ-2026-121'), findsOneWidget);
  });
}
