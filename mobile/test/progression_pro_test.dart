import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/compte/progression_pro.dart';

// Maquette PRO-21 (téléphone) : Compagnon · 1 240 points.
final _d = <String, dynamic>{
  'points': 1240,
  'niveau': {'id': 'compagnon', 'label': 'Compagnon'},
  'prochain': {'id': 'confirme', 'label': 'Artisan confirmé'},
  'condition': '260 points et 3 chantiers clôturés avec avis',
  'niveaux': [
    {'id': 'apprenti', 'label': 'Apprenti', 'atteint': true, 'actuel': false},
    {'id': 'compagnon', 'label': 'Compagnon', 'atteint': true, 'actuel': true},
    {'id': 'confirme', 'label': 'Artisan confirmé', 'atteint': false, 'actuel': false},
  ],
  'defis': [
    {'id': 'devis', 'label': 'Envoyer 2 devis avec Koji', 'etat': '1 sur 2', 'fait': false},
    {'id': 'photos', 'label': 'Ajouter les photos après de 3 lots', 'etat': '3 sur 3', 'fait': true},
    {'id': 'reponse', 'label': 'Répondre aux messages en moins de 4 h', 'etat': '4 h 20 en moyenne', 'fait': false},
  ],
  'sceau': {'affiche': true, 'criteres': [{'id': 'decennale', 'label': "Assurance décennale valable jusqu'au 31/12/2026", 'ok': true}]},
};

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('niveau, défis de la semaine, sceau', (tester) async {
    tester.view.physicalSize = const Size(430, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [progressionProvider.overrideWith((ref) async => _d)],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: const ProgressionScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.textContaining('Compagnon · 1 240 points'), findsWidgets);
    expect(find.textContaining('Prochain niveau : Artisan confirmé'), findsOneWidget);
    expect(find.text('4 h 20 en moyenne'), findsOneWidget);
    expect(find.textContaining('Vérifié par Koji'), findsOneWidget);
  });
}
