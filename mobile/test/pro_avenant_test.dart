import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/avenant/pro_avenant_screens.dart';

// Avenants côté téléphone (maquettes PRO-05 et PRO-05.1). Site simulé.

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

const _devis = <String, dynamic>{
  'id': 'q41',
  'quoteNumber': '2026-041',
  'client': 'Mme Lefèvre',
  'clientEmail': 's.lefevre.k@exemple.fr',
  'project': 'Salle de bain, Paris 10e',
  'totalHt': 5271.4,
  'vatRate': 10,
  'items': [
    {'room': 'Dépose et préparation'},
    {'room': 'Plomberie'},
    {'room': 'Carrelage et faïence'},
    {'room': 'Électricité'},
  ],
};

const _lignes = [
  {'type': 'ajout', 'room': 'Dépose et préparation', 'label': 'Ragréer le sol avant carrelage', 'quantity': 5.8, 'unit': 'm²', 'unitPriceHt': 13.75, 'note': 'Sol irrégulier constaté à la dépose'},
  {'type': 'ajout', 'room': 'Plomberie', 'label': "Remplacer la vanne d'arrêt encastrée", 'quantity': 1, 'unit': 'u', 'unitPriceHt': 145, 'note': 'Vanne grippée, découverte à la dépose'},
  {'type': 'modification', 'room': 'Carrelage et faïence', 'label': 'Poser la faïence murale toute hauteur', 'quantity': 1.8, 'unit': 'm²', 'unitPriceHt': 88, 'quantiteAvant': 19.4, 'quantiteApres': 21.2, 'note': 'Retour de mur ajouté à la demande du client'},
  {'type': 'suppression', 'room': 'Électricité', 'label': 'Créer 1 prise supplémentaire', 'quantity': 1, 'unit': 'u', 'unitPriceHt': 65, 'note': 'Retirée à la demande du client'},
];

Future<void> _ecran(WidgetTester tester, Widget w) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(debugShowCheckedModeBanner: false, home: w));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  testWidgets('avenant depuis le chantier : notes, Koji, lignes, total, envoi', (tester) async {
    String? notes;
    Map<String, dynamic>? envoye;
    await _ecran(
        tester,
        ProAvenantScreen(
          devis: _devis,
          finPrevue: '2026-11-27',
          actions: AvenantActions(
            preparer: (n) async {
              notes = n;
              return {'lignes': _lignes, 'impactJours': 1, 'message': "Bonjour Mme Lefèvre, voici l'avenant suite à la dépose. Un jour de plus sur le planning."};
            },
            enregistrer: (corps, {required envoyer, required email}) async {
              envoye = {...corps, 'envoyer': envoyer, 'email': email};
              return {'numero': 'AV-1', 'status': envoyer ? 'Envoye' : 'Brouillon', 'emailEnvoye': true};
            },
          ),
        ));
    await tester.enterText(find.byType(TextField), 'sol pas droit, vanne HS, la cliente veut la faïence sur le retour, enlève la 2e prise');
    await tester.pump();
    await tester.tap(find.text('Préparer avec Koji'));
    await tester.pumpAndSettle();
    expect(notes, contains('vanne HS'));
    expect(find.text('Lot 03 · 19,4 → 21,2 m² × 88,00 € · Retour de mur ajouté à la demande du client'), findsOneWidget);
    expect(find.text('+ 318,15 €'), findsOneWidget);
    expect(find.text('5 589,55 € HT'), findsOneWidget);
    await expectLater(find.byType(ProAvenantScreen), matchesGoldenFile('goldens/pro_avenant.png'));
    await tester.dragUntilVisible(find.text('Envoyer pour signature'), find.byType(ListView), const Offset(0, -200));
    await tester.tap(find.text('Envoyer pour signature'));
    await tester.pumpAndSettle();
    expect(envoye!['envoyer'], isTrue);
    expect(envoye!['impactJours'], 1);
    expect((envoye!['lignes'] as List).length, 4);
    expect(find.text('A1 envoyé pour signature.'), findsOneWidget);
  });

  testWidgets('liste des avenants par état', (tester) async {
    await _ecran(
        tester,
        const ProAvenantsView(avenants: [
          {'numero': 'AV-2', 'chantier': 'Appartement Caulaincourt', 'motif': 'Meuble vasque remplacé, + 2 m² de faïence', 'totalTtcDelta': 236.28, 'status': 'Signe', 'signedAt': '2026-10-30T10:00:00Z'},
          {'numero': 'AV-1', 'chantier': 'Bureaux Auteuil', 'motif': 'Cloison vitrée au lieu de pleine', 'totalTtcDelta': 1420, 'status': 'Envoye', 'sentAt': '2026-11-02T10:00:00Z'},
          {'numero': 'AV-1', 'chantier': 'Salle de bain, Paris 10e', 'motif': 'Peinture plafond ajoutée', 'totalTtcDelta': 211.4, 'status': 'Brouillon'},
        ]));
    expect(find.text('3 · 1 à signer'), findsOneWidget);
    expect(find.text('A2 · Appartement Caulaincourt'), findsOneWidget);
    await expectLater(find.byType(ProAvenantsView), matchesGoldenFile('goldens/pro_avenants.png'));
    await tester.tap(find.text('À signer 1'));
    await tester.pumpAndSettle();
    expect(find.text('A1 · Bureaux Auteuil'), findsOneWidget);
    expect(find.text('A2 · Appartement Caulaincourt'), findsNothing);
  });
}
