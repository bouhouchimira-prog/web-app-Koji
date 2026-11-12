import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/chantiers/chantiers_liste.dart';
import 'package:koji/apps/entreprise/chantiers/pro_chantiers_screen.dart';

// Chantiers Koji Pro (maquette PRO-02) : mêmes règles que le site
// (tests/unit/chantiers-liste.test.js), et l'écran téléphone.
Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

Map<String, dynamic> _signe(String projectId, num totalHt,
        {List<String> lots = const [
          'Lot 1 - Salon',
          'Lot 1 - Salon',
          'Lot 2 - SDB'
        ]}) =>
    {
      'id': 'q-$projectId',
      'projectId': projectId,
      'status': 'Signe',
      'client': 'Mme Lefèvre',
      'totalHt': totalHt,
      'items': [
        for (final (i, lot) in lots.indexed)
          {'room': lot, 'code': 'L$i', 'label': '$lot $i'},
      ],
    };

List<LigneChantier> _exemple() => lignesChantiers(
      maintenant: DateTime(2026, 11, 12, 9),
      projects: [
        {
          'id': 'c1',
          'title': 'Bureaux Auteuil',
          'address': '4 rue X, 75016 Paris'
        },
        {'id': 'c2', 'title': 'Rénovation, Caulaincourt', 'address': 'Paris'},
        {
          'id': 'c3',
          'title': 'Salle de bain, Paris 10e',
          'address': '75010 Paris'
        },
        {'id': 'c4', 'title': 'Cuisine', 'address': 'Lyon'},
        {'id': 'c5', 'title': 'Ancien', 'status': 'archive'},
      ],
      quotes: [
        _signe('c1', 48200),
        _signe('c2', 20000),
        {
          'id': 'q3',
          'projectId': 'c3',
          'status': 'Envoye',
          'client': 'Mme Lefèvre',
          'totalHt': 7800,
          'startDate': '2026-11-16',
          'items': <Map<String, dynamic>>[],
        },
        _signe('c4', 12000),
      ],
      tasks: [
        {'projectId': 'c1', 'quoteItemId': 'Lot 1 - Salon-L0', 'done': true},
        {
          'projectId': 'c1',
          'label': 'Lot 1 - Salon 1',
          'room': 'Lot 1 - Salon',
          'done': true
        },
        {
          'projectId': 'c1',
          'label': 'Livraison receveur',
          'dueDate': '2026-11-13',
          'done': false
        },
        {
          'projectId': 'c4',
          'label': 'Pose',
          'endDate': '2026-11-01',
          'done': false
        },
      ],
      invoices: [
        {
          'projectId': 'c2',
          'status': 'Emise',
          'kind': 'situation',
          'dueDate': '2026-11-01',
          'amountTtc': 13896,
          'invoiceNumber': '2026-012',
        },
      ],
      alerts: [
        {
          'projectId': 'c1',
          'type': 'fuite',
          'source': 'client',
          'status': 'open'
        },
      ],
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _chargerDmSans();
  });

  test('mêmes règles que le site', () {
    final lignes = _exemple();
    expect(lignes.length, 4);
    final [c1, c2, c3, c4] = lignes;
    expect((c1.etiquette, c1.ton), ('Bloquant', TonEtiquette.plein));
    expect(c1.detail, 'Fuite signalée par le client');
    expect(c1.jalon, 'Livraison receveur, demain');
    expect(c1.avancement?.texte, '1 / 2 lots');
    expect(c1.montant, '48 200 € HT');
    expect(c1.ville, 'Paris');

    expect(c2.etiquette, 'À relancer');
    expect(c2.jalon, 'Facture 2026-012 : 13 896 € à encaisser');
    expect(c2.montant, '13 896 € en attente');

    expect((c3.onglet, c3.etiquette), ('a_planifier', 'Échéance'));
    expect(c3.jalon, 'Démarrage à planifier, 16 nov.');

    expect(c4.etiquette, 'En retard');
    expect(c4.detail, 'Fin prévue dépassée (1 nov.)');

    final comptes = compterOnglets(lignes);
    expect(comptes, {'en_cours': 3, 'a_planifier': 1, 'termine': 0});
    expect(resumeChantiers(comptes), '3 en cours · 1 à planifier');
  });

  testWidgets('écran téléphone : onglets, recherche, cartes', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        proChantiersProvider.overrideWith((ref) async => _exemple()),
        currentAccountProvider.overrideWith((ref) async => null),
      ],
      child: const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(body: ProChantiersScreen()),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('3 en cours · 1 à planifier'), findsOneWidget);
    expect(find.text('En cours 3'), findsOneWidget);
    expect(find.text('Bloquant'), findsOneWidget);
    await expectLater(find.byType(ProChantiersScreen),
        matchesGoldenFile('goldens/pro_chantiers.png'));

    await tester.tap(find.text('À planifier 1'));
    await tester.pumpAndSettle();
    expect(find.text('Échéance'), findsOneWidget);
    expect(find.text('Bloquant'), findsNothing);

    await tester.tap(find.text('En cours 3'));
    await tester.enterText(find.byType(TextField), 'cuisine');
    await tester.pumpAndSettle();
    expect(find.text('Cuisine'), findsOneWidget);
    expect(find.text('Bureaux Auteuil'), findsNothing);
  });
}
