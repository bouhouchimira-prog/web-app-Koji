import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/devis/devis_versions.dart';
import 'package:koji/apps/entreprise/devis/pro_suivi_devis_view.dart';

// Versions du devis (maquette PRO-03.6) : mêmes exemples que le site
// (tests/unit/devis-versions.test.js).

Map<String, dynamic> _l(String id, String label, String room, num q, num ht) =>
    {'id': id, 'label': label, 'room': room, 'quantity': q, 'unit': 'u', 'totalHt': ht};

final _communes = [
  _l('01-1', 'Déposer la baignoire', 'Dépose et préparation', 1, 180), _l('01-2', 'Déposer le carrelage', 'Dépose et préparation', 19.4, 543.2),
  _l('01-3', 'Évacuer les gravats', 'Dépose et préparation', 1, 260), _l('02-1', "Créer l'alimentation", 'Plomberie', 1, 420),
  _l('02-3', 'Poser la colonne de douche', 'Plomberie', 1, 540), _l('03-1', 'Poser le carrelage au sol', 'Carrelage et faïence', 5.8, 551),
  _l('03-2', 'Poser la faïence', 'Carrelage et faïence', 19.4, 1707.2), _l('04-1', "Créer le circuit salle d'eau", 'Électricité', 1, 380),
  _l('04-0', 'Poser une prise', 'Électricité', 1, 0),
];
final _v1 = {'number': '001', 'sentAt': '2026-10-26T17:10:00Z', 'totalHt': 5486.2, 'totalTtc': 6034.82, 'lines': [
  ..._communes,
  _l('02-2', 'Receveur extra-plat 80 × 120', 'Plomberie', 1, 508.8),
  _l('04-2', 'Poser un sèche-serviettes électrique 500 W, fourni', 'Électricité', 1, 396),
]};
final _v2 = {'number': '002', 'sentAt': '2026-10-28T18:50:00Z', 'totalHt': 5271.4, 'totalTtc': 5798.54, 'lines': [
  ..._communes,
  _l('02-2', 'Receveur extra-plat 90 × 120', 'Plomberie', 1, 690),
]};

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  test('lignes concernées et totaux avant / après (règles du site)', () {
    final e = ecartsVersions(_v1, _v2, tauxTva: 10);
    expect(e.lignes.map((l) => [l.kind, l.label, l.avant, l.apres, l.ecart, l.ecartTtc]), [
      ['del', 'Poser un sèche-serviettes électrique 500 W, fourni', 396, null, -396, -435.6],
      ['mod', 'Receveur extra-plat 90 × 120', 508.8, 690, 181.2, 199.32],
    ]);
    expect(e.lignes[1].labelAvant, 'Receveur extra-plat 80 × 120');
    expect(e.identiques, 9);
    expect(e.totalHt, (5486.2, 5271.4, -214.8));
    expect(e.totalTtc, (6034.82, 5798.54, -236.28));
    expect(resumeEcarts(e), '2 lignes concernées · les 9 autres sont identiques');
    expect(resumeEcarts(ecartsVersions(_v2, _v2)), 'Aucune ligne modifiée · les 10 lignes sont identiques');
    expect(signe(-396), '− 396,00');
    expect(signe(181.2), '+ 181,20');
    expect(signe(null), '—');
  });

  testWidgets('suivi : ce qui a changé depuis la version 1', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      home: ProSuiviDevisView(
        titre: 'Devis 2026-041',
        sousTitre: 'Salle de bain · Mme Lefèvre',
        devis: {'status': 'Envoye', 'sentAt': '2026-10-28T18:50:00Z', 'vatRate': 10, 'versions': [_v1, _v2]},
        lots: const [],
        totalHt: 5271.4,
        totalTtc: 5798.54,
        aujourdhui: '2026-10-29',
        onRetour: () {},
        onRelancer: () {},
        onModifier: () {},
        onPdf: () {},
      ),
    ));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(find.text('Ce qui a changé · version 2'), find.byType(ListView), const Offset(0, -200));
    expect(find.text('2 lignes concernées · les 9 autres sont identiques'), findsOneWidget);
    expect(find.text('Receveur extra-plat 90 × 120 au lieu de Receveur extra-plat 80 × 120'), findsOneWidget);
    expect(find.text('− 396,00'), findsOneWidget);
    expect(find.text('6 034,82 € → 5 798,54 €'), findsOneWidget);
  });
}
