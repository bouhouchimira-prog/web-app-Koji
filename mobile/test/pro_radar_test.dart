import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/radar/pro_radar_screens.dart';

// Radar côté téléphone (maquette PRO-04) : fiche, me positionner, mes
// positions. Données du site simulées, rien n'est envoyé.

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

Map<String, dynamic> _offre({Map<String, dynamic>? maPosition, int solde = 18}) => {
      'id': 'radar-1',
      'description': "Rénovation salle de bain, 5,8 m², douche à l'italienne à la place de la baignoire. 4e étage sans ascenseur.",
      'metier': 'Salle de bain',
      'address': '75010 Paris 10e',
      'distanceKm': 2.4,
      'publieLe': '2026-10-24T09:00:00Z',
      'metierCorrespond': 'Salle de bain',
      'dansZone': true,
      'delaiEstimeJours': 6,
      'ouvrages': [
        {
          'room': 'Salle de bain',
          'postes': ['Dépose complète', "Douche à l'italienne 90 × 120", 'Faïence toute hauteur', 'WC suspendu', 'Meuble vasque 80 cm'],
        }
      ],
      'prixRecommande': {'ttc': 6300, 'postes': 6, 'manquants': 0},
      'jetons': 3,
      'places': {'prises': 2, 'max': 3, 'complet': false},
      'solde': {'solde': solde, 'reserves': 3, 'debitesMois': 6},
      'creneaux': ['2026-11-17T13:00:00.000Z', '2026-11-18T07:30:00.000Z', '2026-11-19T16:00:00.000Z', '2026-11-21T09:00:00.000Z'],
      'messagePropose': "Bonjour, je suis Bilal, d'ABL Expert Renov. Je vous propose une visite pour valider l'accès et l'état de l'existant, puis un devis détaillé sous 48 h.",
      'aVerifier': ['Évacuations : diamètre et pente', 'Ventilation existante'],
      'maPosition': maPosition,
    };

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

  testWidgets('fiche du chantier : votre prix, positions, jetons, me positionner', (tester) async {
    var positionner = 0;
    await _ecran(tester, ProRadarFicheView(offre: _offre(), onPositionner: () => positionner++, onMesPositions: () {}, onPasInteresse: () {}));
    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    expect(find.text('Paris 10e · 2,4 km · 24 oct.'), findsOneWidget);
    expect(find.text('2 / 3'), findsOneWidget);
    expect(find.text('3 jetons'), findsOneWidget);
    await expectLater(find.byType(ProRadarFicheView), matchesGoldenFile('goldens/pro_radar_fiche.png'));
    await tester.tap(find.text('Me positionner'));
    expect(positionner, 1);
  });

  testWidgets('fiche : solde insuffisant (pas d\'achat dans l\'app) et proposition envoyée', (tester) async {
    await _ecran(tester, ProRadarFicheView(offre: _offre(solde: 1), onPositionner: () {}, onMesPositions: () {}));
    expect(find.text('Il faut 3 jetons, il vous en reste 1'), findsOneWidget);
    expect(find.textContaining('getkoji.io'), findsOneWidget);
    await _ecran(
        tester,
        ProRadarFicheView(
          offre: _offre(maPosition: {
            'etat': 'attente',
            'libelle': 'En attente',
            'etape': 'Proposition envoyée le 14 nov. · en attente',
            'jetons': {'n': 3, 'etat': 'reserves', 'texte': '3 jetons réservés · rendus le 21 nov. sans réponse'},
          }),
          onPositionner: () {},
          onMesPositions: () {},
          onRetirer: () {},
        ));
    expect(find.text('Proposition envoyée'), findsOneWidget);
    expect(find.text('3 jetons réservés · rendus le 21 nov. sans réponse'), findsOneWidget);
  });

  testWidgets('me positionner : message, créneaux, devis estimatif, jetons réservés', (tester) async {
    (String, List<String>, bool)? envoye;
    await _ecran(
        tester,
        ProMePositionnerScreen(
          offre: _offre(),
          onEnvoyer: (m, c, d) async {
            envoye = (m, c, d);
            return null;
          },
        ));
    expect(find.text('mar. 17 nov.'), findsOneWidget);
    expect(find.text('8 h 30'), findsOneWidget);
    expect(find.text('Devis estimatif · 6 300 € TTC'), findsOneWidget);
    await expectLater(find.byType(ProMePositionnerScreen), matchesGoldenFile('goldens/pro_radar_positionner.png'));
    await tester.tap(find.text('jeu. 19 nov.'));
    await tester.pump();
    await tester.tap(find.text('Envoyer'));
    await tester.pumpAndSettle();
    expect(envoye!.$2, ['2026-11-17T13:00:00.000Z', '2026-11-18T07:30:00.000Z', '2026-11-19T16:00:00.000Z']);
    expect(envoye!.$3, isTrue);
  });

  testWidgets('mes positions : visite confirmée, statuts, préparer la visite', (tester) async {
    Map<String, dynamic>? prepare;
    await _ecran(
        tester,
        ProMesPositionsView(
          donnees: const {
            'jetons': {'solde': 12},
            'visiteConfirmee': {
              'offerId': 'radar-1',
              'titre': 'Rénovation salle de bain, 5,8 m²',
              'ville': 'Paris 10e',
              'rdvDate': '2026-11-17T13:00:00.000Z',
              'jetons': {'texte': '3 jetons débités'},
            },
            'positions': [
              {'offerId': 'radar-1', 'titre': 'Rénovation salle de bain, 5,8 m²', 'etat': 'rdv', 'libelle': 'RDV confirmé', 'etape': 'Visite confirmée mar. 17 nov. 14 h', 'jetons': {'texte': '3 jetons débités'}},
              {'offerId': 'radar-2', 'titre': 'Peinture séjour et couloir, 42 m²', 'etat': 'attente', 'libelle': 'En attente', 'etape': 'Proposition vue · en attente', 'jetons': {'texte': '3 jetons réservés · rendus le 20 nov. sans réponse'}},
              {'offerId': 'radar-3', 'titre': 'Remplacement tableau électrique', 'etat': 'expiree', 'libelle': 'Expirée', 'etape': 'Expirée · aucune réponse du client', 'termine': true, 'jetons': {'texte': '1 jeton rendu'}},
            ],
          },
          onOuvrir: (_) {},
          onPreparerVisite: (v) => prepare = v,
        ));
    expect(find.text('Visite confirmée · mar. 17 nov. 14 h'), findsOneWidget);
    await expectLater(find.byType(ProMesPositionsView), matchesGoldenFile('goldens/pro_radar_positions.png'));
    await tester.tap(find.text('Préparer la visite'));
    expect(prepare!['offerId'], 'radar-1');
  });
}
