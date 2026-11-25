import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/koji/koji_assistant.dart';
import 'package:koji/features/profile/company_profile_screen.dart';

// Retours du build 64, sprint 4 : textes et design. Onglets qui ne coupent
// plus les mots, onglet actif lisible, bandeau sombre et barre d'état, bouton
// Koji qui s'efface, nombres du Profil Entreprise.

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

class _EcranAvecBoutonEnBas extends StatefulWidget {
  const _EcranAvecBoutonEnBas();
  @override
  State<_EcranAvecBoutonEnBas> createState() => _EtatEcran();
}

class _EtatEcran extends State<_EcranAvecBoutonEnBas> with SansBoutonKoji<_EcranAvecBoutonEnBas> {
  @override
  Widget build(BuildContext context) => const Scaffold(body: Text('Valider la réception'));
}

void main() {
  setUpAll(_chargerDmSans);
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  Future<void> monter(WidgetTester tester, Widget corps, {double largeur = 390}) async {
    tester.view.physicalSize = Size(largeur * 3, 300 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(KojiAppKind.entreprise),
      home: Scaffold(body: Padding(padding: const EdgeInsets.all(20), child: corps)),
    ));
    await tester.pumpAndSettle();
  }

  // « Command-es », « Partenaire-s » : les cinq onglets de Fournitures.
  testWidgets('onglets : un libellé trop long fait défiler la barre, il ne se coupe pas', (tester) async {
    const onglets = {'catalogue': 'Catalogue', 'chantiers': 'Commandes 0', 'bons': 'Bons', 'partenaires': 'Partenaires', 'stock': 'Stock'};
    var choisi = 'catalogue';
    await monter(
        tester,
        Column(mainAxisSize: MainAxisSize.min, children: [
          StatefulBuilder(
            builder: (context, setState) => KojiSegmented<String>(compact: true, options: onglets, value: choisi, onChanged: (v) => setState(() => choisi = v)),
          ),
        ]));
    expect(find.byType(SingleChildScrollView), findsOneWidget, reason: 'la barre défile');
    for (final libelle in onglets.values) {
      final texte = tester.widget<Text>(find.text(libelle));
      expect(texte.maxLines, 1);
      expect(tester.getSize(find.text(libelle)).height, lessThan(24), reason: '« $libelle » tient sur une ligne');
    }
    await expectLater(find.byType(KojiSegmented<String>), matchesGoldenFile('goldens/pro_onglets_fournitures.png'));
    // Le dernier onglet reste atteignable.
    await tester.ensureVisible(find.text('Stock'));
    await tester.tap(find.text('Stock'));
    await tester.pumpAndSettle();
    expect(choisi, 'stock');
  });

  testWidgets('onglets : quand tout tient, ils se partagent la largeur comme avant', (tester) async {
    await monter(tester, KojiSegmented<String>(compact: true, options: const {'jour': 'Jour', 'chantier': 'Par chantier'}, value: 'jour', onChanged: (_) {}));
    expect(find.byType(SingleChildScrollView), findsNothing);
    expect(tester.getSize(find.byType(KojiSegmented<String>)).width, 350);
  });

  testWidgets("puce sélectionnée : le texte prend la couleur prévue sur le fond de sélection", (tester) async {
    await monter(tester, Wrap(spacing: 8, children: [
      ChoiceChip(label: const Text('Toutes'), selected: true, onSelected: (_) {}),
      ChoiceChip(label: const Text('À faire'), selected: false, onSelected: (_) {}),
    ]));
    final theme = KojiTheme.light(KojiAppKind.entreprise).chipTheme;
    expect(theme.secondaryLabelStyle?.color, isNotNull);
    expect(theme.secondaryLabelStyle?.color, isNot(theme.labelStyle?.color), reason: 'le texte sélectionné ne garde pas le gris des autres');
    expect(theme.secondaryLabelStyle?.color, isNot(theme.selectedColor), reason: 'ni la couleur de son propre fond');
  });

  testWidgets("bandeau sombre : l'heure et la batterie passent en clair", (tester) async {
    await monter(tester, const ProBandeau(padding: EdgeInsets.all(12), child: Text('TEST 2')));
    final region = tester.widget<AnnotatedRegion<SystemUiOverlayStyle>>(
        find.ancestor(of: find.text('TEST 2'), matching: find.byType(AnnotatedRegion<SystemUiOverlayStyle>)).first);
    expect(region.value, SystemUiOverlayStyle.light);
  });

  testWidgets("bouton Koji : il s'efface tant qu'un écran a son propre bouton en bas", (tester) async {
    final avant = boutonKojiMasque.value;
    await tester.pumpWidget(const MaterialApp(home: _EcranAvecBoutonEnBas()));
    await tester.pump();
    expect(boutonKojiMasque.value, avant + 1);
    await tester.pumpWidget(const MaterialApp(home: Scaffold()));
    await tester.pump();
    expect(boutonKojiMasque.value, avant, reason: "il revient quand l'écran se ferme");
  });

  test('Profil Entreprise : virgule et nombres sans « .0 »', () {
    expect(coutHoraire(75), '75,00 € / h');
    expect(coutHoraire(43.75), '43,75 € / h');
    expect(nombreSaisi(750.0, '350'), '750');
    expect(nombreSaisi(10, '7'), '10');
    expect(nombreSaisi(7.5, '7'), '7.5', reason: 'le champ se relit avec un point');
    expect(nombreSaisi(null, '350'), '350');
  });
}
