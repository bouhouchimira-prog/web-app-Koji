import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:koji/apps/entreprise/devis/pro_faire_signer_screen.dart';
import 'package:koji/apps/entreprise/devis/signature_lieu.dart';

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

// Signature et rétractation (maquette PRO-03.7) : mêmes exemples que le site
// (tests/unit/signature-lieu.test.js).
void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  test('applique les règles du lieu de signature', () {
    final ligne = reglesSignature('en-ligne');
    expect([ligne.retractation, ligne.paiementAvant7Jours, ligne.formulaire, ligne.demarrageAvantFin], [true, 'possible', true, 'demande-expresse']);
    final domicile = reglesSignature('domicile');
    expect([domicile.retractation, domicile.paiementAvant7Jours, domicile.formulaire, domicile.demarrageAvantFin], [true, 'interdit', true, 'demande-expresse']);
    final locaux = reglesSignature('locaux');
    expect([locaux.retractation, locaux.paiementAvant7Jours, locaux.formulaire, locaux.demarrageAvantFin], [false, 'possible', false, 'libre']);
    expect(reglesSignature('domicile', 'societe').retractation, false);
  });

  test('calcule les dates comme la maquette, avec report au jour ouvrable', () {
    expect(finRetractation('2026-10-30', 'domicile'), '2026-11-13');
    expect(finRetractation('2026-10-30', 'locaux'), '');
    expect(finRetractation('2026-10-30', 'domicile', 'societe'), '');
    // 31 oct. + 14 = samedi 14 nov. → lundi 16 nov.
    expect(finRetractation('2026-10-31', 'en-ligne'), '2026-11-16');
    // 28 oct. + 14 = mercredi 11 nov. (férié) → jeudi 12 nov.
    expect(finRetractation('2026-10-28', 'en-ligne'), '2026-11-12');
    expect(acompteAPartirDu('2026-10-30', 'domicile'), '2026-11-07');
    expect(acompteAPartirDu('2026-10-30', 'en-ligne'), '');
    expect(demarrageAvantFin('2026-11-12', '2026-11-13'), true);
    expect(demarrageAvantFin('2026-11-16', '2026-11-13'), false);
    expect(lundiApres('2026-11-13'), '2026-11-16');
    expect(libelleLundi('2026-11-16'), 'lundi 16 nov.');
  });

  test('écrit les textes lus par le client', () {
    expect(texteRetractation('2026-11-13'),
        "Vous pouvez annuler sans motif jusqu'au 13 novembre inclus, avec le formulaire joint ou depuis votre espace Koji. Les sommes versées sont remboursées sous 14 jours.");
    expect(texteDemandeExpresse('2026-11-12'),
        'Je demande que les travaux commencent le 12 novembre, avant la fin du délai de rétractation. Si je me rétracte ensuite, je paierai les travaux déjà réalisés.');
    expect(texteAcompte(30, 1739.56, '2026-11-07'), 'Acompte 30 % : 1 739,56 €, demandé à partir du 7 novembre');
    expect(masquerEmail('s.lefevre.k@exemple.fr'), 's••••.k@••••.fr');
    expect(formulaireRetractation(entreprise: 'ABL Expert Renov')[2], "À l'attention de ABL Expert Renov :");
  });

  testWidgets('Faire signer chez la cliente (maquette, téléphone) : lieu, signature, après', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    SignatureSurPlace? recu;
    var envoyer = 0;
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ProFaireSignerScreen(
        numeroDevis: '2026-041',
        version: 2,
        client: 'Mme Lefèvre',
        email: 's.lefevre.k@exemple.fr',
        titre: 'Salle de bain, Paris 10e',
        totalTtc: 5798.54,
        tauxTva: 10,
        acomptePct: 30,
        debut: '2026-11-12',
        maintenant: () => DateTime.utc(2026, 10, 30, 17, 42),
        rendu: (traits, taille) async => [137, 80, 78, 71],
        onEnvoyer: () => envoyer++,
        onDecaler: (jour) async => null,
        onLancer: () {},
        onSigner: (s) async {
          recu = s;
          return const SigneSurPlace(retractationJusquau: '2026-11-13', acompteAPartirDu: '2026-11-07', demarrageDemande: '2026-11-12', exemplaireEnvoye: true);
        },
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text("Rétractation jusqu'au 13 nov."), findsOneWidget);
    expect(find.text('Acompte le 7 nov.'), findsOneWidget);
    expect(find.text('Démarrage le 12 nov., avant la fin du délai'), findsOneWidget);
    expect(find.text('Décaler au lundi 16 nov.'), findsOneWidget);
    await expectLater(find.byType(ProFaireSignerScreen), matchesGoldenFile('goldens/pro_faire_signer_lieu.png'));
    await tester.tap(find.text('Envoyer pour signature'));
    expect(envoyer, 1);

    await tester.tap(find.text('Passer le téléphone à Mme Lefèvre'));
    await tester.pumpAndSettle();
    expect(find.text('Avant de signer'), findsOneWidget);
    expect(find.text('Acompte 30 % : 1 739,56 €, demandé à partir du 7 novembre'), findsOneWidget);
    expect(find.textContaining("jusqu'au 13 novembre inclus"), findsOneWidget);
    expect(find.text('Je reçois mon exemplaire par e-mail · s••••.k@••••.fr'), findsOneWidget);
    // Aucune case pré-cochée ; Signer reste grisé sans signature ni mention.
    expect(tester.widgetList<Checkbox>(find.byType(Checkbox)).every((c) => c.value == false), isTrue);
    await expectLater(find.byType(ProFaireSignerScreen), matchesGoldenFile('goldens/pro_faire_signer_client.png'));
    for (final t in ['Je demande que les travaux', "Logement de plus de 2 ans", 'Je reçois mon exemplaire']) {
      await tester.tap(find.textContaining(t));
      await tester.pump();
    }
    await tester.dragUntilVisible(find.text('Signez ici'), find.byType(ListView), const Offset(0, -200));
    await tester.pumpAndSettle();
    final zone = tester.getCenter(find.text('Signez ici'));
    await tester.dragFrom(zone, const Offset(80, 20));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Signer'));
    await tester.pumpAndSettle();
    expect(recu!.lieu, 'domicile');
    expect(recu!.jour, '2026-10-30');
    expect(recu!.signataire, 'Mme Lefèvre');
    expect([recu!.demandeExpresse, recu!.mentionTva, recu!.exemplaireEmail].every((x) => x.startsWith('2026-10-30T17:42')), isTrue);

    expect(find.text('Devis signé'), findsOneWidget);
    expect(find.text('Signé chez Mme Lefèvre 30 oct., 18 h 42 · version 2 · 5 798,54 € TTC'), findsOneWidget);
    expect(find.text("Acompte bloqué jusqu'au 7 nov."), findsOneWidget);
    expect(find.text('démarrage le 12 nov. demandé par Mme Lefèvre'), findsOneWidget);
    await expectLater(find.byType(ProFaireSignerScreen), matchesGoldenFile('goldens/pro_faire_signer_fait.png'));
  });
}
