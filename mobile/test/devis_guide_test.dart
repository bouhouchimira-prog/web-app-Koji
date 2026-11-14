import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart';
import 'package:koji/apps/entreprise/devis/pro_devis_guide_view.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/features/quote/model/devis_line.dart';

// Devis guidé (maquette PRO-03.1, 13 nov) : mêmes exemples que le site
// (tests/unit/devis-guide.test.js), la conversation avec un faux Koji, et
// les trois états du téléphone de la maquette.

final _lots = <Map<String, dynamic>>[
  {'nom': 'Dépose et préparation', 'code': 'Lot 01', 'lignes': [
    {'id': 'l1', 'designation': 'Déposer la baignoire et la robinetterie existantes', 'quantite': 1, 'unite': 'ens'}
  ]},
  {'nom': 'Plomberie', 'code': 'Lot 02', 'lignes': [
    {'id': 'l2', 'designation': 'Poser le receveur extra-plat 90 × 120, fourni', 'quantite': 1, 'unite': 'u'}
  ]},
  {'nom': 'Carrelage et faïence', 'code': 'Lot 03', 'lignes': <Map<String, dynamic>>[]},
];

DevisLine _l(String id, String label, double qty, String unite, double pu, {double temps = 0, double fourn = 0}) =>
    DevisLine(
      taskId: id,
      label: label,
      unite: unite,
      qty: qty,
      tempsHU: temps > 0 ? temps : pu / 55,
      tauxHoraire: 55,
      fournituresQty: fourn > 0 ? qty : 0,
      fournituresUnitPrice: fourn,
    );

// Le devis de la maquette : 4 lots, 9 lignes, 5 271,40 € HT.
DevisGuideDonnees _devisMaquette() {
  final lines = <String, List<DevisLine>>{
    'r1': [
      _l('ouvrage_1', 'Déposer la baignoire et la robinetterie existantes', 1, 'ens', 180),
      _l('ouvrage_2', 'Déposer le carrelage mural et au sol', 19.4, 'm²', 28),
      _l('ouvrage_3', 'Évacuer les gravats en décharge agréée', 1, 'ens', 260),
    ],
    'r2': [
      _l('ouvrage_4', "Créer l'alimentation et l'évacuation du receveur", 1, 'ens', 420),
      _l('ouvrage_5', 'Poser le receveur extra-plat 90 × 120, fourni', 1, 'u', 690),
      _l('ouvrage_6', 'Poser la colonne de douche thermostatique, fournie', 1, 'u', 540),
    ],
    'r3': [
      _l('ouvrage_7', 'Poser le carrelage au sol, grès cérame 60 × 60, fourni', 5.8, 'm²', 0, temps: 0.6, fourn: 62),
      _l('ouvrage_8', 'Poser la faïence murale toute hauteur, fournie', 19.4, 'm²', 88),
    ],
    'r4': [
      _l('ouvrage_9', "Créer le circuit salle d'eau, 2 points lumineux et 1 prise", 1, 'ens', 380),
    ],
  };
  var n = 100;
  return DevisGuideDonnees(
    linesByRoom: lines,
    roomOrder: ['r1', 'r2', 'r3', 'r4'],
    lotMeta: {
      'r1': {'title': 'Dépose et préparation'},
      'r2': {'title': 'Plomberie'},
      'r3': {'title': 'Carrelage et faïence'},
      'r4': {'title': 'Électricité'},
    },
    tauxHoraire: () => 55,
    nouvelId: (p) => '${p}_${n++}',
    nomPiece: (r) => r,
  );
}

double _total(DevisGuideDonnees d) =>
    d.linesByRoom.values.expand((x) => x).fold<double>(0, (s, l) => s + l.totalCompte);

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
  // Icônes Material du SDK, pour que les images de référence montrent les
  // vraies icônes (retour, recherche, photo, micro, envoi).
  final racine = Platform.environment['FLUTTER_ROOT'];
  final icones = File('$racine/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (racine != null && icones.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(icones.readAsBytes().then((b) => ByteData.view(b.buffer)))).load();
  }
}

void main() {
  setUpAll(_chargerDmSans);

  test('questions oui / non, réponses, Koji travaille, écart, premier message (règles du site)', () {
    expect(
      questionsOuiNon(['  Le sol est-il à ragréer après dépose ', "Faut-il une VMC ou une bouche d'extraction ?", 'le sol est-il à ragréer après dépose ?', '', 'Faut-il protéger les sols ?', 'Faut-il évacuer les gravats ?']),
      ['Le sol est-il à ragréer après dépose ?', "Faut-il une VMC ou une bouche d'extraction ?", 'Faut-il protéger les sols ?'],
    );
    final qs = ['Le sol est-il à ragréer après dépose ?', "Faut-il une VMC ou une bouche d'extraction ?"];
    expect(texteQuestions(qs), "Questions posées (oui / non) :\n- Le sol est-il à ragréer après dépose ?\n- Faut-il une VMC ou une bouche d'extraction ?");
    expect(toutesRepondues(qs, [true, null]), isFalse);
    expect(texteReponses(qs, [true, false]), "Le sol est-il à ragréer après dépose ? Oui\nFaut-il une VMC ou une bouche d'extraction ? Non");

    expect(
      koji({'subAction': 'addOuvrage', 'room': 'Dépose et préparation', 'quantity': 5.8, 'ouvrage': {'label': 'Ragréer le sol', 'unit': 'm²'}}, _lots),
      const KojiTravail('Koji ajoute « Ragréer le sol » au lot 01…', 'Koji ajoute · lot 01', 'Ragréer le sol, 5,8 m²'),
    );
    expect(
      koji({'subAction': 'addOuvrage', 'room': 'Ventilation', 'quantity': 1, 'ouvrage': {'label': "À chiffrer manuellement — Poser une bouche d'extraction", 'unit': 'u'}}, _lots)!.phrase,
      "Koji ajoute « Poser une bouche d'extraction » au lot « Ventilation »…",
    );
    expect(koji({'subAction': 'removeOuvrage', 'id': 'l2'}, _lots)!.phrase, 'Koji retire « Poser le receveur extra-plat 90 × 120, fourni »…');
    expect(koji({'subAction': 'addLot', 'lotName': 'Ventilation'}, _lots)!.phrase, 'Koji crée le lot « Ventilation »…');
    expect(koji({'subAction': 'askQuestions'}, _lots), isNull);

    expect(ecartTotal(5068.4, 5271.4), '+ 203,00');
    expect(ecartTotal(5271.4, 5271.4), '');
    expect(ecartTotal(551, 500.5), '− 50,50');
    expect(euros(5271.4), '5 271,40 €');

    expect(premierMessage({'lots': []}), 'Bonjour, décris-moi le chantier en quelques mots. Je prépare le devis pendant que tu parles.');
    expect(
      premierMessage({'lots': _lots, 'client': {'nom': 'Mme Lefèvre'}}),
      "J'ai repris le devis de Mme Lefèvre : dépose et préparation et plomberie, 2 lignes. Dis-moi ce qui change, ajoute un ouvrage ou pose une question.",
    );
  });

  test('Koji modifie le devis ouvert : lot, ouvrage, prix, suppression, résultat réel', () {
    final d = _devisMaquette();
    expect(_total(d), closeTo(5271.40, 0.001));
    final instant = d.instantane(client: {'nom': 'Mme Lefèvre'}, sousTotal: 5271.4, majorations: const [], totalHt: 5271.4, totalTtc: 5798.54);
    expect((instant['lots'] as List).map((l) => '${l['code']} ${l['nom']}'), ['Lot 01 Dépose et préparation', 'Lot 02 Plomberie', 'Lot 03 Carrelage et faïence', 'Lot 04 Électricité']);
    expect(((instant['lots'] as List)[2]['lignes'] as List).first, {
      'id': 'ouvrage_7', 'designation': 'Poser le carrelage au sol, grès cérame 60 × 60, fourni', 'quantite': 5.8, 'unite': 'm²',
      'prixUnitaireHt': 95.0, 'totalHt': 551.0, 'prixManquant': false, 'variante': false,
    });

    // Ouvrage de la bibliothèque (prix = temps × taux + fournitures).
    final c1 = d.appliquer({'subAction': 'addOuvrage', 'room': 'Dépose et préparation', 'quantity': 5.8,
      'ouvrage': {'matched': true, 'id': 'RAG', 'code': 'RAG', 'label': 'Ragréer le sol', 'unit': 'm²', 'normativeTime': 0.5, 'hourlyRate': 55, 'suppliesCost': 7.5}})!;
    expect(c1['tool'], 'ajouter_ouvrage');
    final (lot, rag) = d.ligne(c1['lineId'] as String)!;
    expect(lot, 'r1');
    expect(rag.totalLigne, closeTo(5.8 * 35, 0.001));
    expect(ecartTotal(5271.4, _total(d)), '+ 203,00');

    // Sans correspondance : 0 €, puis le prix donné par l'entreprise.
    final c2 = d.appliquer({'subAction': 'addOuvrage', 'room': 'Ventilation', 'quantity': 1, 'ouvrage': {'matched': false, 'label': "À chiffrer manuellement — Poser une bouche d'extraction", 'unit': 'u'}})!;
    final (lotV, bouche) = d.ligne(c2['lineId'] as String)!;
    expect(d.titreLot(lotV), 'Ventilation');
    expect(d.codeLot(lotV), 'Lot 05');
    expect(bouche.label, "Poser une bouche d'extraction");
    expect(bouche.totalLigne, 0);
    d.appliquer({'subAction': 'setManualPrice', 'amountHt': 145});
    expect(bouche.totalLigne, 145);

    // Prix unitaire corrigé : la main-d'œuvre s'ajuste, les fournitures restent.
    d.appliquer({'subAction': 'updateOuvrage', 'id': 'ouvrage_7', 'quantite': 6, 'prixUnitaireHt': 100});
    final carrelage = d.ligne('ouvrage_7')!.$2;
    expect(DevisGuideDonnees.prixUnitaire(carrelage), closeTo(100, 0.001));
    expect(carrelage.totalLigne, closeTo(600, 0.001));

    final c3 = d.appliquer({'subAction': 'removeOuvrage', 'id': 'ouvrage_3'})!;
    expect(d.ligne('ouvrage_3'), isNull);
    expect(c3, {'tool': 'supprimer_ouvrage', 'lineId': 'ouvrage_3', 'removed': true});

    var client = <String, dynamic>{};
    d.appliquer({'subAction': 'setClientInfo', 'client': {'nom': 'Mme Lefèvre', 'chantier': '12 rue Exemple, 75010 Paris'}}, onClient: (c) => client = c);
    expect(client['chantier'], '12 rue Exemple, 75010 Paris');

    expect(d.resultat(c1, (ok: true, devisId: 'q41', le: '2026-11-13T19:42:00Z', erreur: '')), {
      'action': 'ajouter_ouvrage', 'devisId': 'q41', 'enregistreLe': '2026-11-13T19:42:00Z', 'success': true,
      'id': rag.taskId, 'lot': 'Dépose et préparation', 'designation': 'Ragréer le sol', 'quantite': 5.8, 'unite': 'm²',
      'prixUnitaireHt': 35.0, 'totalHt': 203.0, 'prixManquant': false,
    });
    expect(d.resultat(c1, (ok: false, devisId: '', le: '', erreur: 'Hors ligne'))['success'], isFalse);
  });

  test('flux SSE découpé en événements', () async {
    final morceaux = Stream.fromIterable([
      'event: delta\ndata: {"text":"C\'est no',
      'té"}\n\nevent: action\r\ndata: {"subAction":"askQuestions","questions":["A ?"]}\n\n',
      'event: done\ndata: {"finished":false,"message":"C\'est noté"}\n\n',
    ]);
    final evenements = await tramesSse(morceaux).toList();
    expect(evenements.map((e) => e.$1), ['delta', 'action', 'done']);
    expect(evenements.first.$2['text'], "C'est noté");
  });

  test('conversation : questions oui / non, ajout, enregistrement puis confirmation', () async {
    final d = _devisMaquette();
    final corps = <Map<String, dynamic>>[];
    var enregistrements = 0;
    Stream<(String, Map<String, dynamic>)> flux(Map<String, dynamic> c) {
      corps.add(jsonDecode(jsonEncode(c)) as Map<String, dynamic>);
      return Stream.fromIterable(switch (corps.length) {
        1 => [
            ('delta', {'text': "C'est noté."}),
            ('action', {'subAction': 'askQuestions', 'questions': ['Le sol est-il à ragréer après dépose ?', "Faut-il une VMC ou une bouche d'extraction ?"]}),
            ('done', {'finished': false, 'message': "C'est noté. Deux questions pour ne rien oublier :"}),
          ],
        2 => [
            ('action', {'subAction': 'addOuvrage', 'room': 'Dépose et préparation', 'quantity': 5.8,
              'ouvrage': {'matched': true, 'label': 'Ragréer le sol', 'unit': 'm²', 'normativeTime': 0.5, 'hourlyRate': 55, 'suppliesCost': 7.5}}),
            ('done', {'finished': false, 'message': 'Je vais ajouter le ragréage au lot 01.'}),
          ],
        _ => [
            ('done', {'finished': false, 'message': "C'est enregistré : « Ragréer le sol », 5,8 m², lot 01."}),
          ],
      });
    }

    final c = DevisGuideConversation(
      flux: flux,
      instantane: () => d.instantane(client: const {'nom': 'Mme Lefèvre'}, sousTotal: _total(d), majorations: const [], totalHt: _total(d), totalTtc: _total(d) * 1.1),
      appliquer: d.appliquer,
      enregistrer: () async {
        enregistrements++;
        return (id: 'q41', le: '2026-11-13T19:42:00Z');
      },
      resultat: d.resultat,
      conversationId: 'devischat-test',
    );
    c.accueillir();
    expect(c.tours.single.text, startsWith("J'ai repris le devis de Mme Lefèvre : dépose et préparation, plomberie, carrelage et faïence et électricité, 9 lignes."));

    await c.envoyer("Le receveur c'est un 90 × 120 extra-plat", photo: 'data:image/jpeg;base64,AAAA');
    expect(c.tours.last.questions, hasLength(2));
    expect((corps[0]['turns'] as List).last, {'role': 'user', 'text': "Le receveur c'est un 90 × 120 extra-plat", 'photo': 'data:image/jpeg;base64,AAAA'});

    final index = c.tours.length - 1;
    await c.repondre(index, 0, true);
    expect(corps, hasLength(1), reason: 'la réponse part quand toutes les questions ont la leur');
    await c.repondre(index, 1, false);

    expect(corps, hasLength(3));
    final tours2 = corps[1]['turns'] as List;
    expect(tours2[1]['photo'], isTrue, reason: 'les anciennes photos ne repartent pas');
    expect(tours2[2]['questions'], hasLength(2));
    expect(tours2.last['text'], "Le sol est-il à ragréer après dépose ? Oui\nFaut-il une VMC ou une bouche d'extraction ? Non");
    expect(enregistrements, 1);
    final resultat = (corps[2]['turns'] as List).last;
    expect(resultat['hidden'], isTrue);
    expect(resultat['text'], startsWith('[RESULTAT_ECRITURE] [{"action":"ajouter_ouvrage","devisId":"q41"'));
    expect(c.tours.where((t) => !t.hidden && !t.chips).last.text, "C'est enregistré : « Ragréer le sol », 5,8 m², lot 01.");
    expect(c.envoi, isFalse);
    expect(c.notice, 'Devis enregistré.');
    expect(ecartTotal(c.totalDebut!, _total(d)), '+ 203,00');
    expect(c.verrouille(index), isTrue);
  });

  group('écran du devis guidé (maquette, téléphone)', () {
    Future<void> monter(WidgetTester tester, Widget vue) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
        home: vue,
      ));
      await tester.pump();
    }

    (DevisGuideDonnees, DevisGuideConversation) etat() {
      final d = _devisMaquette();
      final c = DevisGuideConversation(
        flux: (_) => const Stream.empty(),
        instantane: () => d.instantane(client: const {'nom': 'Mme Lefèvre'}, sousTotal: _total(d), majorations: const [], totalHt: _total(d), totalTtc: _total(d) * 1.1),
        appliquer: d.appliquer,
        enregistrer: () async => (id: 'q41', le: ''),
        resultat: d.resultat,
      );
      c.tours.addAll([
        GuideTour('assistant',
            "J'ai préparé le devis à partir du projet de Mme Lefèvre : salle de bain de 5,8 m², Paris 10e. J'ai repris la dépose, la plomberie, le carrelage et l'électricité depuis ta bibliothèque."),
        GuideTour('user', "Le receveur c'est un 90 × 120 extra-plat, et faïence toute hauteur"),
        GuideTour('assistant', "C'est noté : receveur 90 × 120 extra-plat (lot 02) et faïence toute hauteur, 19,4 m² (lot 03). Deux questions pour ne rien oublier :",
            questions: ['Le sol est-il à ragréer après dépose ?', "Faut-il une VMC ou une bouche d'extraction ?"]),
        GuideTour('user', 'Oui pour le ragréage, pas de VMC'),
      ]);
      return (d, c);
    }

    Widget vue(DevisGuideDonnees d, DevisGuideConversation c, {bool feuille = false, String? ligne, List<String>? journal}) =>
        ProDevisGuideView(
          titre: 'Devis 2026-041',
          sousTitre: 'Salle de bain · Mme Lefèvre',
          conversation: c,
          donnees: d,
          totalHt: 5271.40,
          totalTtc: 5798.54,
          onRetour: () => journal?.add('retour'),
          onEnvoyer: () => journal?.add('envoyer'),
          onChange: () => journal?.add('change'),
          onAjouterOuvrage: (r) async => journal?.add('ouvrage $r'),
          onAjouterFourniture: (r, {parentTaskId = ''}) async => journal?.add('fourniture $r $parentTaskId'),
          onAjouterLot: () async => journal?.add('lot'),
          onSupprimer: (r, l) {
            d.linesByRoom[r]!.remove(l);
            journal?.add('supprimer ${l.taskId}');
          },
          onEditionDetaillee: () => journal?.add('détail'),
          feuilleOuverte: feuille,
          ligneOuverte: ligne,
        );

    testWidgets('1 · Koji travaille, bandeau en direct', (tester) async {
      final (d, c) = etat();
      c
        ..envoi = true
        ..travail = koji({'subAction': 'addOuvrage', 'room': 'Dépose et préparation', 'quantity': 5.8, 'ouvrage': {'label': 'Ragréer le sol', 'unit': 'm²'}},
            [for (final l in c.instantane()['lots'] as List) Map<String, dynamic>.from(l as Map)])
        ..totalDebut = 5068.40;
      await monter(tester, vue(d, c));
      expect(find.text('Koji ajoute « Ragréer le sol » au lot 01…'), findsOneWidget);
      expect(find.text('KOJI AJOUTE · LOT 01'), findsOneWidget);
      expect(find.text('Ragréer le sol, 5,8 m²'), findsOneWidget);
      expect(find.text('5 271,40 €'), findsWidgets);
      expect(find.text('+ 203,00'), findsOneWidget);
      await expectLater(find.byType(ProDevisGuideView), matchesGoldenFile('goldens/pro_devis_guide_1_koji.png'));
    });

    testWidgets('2 · devis ouvert, Ajouter ; 3 · ligne touchée', (tester) async {
      final (d, c) = etat();
      final journal = <String>[];
      await monter(tester, vue(d, c, feuille: true, journal: journal));
      expect(find.text('LOT 03'), findsOneWidget);
      expect(find.text('551,00 €'), findsOneWidget);
      expect(find.text('Total TTC'), findsOneWidget);
      expect(find.text('Ligne libre'), findsOneWidget);
      await expectLater(find.byType(ProDevisGuideView), matchesGoldenFile('goldens/pro_devis_guide_2_devis.png'));

      await tester.tap(find.text('Poser le carrelage au sol, grès cérame 60 × 60, fourni'));
      await tester.pump();
      expect(find.text('Lot 03 · 95,00 €/m² · 551,00 € HT'), findsOneWidget);
      expect(find.text('FOURNITURES · 62,00 €/M²'), findsOneWidget);
      await expectLater(find.byType(ProDevisGuideView), matchesGoldenFile('goldens/pro_devis_guide_3_ligne.png'));

      await tester.enterText(find.widgetWithText(TextField, '5,8'), '6');
      await tester.pump();
      expect(d.ligne('ouvrage_7')!.$2.qty, 6);
      expect(find.text('Lot 03 · 95,00 €/m² · 570,00 € HT'), findsOneWidget);
      await tester.tap(find.text('Variante'));
      await tester.pump();
      expect(d.ligne('ouvrage_7')!.$2.isVariante, isTrue);
      await tester.tap(find.text('Valider'));
      await tester.pump();
      expect(find.textContaining('Variante', findRichText: true), findsOneWidget, reason: 'étiquette de la ligne dans le devis');
      expect(journal.where((x) => x == 'change'), isNotEmpty);

      await tester.tap(find.text('Ouvrage'));
      await tester.pumpAndSettle();
      expect(find.text('Dans quel lot ?'), findsOneWidget);
      await tester.tap(find.text('Lot 03 · Carrelage et faïence'));
      await tester.pumpAndSettle();
      expect(journal, contains('ouvrage r3'));
    });

    testWidgets('questions oui / non et envoi', (tester) async {
      final d = _devisMaquette();
      final corps = <Map<String, dynamic>>[];
      final c = DevisGuideConversation(
        flux: (x) {
          corps.add(x);
          return Stream.fromIterable(corps.length == 1
              ? [
                  ('action', {'subAction': 'askQuestions', 'questions': ['Le sol est-il à ragréer après dépose ?']}),
                  ('done', {'finished': false, 'message': 'Une question :'}),
                ]
              : [
                  ('done', {'finished': false, 'message': "D'accord, pas de ragréage."}),
                ]);
        },
        instantane: () => d.instantane(client: const {}, sousTotal: _total(d), majorations: const [], totalHt: _total(d), totalTtc: _total(d)),
        appliquer: d.appliquer,
        enregistrer: () async => (id: 'q41', le: ''),
        resultat: d.resultat,
      );
      c.accueillir();
      await monter(tester, vue(d, c));
      await tester.enterText(find.byType(TextField), 'Faïence toute hauteur');
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('Envoyer le message'));
      await tester.pumpAndSettle();
      expect(find.text('Le sol est-il à ragréer après dépose ?'), findsOneWidget);
      await tester.tap(find.text('Non'));
      await tester.pumpAndSettle();
      expect(corps.last['turns'].last['text'], 'Le sol est-il à ragréer après dépose ? Non');
      expect(find.text("D'accord, pas de ragréage."), findsOneWidget);
    });
  });
}
