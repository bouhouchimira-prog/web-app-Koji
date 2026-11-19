import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/compte/progression_pro.dart';

// Maquette PRO-21 (téléphone) ; le grade vient de « Mon parcours » (PRO-26),
// seule source des niveaux.
final _d = <String, dynamic>{
  'niveau': {
    'niveau': 14,
    'xp': 10220,
    'dansNiveau': 1120,
    'requis': 1400,
    'pourcent': 80,
    'grade': {'id': 'compagnon', 'label': 'Compagnon'},
    'prochainGrade': {'id': 'chef-equipe', 'label': "Chef d'équipe", 'niveau': 21},
  },
  'grades': [
    {'id': 'apprenti', 'label': 'Apprenti', 'atteint': true, 'actuel': false},
    {'id': 'ouvrier', 'label': 'Ouvrier', 'atteint': true, 'actuel': false},
    {'id': 'compagnon', 'label': 'Compagnon', 'atteint': true, 'actuel': true},
    {'id': 'chef-equipe', 'label': "Chef d'équipe", 'atteint': false, 'actuel': false},
  ],
  'talents': {'points': 14, 'libres': 1, 'avantages': []},
  'defis': [
    {'id': 'devis', 'label': 'Envoyer 2 devis avec Koji', 'etat': '1 sur 2', 'fait': false},
    {'id': 'photos', 'label': 'Ajouter les photos après de 3 lots', 'etat': '3 sur 3', 'fait': true},
    {'id': 'reponse', 'label': 'Répondre aux messages en moins de 4 h', 'etat': '4 h 20 en moyenne', 'fait': false},
  ],
  'sceau': {'affiche': true, 'criteres': [{'id': 'decennale', 'label': "Assurance décennale valable jusqu'au 31/12/2026", 'ok': true}]},
};

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('grade, défis de la semaine, sceau', (tester) async {
    tester.view.physicalSize = const Size(430, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [progressionProvider.overrideWith((ref) async => _d)],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: const ProgressionScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.textContaining('Compagnon · 10 220 points'), findsWidgets);
    expect(find.textContaining("prochain grade : Chef d'équipe au niveau 21"), findsOneWidget);
    expect(find.text('Mon parcours · 1 point de métier à placer'), findsOneWidget);
    expect(find.text('4 h 20 en moyenne'), findsOneWidget);
    expect(find.textContaining('Vérifié par Koji'), findsOneWidget);
  });
}
