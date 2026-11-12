import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/fiche_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/pro_fiche_chantier_screen.dart';

// Fiche chantier Koji Pro (maquette PRO-02.1, téléphone) : lots, chiffres,
// à traiter, et l'écran.
Map<String, dynamic> _l(String room, String code, String label, num ht) =>
    {'room': room, 'code': code, 'label': label, 'totalHt': ht};

final _devis = {
  'id': 'q1',
  'projectId': 'c1',
  'quoteNumber': '2026-041',
  'status': 'Signe',
  'client': 'Mme Lefèvre',
  'totalHt': 5271.4,
  'totalTtc': 5798.54,
  'items': [
    _l('Dépose et préparation', 'D1', 'Déposer la baignoire', 180),
    _l('Dépose et préparation', 'D2', 'Déposer le carrelage', 543.2),
    _l('Dépose et préparation', 'E1', 'Évacuer les gravats', 260),
    _l('Plomberie', 'P1', "Créer l'alimentation", 1650),
    _l('Carrelage et faïence', 'C1', 'Poser le carrelage', 2258.2),
    _l('Électricité', 'L1', 'Créer le circuit', 380),
  ],
};

Map<String, dynamic> _t(String room, String code, String debut, String fin,
        {bool done = false, String who = 'Equipe', bool st = false}) =>
    {
      'id': '$room-$code',
      'projectId': 'c1',
      'quoteItemId': '$room-$code',
      'label': code,
      'room': room,
      'startDate': debut,
      'endDate': fin,
      'done': done,
      'assignedTo': who,
      'participantType': st ? 'Sous-traitants' : 'Ouvriers',
    };

final _taches = [
  _t('Dépose et préparation', 'D1', '2026-11-12', '2026-11-13', done: true),
  _t('Dépose et préparation', 'D2', '2026-11-12', '2026-11-13', done: true),
  _t('Dépose et préparation', 'E1', '2026-11-12', '2026-11-13', done: true),
  _t('Plomberie', 'P1', '2026-11-16', '2026-11-18', who: 'Bâti Nord', st: true),
  _t('Carrelage et faïence', 'C1', '2026-11-19', '2026-11-26'),
];

final _factures = [
  {
    'id': 'f1',
    'projectId': 'c1',
    'invoiceNumber': 'KJ-2026-118',
    'kind': 'acompte',
    'type': 'Acompte initial',
    'status': 'Emise',
    'amountTtc': 1739.56,
    'dueDate': '2026-11-01',
  }
];

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

  test('lots, chiffres et à traiter de la fiche', () {
    final lots = lotsFiche(_devis, _taches);
    expect([
      for (final l in lots) (l.numero, l.nom, l.etat, l.pourcent)
    ], [
      ('01', 'Dépose et préparation', 'Terminé', 100),
      ('02', 'Plomberie', 'À démarrer', 0),
      ('03', 'Carrelage et faïence', 'À démarrer', 0),
      ('04', 'Électricité', 'Non planifié', 0),
    ]);
    expect(lots[0].montant, 983.2);
    expect(lots[1].equipe, 'Bâti Nord · sous-traitant');
    expect(lots[1].dates, '16 nov. → 18 nov.');
    expect(lots[3].equipe, 'Non assigné');

    final r = resumeFiche(
        devis: _devis, lots: lots, taches: _taches, factures: _factures);
    expect(r.avancement, 50); // 3 lignes faites sur 6
    expect(r.facturePourcent, 30);
    expect(r.fin, '2026-11-26');
    expect(r.sousAvancement, '1 lot terminé sur 4');

    final items = aTraiterFiche(alertes: [
      {'type': 'fuite', 'source': 'client', 'status': 'open'}
    ], factures: _factures, taches: _taches, aujourdhui: '2026-11-17');
    expect([
      for (final i in items) (i.titre, i.etiquette)
    ], [
      ('Fuite signalée', 'Bloquant'),
      ('Facture KJ-2026-118', 'À relancer'),
    ]);
  });

  testWidgets('écran téléphone', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        proFicheChantierProvider('c1').overrideWith((ref) async => DonneesFiche(
              projet: const {
                'id': 'c1',
                'title': 'Salle de bain, Paris 10e',
                'client': 'Mme Lefèvre'
              },
              devis: _devis,
              taches: _taches,
              factures: _factures,
            )),
      ],
      child: const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProFicheChantierScreen(projectId: 'c1'),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
    expect(find.text('Situation de travaux'), findsOneWidget);
    expect(find.text('Lots 4'), findsOneWidget);
    await expectLater(find.byType(ProFicheChantierScreen),
        matchesGoldenFile('goldens/pro_fiche_chantier.png'));

    await tester.tap(find.text('Lot 02 · Plomberie'));
    await tester.pumpAndSettle();
    expect(find.text('Marquer fait'), findsOneWidget);
  });
}
