import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/devis/facture_acompte.dart';
import 'package:koji/apps/entreprise/devis/pro_facture_acompte_screen.dart';

// Facture d'acompte (maquette PRO-03.4) : mêmes exemples que le site
// (tests/unit/facture-acompte.test.js) et l'écran du téléphone.

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

  test('montant, TVA comprise, échéance, message, erreurs (règles du site)', () {
    expect(montantAcompte(5798.54, 30), 1739.56);
    expect(tvaIncluse(1739.56, 10), 158.14);
    expect(montantAcompte(5798.54, 50), 2899.27);
    expect(tvaIncluse(1200, 20), 200);
    expect(tvaIncluse(1055, 5.5), 55);
    expect(dateEcheance('2026-10-30', 0), '2026-10-30');
    expect(dateEcheance('2026-10-30', 8), '2026-11-07');
    expect(
      messageAcompte(client: 'Mme Lefèvre', pourcentage: 30, debut: DateTime(2026, 11, 12)),
      "Bonjour Mme Lefèvre, merci pour votre signature. Voici la facture d'acompte de 30 % prévue au devis. Son règlement confirme le démarrage le 12 novembre.",
    );
    expect(messageAcompte(pourcentage: 25),
        "Bonjour, merci pour votre signature. Voici la facture d'acompte de 25 % prévue au devis. Son règlement confirme le démarrage du chantier.");
    expect(erreurAcompte(pourcentage: 30, montant: 1739.56, restant: 5798.54), '');
    expect(erreurAcompte(pourcentage: 0, montant: 0), 'Choisis un pourcentage entre 1 et 100.');
    expect(erreurAcompte(pourcentage: 30, montant: 1739.56, restant: 1000), 'Le montant dépasse ce qui reste à facturer sur ce devis.');
    expect(erreurAcompte(pourcentage: 30, montant: 1, envoyer: true, email: true), "Ajoute l'e-mail du client pour lui envoyer la facture.");
  });

  testWidgets('écran Facture d\'acompte (maquette, téléphone), 40 % puis envoi', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final choix = <(AcompteChoix, bool)>[];
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ProFactureAcompteScreen(
        numeroDevis: '2026-041',
        client: 'Mme Lefèvre',
        email: 's.lefevre@exemple.fr',
        totalHt: 5271.40,
        totalTtc: 5798.54,
        tva: 10,
        signeLe: '30 oct.',
        debut: DateTime(2026, 11, 12),
        restant: 5798.54,
        maintenant: () => DateTime(2026, 10, 30),
        onValider: (c, {required envoyer}) async {
          choix.add((c, envoyer));
          return null;
        },
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('2026-041 · Mme Lefèvre'), findsOneWidget);
    expect(find.text('5 271,40 € HT · 5 798,54 € TTC · signé le 30 oct.'), findsOneWidget);
    expect(find.text('1 739,56 € TTC'), findsOneWidget);
    expect(find.text('dont TVA 10 % 158,14 €'), findsOneWidget);
    await expectLater(find.byType(ProFactureAcompteScreen), matchesGoldenFile('goldens/pro_facture_acompte.png'));

    await tester.tap(find.text('40 %'));
    await tester.pump();
    expect(find.text('2 319,42 € TTC'), findsOneWidget);
    await tester.dragUntilVisible(find.text("Envoyer la facture d'acompte"), find.byType(ListView), const Offset(0, -200));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Envoyer la facture d'acompte"));
    await tester.pumpAndSettle();
    expect(choix.single.$2, isTrue);
    expect(choix.single.$1.pourcentage, 40);
    expect(choix.single.$1.echeance, '2026-10-30');
    expect(choix.single.$1.adresse, 's.lefevre@exemple.fr');
    expect(choix.single.$1.message, contains("facture d'acompte de 40 % prévue au devis"));
  });
}
