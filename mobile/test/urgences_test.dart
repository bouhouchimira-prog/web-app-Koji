import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/client/screens/client_urgence_screen.dart';
import 'package:koji/features/urgences/urgences_logic.dart';
import 'package:koji/features/urgences/urgences_pro.dart';

import 'client_charte_support.dart';

// Urgences (maquette PRO-17) : Mme Lefèvre, fuite sous l'évier, Paris 10e ;
// Karim B. Plomberie reçoit, accepte, part. Réponses du site simulées (même
// forme que /api/urgences et /api/client/urgences), rien n'est envoyé.

Future<void> _policesPro() async {
  final racine = Platform.environment['FLUTTER_ROOT'];
  final icones = File('$racine/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (racine != null && icones.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(icones.readAsBytes().then((b) => ByteData.view(b.buffer)))).load();
  }
}

Future<void> _ecran(WidgetTester tester, Widget w) async {
  cadreTelephone(tester);
  await tester.pumpWidget(MaterialApp(debugShowCheckedModeBanner: false, home: w));
  await tester.pumpAndSettle();
}

Map<String, dynamic> _cat(String id, String label, num? prix, {bool autorisee = true}) => {
      'id': id,
      'label': label,
      'icone': categorieUrgence(id)!.icone,
      'prix': prix,
      'choisie': prix != null,
      'autorisee': autorisee,
      'raison': autorisee ? '' : 'à déclarer dans votre profil (métier)',
      'prixIntervention': 89,
    };

Map<String, dynamic> _vuePro({List<Map<String, dynamic>> enCours = const []}) => {
      'acces': {'ok': true, 'raison': ''},
      'entreprise': 'Karim B. Plomberie',
      'reglages': {
        'actif': true,
        'jusqua': '20:00',
        'heureParDefaut': '20:00',
        'zone': {'adresse': 'Paris 10e', 'rayonKm': 8},
        'demiHeure': 35,
        'categories': [
          _cat('fuite', 'Fuite d\'eau', 89),
          _cat('bouche', 'Canalisation bouchée', 110),
          _cat('eau_chaude', 'Plus d\'eau chaude', 89),
          _cat('electricite', 'Panne d\'électricité', null, autorisee: false),
          _cat('serrure', 'Porte claquée, serrure', null),
          _cat('vitre', 'Vitre cassée', null),
        ],
      },
      'rayons': [3, 5, 8, 10, 15, 20],
      'note': notePro,
      'propositions': [],
      'enCours': enCours,
      'prises': [],
      'chiffres': {'urgences': 2, 'facture': 128, 'factureTexte': '128 €', 'arriveeMoyenne': 22, 'arriveeTexte': '22 min'},
      'interventions': [],
    };

const _proposition = {
  'id': 'urg-1',
  'categorie': 'fuite',
  'titre': 'Fuite d\'eau · sous l\'évier',
  'quartier': 'Paris 10e',
  'distance': '2,1 km',
  'minutes': 9,
  'details': [
    {'libelle': 'Où', 'valeur': 'sous l\'évier'},
    {'libelle': 'Eau coupée', 'valeur': 'oui'},
    {'libelle': 'Quand', 'valeur': 'maintenant'},
  ],
  'photo': null,
  'prix': {'montant': '89 € TTC', 'detail': 'déplacement et 1re demi-heure, puis 35 € la demi-heure'},
  'finLe': '2026-10-30T09:17:00.000Z',
  'secondes': 42,
  'proposeeA': 3,
  'serrure': false,
};

Map<String, dynamic> _urgence(String etat) {
  final artisan = {
    'nom': 'Karim B., plombier',
    'prenom': 'Karim',
    'entreprise': 'Karim B. Plomberie',
    'initiales': 'KB',
    'avis': {'moyenne': '4,9', 'nombre': 12},
    'urgences': 112,
    'verifie': true,
    'telephone': etat == 'acceptee' ? '' : '06 12 34 56 78',
    'arrivee': 'vers 10:42 · 24 min',
    'arriveeVers': '10:42',
    'prix': '89 € TTC, puis 35 € la demi-heure',
    'pieces': 'sur devis signé avant travaux',
    'info': 'Koji vous met en relation. L\'intervention est réalisée et facturée par Karim B. Plomberie.',
  };
  return {
    'id': 'urg-1',
    'categorie': 'fuite',
    'titre': 'Fuite d\'eau · sous l\'évier',
    'etat': etat,
    'message': etat == 'recherche' ? 'Nous prévenons les artisans disponibles les plus proches. Le premier qui accepte vous est proposé ; vous confirmez ensuite.' : '',
    'quartier': 'Paris 10e',
    'adresse': '12 Rue Exemple 75010 Paris',
    'details': [],
    'photo': null,
    'prix': {'montant': '89 à 110 € TTC', 'detail': 'déplacement et première demi-heure selon l\'artisan, puis 35 à 40 € la demi-heure · les pièces sont sur devis, signé avant tout travail'},
    'artisan': etat == 'recherche' ? null : artisan,
    'suivi': etat == 'en_route'
        ? {
            'titre': 'Karim arrive dans 9 min',
            'sousTitre': 'arrivée annoncée vers 10:42 · il peut vous appeler au numéro que vous avez donné',
            'etapes': [
              {'libelle': 'Confirmée', 'fait': true},
              {'libelle': 'En route', 'fait': true},
              {'libelle': 'Sur place', 'fait': false},
              {'libelle': 'Facture', 'fait': false},
            ],
            'note': 'Avant de commencer, Karim vous fera signer un devis sur son téléphone.',
          }
        : null,
    'devis': null,
    'facture': null,
    'actions': {'confirmer': etat == 'acceptee', 'annuler': etat != 'sur_place', 'relancer': etat == 'sans_artisan'},
  };
}

void main() {
  setUpAll(() async {
    await chargerPolicesClient();
    await _policesPro();
  });

  group('règles', () {
    test('catégories de la maquette, deux questions chacune, gaz exclu', () {
      expect(categoriesUrgence.map((c) => c.label), ['Fuite d\'eau', 'WC ou évier bouché', 'Panne d\'électricité', 'Porte claquée, serrure', 'Plus d\'eau chaude', 'Vitre cassée']);
      expect(categoriesUrgence.every((c) => c.questions.length == 2), isTrue);
      expect(categoriesUrgence.any((c) => c.label.toLowerCase().contains('gaz')), isFalse);
      expect(texteGaz, contains('0 800 47 33 33'));
      expect(categorieUrgence('bouche')!.pro, 'Canalisation bouchée');
      expect(ordrePro.toSet(), categoriesUrgence.map((c) => c.id).toSet());
    });

    test('réponses, téléphone, photo JPEG', () {
      final c = categorieUrgence('fuite')!;
      expect(reponsesCompletes(c, {'ou': 'WC'}), isFalse);
      expect(reponsesCompletes(c, {'ou': 'WC', 'coupee': 'Oui'}), isTrue);
      expect(telephoneValide('06 12 34 56'), isFalse);
      expect(telephoneValide('06 12 34 56 78'), isTrue);
      expect(estJpeg([0xFF, 0xD8, 0xFF, 0xE0]), isTrue);
      expect(estJpeg([0x89, 0x50, 0x4E, 0x47]), isFalse);
      expect(dataUrlJpeg([0xFF, 0xD8, 0xFF, 0xD9]), 'data:image/jpeg;base64,/9j/2Q==');
    });

    test('compte à rebours et rythme du suivi', () {
      final t0 = DateTime.parse('2026-10-30T09:16:18Z');
      expect(secondesRestantes('2026-10-30T09:17:00.000Z', t0), 42);
      expect(secondesRestantes('2026-10-30T09:16:00.000Z', t0), 0);
      expect(compteARebours(42), '0:42');
      expect(compteARebours(5), '0:05');
      expect(compteARebours(60), '0:59');
      expect(intervalleSuivi('recherche'), const Duration(seconds: 4));
      expect(intervalleSuivi('en_route'), const Duration(seconds: 15));
      expect(titreEtat('sans_artisan').$1, 'Aucun artisan disponible');
      expect(euros2(101), '101,00 €');
      expect(eurosCourt(89), '89 €');
    });
  });

  group('Koji Pro', () {
    testWidgets('1 · être disponible : mes urgences, aujourd\'hui', (tester) async {
      bool? bascule;
      await _ecran(tester, UrgencesProView(vue: _vuePro(), onBasculer: (v) => bascule = v, onModifier: () {}, onRetirer: (_) {}, onPartir: (_, __) {}, onOuvrir: (_) {}));
      expect(find.text('Je reçois les urgences'), findsOneWidget);
      expect(find.text('jusqu\'à 20:00 · 8 km autour de Paris 10e'), findsOneWidget);
      expect(find.text('Canalisation bouchée'), findsOneWidget);
      expect(find.text('110 €'), findsOneWidget);
      expect(find.text('22 min'), findsOneWidget);
      expect(find.text(notePro), findsOneWidget);
      await expectLater(find.byType(UrgencesProView), matchesGoldenFile('goldens/pro17_disponible.png'));
      await tester.tap(find.text('Je reçois les urgences'));
      expect(bascule, isFalse);
    });

    testWidgets('2 · une urgence arrive : refuser librement, accepter avec l\'heure d\'arrivée', (tester) async {
      int? minutes;
      var refus = 0;
      await _ecran(tester, UrgenceAlerteView(proposition: _proposition, anime: false, onAccepter: (m) => minutes = m, onRefuser: () => refus++));
      expect(find.text('NOUVELLE URGENCE'), findsOneWidget);
      expect(find.text('Paris 10e · 2,1 km · environ 9 min'), findsOneWidget);
      expect(find.text('0:42'), findsOneWidget);
      expect(find.text('89 € TTC'), findsOneWidget);
      expect(find.textContaining('Proposée aux 3 artisans disponibles les plus proches'), findsOneWidget);
      // ni adresse exacte ni téléphone avant la confirmation du client
      expect(find.textContaining('Rue Exemple'), findsNothing);
      await expectLater(find.byType(UrgenceAlerteView), matchesGoldenFile('goldens/pro17_alerte.png'));
      await tester.tap(find.bySemanticsLabel('Plus de minutes'));
      await tester.pump();
      expect(find.text('14 min'), findsOneWidget);
      await tester.tap(find.text('Accepter'));
      expect(minutes, 14);
      await tester.tap(find.text('Refuser'));
      expect(refus, 1);
    });

    testWidgets('3 · confirmée par le client : je pars', (tester) async {
      (Map<String, dynamic>, int)? parti;
      await _ecran(
          tester,
          UrgencesProView(
            vue: _vuePro(enCours: [
              {'id': 'urg-1', 'titre': 'Fuite d\'eau · sous l\'évier', 'quartier': 'Paris 10e', 'etat': 'confirmee', 'interventionId': 'int-1', 'arriveeVers': '10:42', 'minutes': 24, 'parti': false, 'serrure': false},
            ]),
            onBasculer: (_) {},
            onModifier: () {},
            onRetirer: (_) {},
            onPartir: (e, m) => parti = (e, m),
            onOuvrir: (_) {},
          ));
      expect(find.text('Confirmée'), findsOneWidget);
      expect(find.text('24 min'), findsOneWidget);
      await tester.tap(find.text('Je pars'));
      expect(parti!.$1['id'], 'urg-1');
      expect(parti!.$2, 24);
    });

    testWidgets('modifier : électricité réservée aux métiers déclarés', (tester) async {
      Map<String, dynamic>? envoye;
      tester.view.physicalSize = const Size(390, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => Scaffold(body: TextButton(onPressed: () async => envoye = await Navigator.of(context).push<Map<String, dynamic>>(MaterialPageRoute(builder: (_) => UrgencesReglagesView(vue: _vuePro()))), child: const Text('ouvrir'))))));
      await tester.tap(find.text('ouvrir'));
      await tester.pumpAndSettle();
      expect(find.text('à déclarer dans votre profil (métier)'), findsOneWidget);
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();
      expect(envoye!['action'], 'reglages');
      expect(envoye!['rayonKm'], 8);
      expect((envoye!['prix'] as Map).keys, ['fuite', 'bouche', 'eau_chaude']);
    });
  });

  group('Koji Client', () {
    testWidgets('A · choisir l\'urgence, encadré gaz', (tester) async {
      String? choisi;
      await _ecran(tester, UrgenceChoixView(onChoisir: (id) => choisi = id, onSuivre: (_) {}, onRetour: () {}));
      expect(find.text('Que se passe-t-il ?'), findsOneWidget);
      expect(find.text('Odeur de gaz ?'), findsOneWidget);
      expect(find.text(texteGaz), findsOneWidget);
      await expectLater(find.byType(UrgenceChoixView), matchesGoldenFile('goldens/pro17_client_choix.png'));
      await tester.tap(find.bySemanticsLabel('Porte claquée, serrure'));
      expect(choisi, 'serrure');
    });

    testWidgets('B · deux questions, adresse et prix des artisans disponibles', (tester) async {
      Map<String, dynamic>? commande;
      await _ecran(
          tester,
          UrgenceQuestionsView(
            categorie: categorieUrgence('fuite')!,
            adresse: '12 rue Exemple, Paris 10e',
            telephone: '06 00 00 00 00',
            reponses: const {'ou': 'Sous l\'évier'},
            prix: const {
              'adresse': '12 rue Exemple, Paris 10e',
              'quartier': 'Paris 10e',
              'disponibles': 1,
              'prix': {'montant': '89 € TTC', 'detail': 'déplacement et première demi-heure, puis 35 € la demi-heure · les pièces sont sur devis, signé avant tout travail', 'note': ''},
            },
            demanderPrix: (_) async => {},
            commander: (c) async => commande = c,
            onRetour: () {},
          ));
      expect(find.text('Prix d\'intervention'), findsOneWidget);
      expect(find.text('89 € TTC'), findsOneWidget);
      // la seconde question manque : on ne peut pas encore commander
      await tester.tap(find.text('Trouver un artisan'));
      expect(commande, isNull);
      await tester.tap(find.text('Oui'));
      await tester.pump();
      await expectLater(find.byType(UrgenceQuestionsView), matchesGoldenFile('goldens/pro17_client_prix.png'));
      await tester.tap(find.text('Trouver un artisan'));
      await tester.pumpAndSettle();
      expect(commande!['categorie'], 'fuite');
      expect(commande!['reponses'], {'ou': 'Sous l\'évier', 'coupee': 'Oui'});
      expect(commande!['telephone'], '06 00 00 00 00');
      expect(commande!.containsKey('photo'), isFalse);
    });

    testWidgets('C · un artisan a accepté : confirmer ou annuler sans frais', (tester) async {
      final actions = <String>[];
      await _ecran(tester, UrgenceSuiviView(urgence: _urgence('acceptee'), onAgir: actions.add, onRetour: () {}));
      expect(find.text('Karim B., plombier'), findsOneWidget);
      expect(find.text('Identité, SIREN et assurance vérifiés par Koji'), findsOneWidget);
      expect(find.text('vers 10:42 · 24 min'), findsOneWidget);
      expect(find.text('89 € TTC, puis 35 € la demi-heure'), findsOneWidget);
      await expectLater(find.byType(UrgenceSuiviView), matchesGoldenFile('goldens/pro17_client_confirmer.png'));
      await tester.tap(find.text('Confirmer'));
      await tester.tap(find.text('Annuler sans frais'));
      expect(actions, ['confirmer', 'annuler']);
    });

    testWidgets('D · suivre son arrivée : heure annoncée, pas de position en direct', (tester) async {
      final liens = <Uri>[];
      await _ecran(tester, UrgenceSuiviView(urgence: _urgence('en_route'), onAgir: (_) {}, onLien: liens.add, onRetour: () {}));
      expect(find.text('Karim arrive dans 9 min'), findsOneWidget);
      expect(find.text('En route'), findsOneWidget);
      expect(find.text('Avant de commencer, Karim vous fera signer un devis sur son téléphone.'), findsOneWidget);
      await expectLater(find.byType(UrgenceSuiviView), matchesGoldenFile('goldens/pro17_client_suivi.png'));
      await tester.tap(find.bySemanticsLabel('Appeler'));
      expect(liens.single.toString(), 'tel:0612345678');
    });

    testWidgets('recherche puis aucun artisan : relancer', (tester) async {
      final actions = <String>[];
      await _ecran(tester, UrgenceSuiviView(urgence: {..._urgence('sans_artisan'), 'artisan': null}, onAgir: actions.add, onRetour: () {}));
      expect(find.text('Aucun artisan disponible'), findsOneWidget);
      await tester.tap(find.text('Relancer la recherche'));
      expect(actions, ['relancer']);
    });
  });
}
