import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/apps/entreprise/pro_home/radar_carte.dart';

// Carte du Radar (maquette PRO-01) : projection et cadrage, étiquettes de
// prix, toucher une étiquette. Fond uni dans les tests (la carte MapLibre
// est une vue native) : les étiquettes sont placées par le même calcul.
Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

const _points = [
  RadarPoint(id: 'o1', lat: 48.87, lon: 2.35, label: '6 000 €'),
  RadarPoint(id: 'o2', lat: 48.89, lon: 2.35, label: '3 600 €'),
  RadarPoint(id: 'o3', lat: 48.91, lon: 2.33, label: '1 500 €'),
  RadarPoint(id: 'o4', lat: 48.83, lon: 2.29, label: '13 500 €', taken: true),
  RadarPoint(id: 'o5', lat: 48.87, lon: 2.35, label: 'À chiffrer'),
];

const _zone = RadarZone(lat: 48.88, lon: 2.34, radiusKm: 15, ville: 'Paris');

Future<void> _ouvrir(WidgetTester tester, Widget carte, Size taille) async {
  tester.view.physicalSize = taille * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    debugShowCheckedModeBanner: false,
    home: Scaffold(body: carte),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(_chargerDmSans);

  test('le cadrage garde tous les chantiers dans la zone utile', () {
    const taille = Size(640, 300);
    const marges = EdgeInsets.fromLTRB(44, 92, 64, 60);
    final camera = cadrerRadar(_points, taille, marges, zone: _zone);
    for (final p in _points) {
      final e = projeterRadar(p.lat, p.lon, camera, taille);
      expect(
          e.dx, inInclusiveRange(marges.left - 0.5, 640 - marges.right + 0.5));
      expect(
          e.dy, inInclusiveRange(marges.top - 0.5, 300 - marges.bottom + 0.5));
    }
    // le centre de la caméra tombe au milieu de l'écran
    final centre = projeterRadar(camera.lat, camera.lon, camera, taille);
    expect(centre.dx, closeTo(320, 0.01));
    expect(centre.dy, closeTo(150, 0.01));
  });

  test('sans chantier placé : la zone de travail, sinon la France', () {
    const taille = Size(390, 600);
    final zone = cadrerRadar(const [], taille, EdgeInsets.zero, zone: _zone);
    expect((zone.lat, zone.lon, zone.zoom), (48.88, 2.34, 10.5));
    expect(cadrerRadar(const [], taille, EdgeInsets.zero), RadarCamera.france);
    final seul = cadrerRadar(_points.take(1).toList(), taille, EdgeInsets.zero);
    expect(seul.zoom, 12.5);
  });

  test('deux chantiers de la même maille : étiquettes côte à côte', () {
    final d = decalagesRadar(_points);
    expect(d['o1'], -pasEtiquettes / 2);
    expect(d['o5'], pasEtiquettes / 2);
    expect(d['o2'], 0);
  });

  test("l'offre donne sa maille et la zone se lit", () {
    const avec = RadarOffre(data: {
      'id': 'o1',
      'position': {'lat': 48.87, 'lon': 2.35},
    });
    const sans = RadarOffre(data: {'id': 'o2', 'position': null});
    expect(avec.position, (lat: 48.87, lon: 2.35));
    expect(sans.position, isNull);
    final zone = RadarZone.fromJson(
        {'lat': 48.88, 'lon': 2.34, 'radiusKm': 15, 'ville': 'Paris'});
    expect((zone!.ville, zone.radiusKm), ('Paris', 15));
    expect(RadarZone.fromJson(null), isNull);
  });

  testWidgets('ordinateur : légendes, zoom, étiquette choisie', (tester) async {
    String? choisi;
    await _ouvrir(
      tester,
      Center(
        child: SizedBox(
          width: 640,
          height: 300,
          child: RadarCarte(
            points: _points,
            selectedId: 'o1',
            onSelect: (id) => choisi = id,
            zone: _zone,
            caption: 'Paris et 15 km autour · 5 chantiers',
            nouveaux: 2,
            prises: 1,
            fond: fondUni,
          ),
        ),
      ),
      const Size(700, 360),
    );
    expect(find.text('Paris et 15 km autour · 5 chantiers'), findsOneWidget);
    expect(find.text('Nouveau 2'), findsOneWidget);
    expect(find.text('Position prise 1'), findsOneWidget);
    await expectLater(find.byType(RadarCarte),
        matchesGoldenFile('goldens/radar_carte_ordinateur.png'));

    await tester.tap(find.text('1 500 €'));
    expect(choisi, 'o3');

    // + rapproche les étiquettes du bord : elles s'écartent les unes des autres
    final avant = tester.getCenter(find.text('1 500 €')) -
        tester.getCenter(find.text('13 500 €'));
    await tester.tap(find.text('+'));
    await tester.pump();
    final apres = tester.getCenter(find.text('1 500 €')) -
        tester.getCenter(find.text('13 500 €'));
    expect(apres.distance, greaterThan(avant.distance * 1.9));
  });

  testWidgets('téléphone plein écran : les prix seuls', (tester) async {
    await _ouvrir(
      tester,
      const RadarCarte(
        points: _points,
        selectedId: 'o1',
        zone: _zone,
        caption: 'Paris et 15 km autour · 5 chantiers',
        nouveaux: 2,
        prises: 1,
        plein: true,
        marges: EdgeInsets.fromLTRB(36, 150, 36, 330),
        fond: fondUni,
      ),
      const Size(390, 844),
    );
    expect(find.text('Paris et 15 km autour · 5 chantiers'), findsNothing);
    expect(find.text('+'), findsNothing);
    await expectLater(find.byType(RadarCarte),
        matchesGoldenFile('goldens/radar_carte_telephone.png'));
  });
}
