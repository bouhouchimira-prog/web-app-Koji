import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/devis/devis_suivi.dart';
import 'package:koji/apps/entreprise/devis/pro_suivi_devis_view.dart';

// Après l'envoi (maquette PRO-03.3) : mêmes exemples que le site
// (tests/unit/devis-suivi.test.js) et les deux états du téléphone.

final Map<String, dynamic> _envoye = {
  'id': 'q41', 'quoteNumber': '2026-041', 'status': 'Envoye', 'signatureStatus': 'En attente', 'clientType': 'particulier',
  'sentAt': '2026-10-28T18:50:00Z', 'viewedAt': '2026-10-28T20:12:00Z', 'validityDays': 30, 'vatRate': 10, 'totalTtc': 5798.54,
  'paymentMilestones': [
    {'label': 'Acompte à la signature', 'percent': 30},
    {'label': 'Solde — par situations mensuelles, à 30 jours', 'percent': 70},
  ],
  'envoi': {'kojiClient': true, 'email': true, 'sms': false},
  'versions': [
    {'number': '001', 'sentAt': '2026-10-26T10:00:00Z'},
    {'number': '002', 'sentAt': '2026-10-28T18:50:00Z'},
  ],
};
final Map<String, dynamic> _signe = {
  ..._envoye,
  'status': 'Signe', 'signatureStatus': 'Signe', 'signatureProvider': 'koji-signature', 'signedAt': '2026-10-30T08:04:00Z', 'projectId': 'p41',
};

const _lots = [
  SuiviLot('Lot 01', 'Dépose et préparation', 983.20, [
    ('Déposer la baignoire et la robinetterie existantes', 180.0, false),
    ('Déposer le carrelage mural et au sol', 543.20, false),
    ('Évacuer les gravats en décharge agréée', 260.0, false),
  ]),
  SuiviLot('Lot 02', 'Plomberie', 1650.0, [
    ("Créer l'alimentation et l'évacuation du receveur", 420.0, false),
    ('Poser le receveur extra-plat 90 × 120, fourni', 690.0, false),
    ('Poser la colonne de douche thermostatique, fournie', 540.0, false),
  ]),
  SuiviLot('Lot 03', 'Carrelage et faïence', 2258.20, [
    ('Poser le carrelage au sol, grès cérame 60 × 60, fourni', 551.0, false),
    ('Poser la faïence murale toute hauteur, fournie', 1707.20, false),
  ]),
  SuiviLot('Lot 04', 'Électricité', 380.0, [
    ("Créer le circuit salle d'eau, 2 points lumineux et 1 prise", 380.0, false),
  ]),
];

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

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  test('dates de Paris, suivi, note, conditions, version (règles du site)', () {
    expect(quandParis('2026-10-28T18:50:00Z'), '28 oct., 19 h 50');
    expect(quandParis('2026-07-01T07:00:00Z'), '1 juil., 9 h 00');
    expect(quandRelatif('2026-10-28T20:12:00Z', '2026-10-29'), 'hier à 21 h 12');
    expect(quandRelatif('2026-10-28T20:12:00Z', '2026-10-28'), "aujourd'hui à 21 h 12");
    expect(quandRelatif('2026-10-28T20:12:00Z', '2026-11-02'), 'le 28 oct. à 21 h 12');

    expect(prochaineRelance(_envoye), '2026-11-04');
    expect(etapesSuivi(_envoye, aujourdhui: '2026-10-29').map((e) => [e.label, e.etat, e.detail]), [
      ['Envoyé', 'done', '28 oct., 19 h 50'],
      ['Vu par le client', 'done', '28 oct., 21 h 12'],
      ['Signature en attente', 'now', "valable jusqu'au 27 nov. · relance conseillée le 4 nov."],
      ['Chantier lancé', 'todo', ''],
    ]);
    expect(etapesSuivi(_envoye, aujourdhui: '2026-11-05')[2].detail, "valable jusqu'au 27 nov. · à relancer");
    expect(etapesSuivi(_envoye, aujourdhui: '2026-11-30')[2].detail, 'validité dépassée le 27 nov.');
    expect(noteSuivi(_envoye, aujourdhui: '2026-10-29'), 'Ouvert par le client hier à 21 h 12. Aucune question posée.');
    expect(noteSuivi({..._envoye, 'viewedAt': ''}, aujourdhui: '2026-10-29', messages: 2), 'Pas encore ouvert par le client. 2 messages du client.');

    expect(retractationJusquau(_signe), '2026-11-13');
    expect(retractationJusquau({..._signe, 'clientType': 'societe'}), '');
    expect(retractationJusquau({..._signe, 'signatureProvider': 'manuel'}), '');
    expect(etapesSuivi(_signe, aujourdhui: '2026-10-31').skip(2).map((e) => [e.label, e.etat, e.detail]), [
      ['Signé', 'done', '30 oct., 9 h 04 · en ligne'],
      ['Chantier lancé', 'now', ''],
    ]);
    expect(etapesSuivi(_signe, aujourdhui: '2026-10-31', chantierLance: true)[3].etat, 'done');
    expect(noteSuivi(_signe, aujourdhui: '2026-10-31'), "Signé en ligne le 30 oct. Rétractation possible jusqu'au 13 nov.");
    expect(noteSuivi({..._signe, 'mentionTva': true}, aujourdhui: '2026-10-31'),
        "Signé en ligne le 30 oct. Mention TVA 10 % certifiée. Rétractation possible jusqu'au 13 nov.");
    expect(noteSuivi({..._signe, 'signatureProvider': 'manuel', 'acceptanceReason': 'acompte'}, aujourdhui: '2026-10-31'), 'Accord noté le 30 oct.');

    expect(conditionsEnvoyees(_envoye), [
      ('Validité', "30 jours, jusqu'au 27 nov."),
      ('Acompte', '30 % à la signature · 1 739,56 € TTC'),
      ('Règlement', 'Situation mensuelle, 30 jours'),
      ('TVA', '10 %, mention certifiée à la signature'),
      ('Canaux', 'Koji Client, e-mail'),
    ]);
    expect(versionDevis(_envoye), (titre: '2 · envoyée le 28 oct.', detail: 'Lecture seule · v1 du 26 oct. remplacée'));
    expect(versionDevis({..._envoye, 'versions': []}), (titre: '1 · envoyée le 28 oct.', detail: 'Lecture seule'));
  });

  Future<void> monter(WidgetTester tester, Widget vue) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(debugShowCheckedModeBanner: false, home: vue));
    await tester.pumpAndSettle();
  }

  testWidgets('1 · envoyé, vu par le client', (tester) async {
    final appels = <String>[];
    await monter(
      tester,
      ProSuiviDevisView(
        titre: 'Devis 2026-041',
        sousTitre: 'Salle de bain · Mme Lefèvre',
        devis: {..._envoye, 'versions': const []},
        lots: _lots,
        totalHt: 5271.40,
        totalTtc: 5798.54,
        aujourdhui: '2026-10-29',
        onRetour: () {},
        onRelancer: () => appels.add('relancer'),
        onModifier: () => appels.add('modifier'),
        onPdf: () => appels.add('pdf'),
      ),
    );
    expect(find.text('5 271,40 € HT'), findsOneWidget);
    expect(find.text('5 798,54 € TTC · version 1'), findsOneWidget);
    expect(find.text("valable jusqu'au 27 nov. · relance conseillée le 4 nov."), findsOneWidget);
    expect(find.text('Ouvert par le client hier à 21 h 12. Aucune question posée.'), findsOneWidget);
    await expectLater(find.byType(ProSuiviDevisView), matchesGoldenFile('goldens/pro_suivi_devis_envoye.png'));
    await tester.tap(find.text('Relancer'));
    await tester.tap(find.text('Modifier'));
    expect(appels, ['relancer', 'modifier']);
  });

  testWidgets('2 · signé, lancer le chantier', (tester) async {
    final appels = <String>[];
    await monter(
      tester,
      ProSuiviDevisView(
        titre: 'Devis 2026-041',
        sousTitre: 'Salle de bain · Mme Lefèvre',
        devis: {..._signe, 'versions': const []},
        lots: _lots,
        totalHt: 5271.40,
        totalTtc: 5798.54,
        aujourdhui: '2026-10-31',
        onRetour: () {},
        onRelancer: () {},
        onModifier: () {},
        onPdf: () {},
        onLancer: () => appels.add('lancer'),
        onCreerAcompte: () => appels.add('acompte'),
      ),
    );
    expect(find.text('Signé'), findsWidgets);
    expect(find.text('30 oct., 9 h 04 · en ligne'), findsOneWidget);
    expect(find.text('30 % · 1 739,56 € TTC'), findsOneWidget);
    await expectLater(find.byType(ProSuiviDevisView), matchesGoldenFile('goldens/pro_suivi_devis_signe.png'));
    await tester.tap(find.text("Créer la facture d'acompte"));
    await tester.tap(find.text('Lancer le chantier'));
    expect(appels, ['acompte', 'lancer']);
  });
}
