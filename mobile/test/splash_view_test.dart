import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/features/splash/splash_screen.dart';

// Écrans de démarrage PRO-00.1 (Koji Pro) et CLI-05 (Koji) : textes et
// couleurs de la maquette, une app = un écran (pas de porte d'entrée commune).
Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(_chargerDmSans);

  for (final (nom, palette) in [
    ('pro', SplashPalette.pro),
    ('client', SplashPalette.client),
  ]) {
    testWidgets('démarrage $nom', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: SplashView(palette: palette),
      ));
      await tester.pumpAndSettle();
      expect(find.text(palette.texte), findsOneWidget);
      expect(find.text(palette.texteChargement), findsOneWidget);
      expect(find.bySemanticsLabel('Koji'), findsOneWidget);
      await expectLater(find.byType(SplashView),
          matchesGoldenFile('goldens/splash_$nom.png'));
    });
  }

  test('palettes de la charte v2', () {
    expect(SplashPalette.pro.fond, const Color(0xFF171B1E));
    expect(SplashPalette.pro.etoile, isTrue);
    expect(SplashPalette.client.fond, const Color(0xFF101529));
    expect(SplashPalette.client.motSymbole, const Color(0xFFE7D8C5));
    expect(SplashPalette.client.etoile, isFalse);
  });
}
