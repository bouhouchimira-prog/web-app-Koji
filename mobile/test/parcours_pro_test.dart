import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/parcours/mon_parcours_pro.dart';
import 'package:koji/features/parcours/parcours_logic.dart';

// Mon parcours v2 (maquettes PRO-26 et PRO-26.1, téléphone). Données de
// test/pro26_parcours_donnees.json : produites par les règles du site
// (lib/parcours-grade.js) pour un compte proche de la maquette (Compagnon,
// niveau 14, 1 point de métier à placer, Radar 9, Vitrine 4).

Future<void> _polices() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
  final racine = Platform.environment['FLUTTER_ROOT'];
  final icones = File(
      '$racine/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (racine != null && icones.existsSync()) {
    await (FontLoader('MaterialIcons')
          ..addFont(icones.readAsBytes().then((b) => ByteData.view(b.buffer))))
        .load();
  }
}

final Json _donnees =
    jsonDecode(File('test/pro26_parcours_donnees.json').readAsStringSync())
        as Json;
Json _d(String cle) => Map<String, dynamic>.from(_donnees[cle] as Map);

Future<void> _ecran(WidgetTester tester, Widget ecran, Json donnees,
    {List<(String, Json)>? actions,
    Json? reponse,
    double hauteur = 1500}) async {
  tester.view.physicalSize = Size(390, hauteur);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      parcoursGradeProvider.overrideWith((ref) async => donnees),
      parcoursActionProvider.overrideWithValue((chemin, corps) async {
        actions?.add((chemin, corps));
        return reponse ?? donnees;
      }),
    ],
    child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: KojiTheme.light(KojiAppKind.entreprise),
        home: ecran),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(_polices);
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('niveaux et grades comme le site (niveau n → n+1 = 100 × n)', () {
    expect(cumulNiveau(14), 9100);
    expect(niveauDeXp(9100 + 1120), 14);
    expect(niveauDeXp(99), 1);
    expect(niveauDeXp(100), 2);
    expect(niveauDeXp(10000000), 50);
    expect(gradeDeNiveau(14).label, 'Compagnon');
    expect(gradeDeNiveau(21).label, "Chef d'équipe");
    expect(gradeDeNiveau(50).label, 'Bâtisseur');
    expect(grades.map((g) => [g.de, g.a]).toList(), [
      [1, 5],
      [6, 12],
      [13, 20],
      [21, 30],
      [31, 40],
      [41, 49],
      [50, 50]
    ]);
  });

  test('talents : nœuds, brouillon de réorganisation, dates', () {
    expect([1, 3, 6, 10].map((s) => etatNoeud(9, s, 1)).toList(),
        ['got', 'got', 'got', 'avail']);
    expect([1, 3, 6, 10].map((s) => etatNoeud(4, s, 1)).toList(),
        ['got', 'got', 'lock', 'lock']);
    var b = const BrouillonTalents();
    for (var i = 0; i < 12; i++) {
      b = b.placer('vitrine', 14);
    }
    expect(b.vitrine, 10);
    b = b
        .placer('radar', 14)
        .placer('radar', 14)
        .placer('radar', 14)
        .placer('radar', 14)
        .placer('radar', 14);
    expect([b.radar, b.libres(14)], [4, 0]);
    expect(b.retirer('radar').versJson(), {'radar': 3, 'vitrine': 10});
    expect(jourCourt('2026-12-01'), '1er déc.');
    expect(jourCourt('2027-01-15T10:00:00Z'), '15 janv.');
    expect(nombre(1120), '1 120');
    expect(signe(-60), '− 60');
    expect(basculerDistinction(['a', 'b', 'c'], 'd'), ['a', 'b', 'c']);
    expect(basculerDistinction(['a', 'b', 'c'], 'b'), ['a', 'c']);
  });

  test('hauts faits : onglets et colonne de droite', () {
    final faits = (_d('grade')['hautsFaits'] as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    expect(faits.length, 14);
    expect(hautsFaitsDe(faits, 'obtenus').every((h) => h['obtenu'] == true),
        isTrue);
    expect(hautsFaitsDe(faits, 'avenir').any((h) => h['id'] == 'parole-tenue'),
        isFalse);
    expect(droiteHautFait(faits.firstWhere((h) => h['id'] == 'cle-en-main')),
        '27 févr.');
    expect(droiteHautFait(faits.firstWhere((h) => h['id'] == 'parole-tenue')),
        'pas encore mesurable');
    expect(
        droiteHautFait(
            faits.firstWhere((h) => h['id'] == 'specialiste-salle-de-bain')),
        '70 %');
    expect(
        droiteHautFait(
            faits.firstWhere((h) => h['id'] == 'bibliotheque-complete')),
        'obtenu');
  });

  testWidgets(
      'Mon parcours : grade, preuves, hauts faits, aperçu côté particulier',
      (tester) async {
    final actions = <(String, Json)>[];
    await _ecran(tester, const MonParcoursScreen(), _d('grade'),
        actions: actions, hauteur: 2000);
    expect(find.text('Compagnon · 1 point à placer'), findsWidgets);
    expect(find.text('niveau 14 · 1 050 / 1 400'), findsOneWidget);
    expect(find.text('Hauts faits · 7 obtenus'.toUpperCase()), findsOneWidget);
    expect(find.text('Premier coup de pelle'), findsOneWidget);
    expect(find.text('Dix sur dix'), findsWidgets);
    expect(find.text('Placer mon point de métier'), findsOneWidget);
    await expectLater(find.byType(MonParcoursScreen),
        matchesGoldenFile('goldens/pro26_parcours.png'));

    await tester.tap(find.text('Choisir mes distinctions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Clé en main').last);
    await tester.pump();
    await tester.tap(find.textContaining('Enregistrer'));
    await tester.pumpAndSettle();
    expect(actions.single.$1, '/api/parcours/grade');
    expect(actions.single.$2['action'], 'distinctions');
    expect((actions.single.$2['ids'] as List).length, lessThanOrEqualTo(3));
  });

  testWidgets('Talents : deux branches, placer le point libre', (tester) async {
    final actions = <(String, Json)>[];
    await _ecran(tester, const TalentsScreen(), _d('grade'),
        actions: actions, reponse: _d('apresPlacer'));
    expect(find.text('14 points · 1 à placer'), findsWidgets);
    expect(find.text('Radar · Trouver des chantiers'.toUpperCase()),
        findsOneWidget);
    expect(find.text('Grand rayon'), findsOneWidget);
    expect(find.text('Placer 1 point'), findsOneWidget);
    await expectLater(find.byType(TalentsScreen),
        matchesGoldenFile('goldens/pro26_talents.png'));
    await tester.tap(find.text('Placer 1 point'));
    await tester.pumpAndSettle();
    expect(actions.single.$2, {'action': 'placer', 'branche': 'radar'});
    expect(find.text('14 points · 0 à placer'), findsWidgets);
  });

  testWidgets(
      'Talents : réorganiser (une fois par mois, effet le 1er du mois suivant)',
      (tester) async {
    final actions = <(String, Json)>[];
    await _ecran(tester, const TalentsScreen(), _d('gradeReorg'),
        actions: actions, reponse: _d('apresReorg'));
    await tester.tap(find.text('Réorganiser mes talents'));
    await tester.pumpAndSettle();
    expect(find.text('Réorganisation en cours'), findsOneWidget);
    expect(
        find.text('14 points à replacer · effet le 1er déc.'), findsOneWidget);
    for (var i = 0; i < 4; i++) {
      await tester.tap(find.text('Placer').first);
      await tester.pump();
    }
    await expectLater(find.byType(TalentsScreen),
        matchesGoldenFile('goldens/pro26_reorganiser.png'));
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();
    expect(actions.single.$1, '/api/parcours/talents');
    expect(actions.single.$2['action'], 'reorganiser');
    expect(actions.single.$2['repartition'], {'radar': 4, 'vitrine': 0});
    expect(find.textContaining('Réorganisation validée · effet le 1er déc.'),
        findsOneWidget);
  });
}
