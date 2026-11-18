import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/client_signature_pad.dart';
import 'package:koji/apps/client/screens/client_devis_chantier_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// Koji Client · « signer, suivre, payer » (maquette CLI-02) : la page d'un
// devis ou chantier du site. Réponses de /api/client/chantier/{id}
// simulées (forme de lib/chantier-client.js), rien ne part sur le réseau.

Map<String, dynamic> _devis({bool aSigner = true, bool mentionTva = true}) => {
      'etat': aSigner ? 'a_signer' : 'signe',
      'titreEcran': aSigner ? 'Devis à signer' : 'Devis signé',
      'numero': '2026-041',
      'version': 2,
      'titre': 'Devis 2026-041 · version 2',
      'date': '30 oct. 2026',
      'validite': aSigner ? "valable jusqu'au 29 nov." : '',
      'objet': 'Salle de bain · 12 rue des Vinaigriers, Paris 10e · logement de plus de 2 ans',
      'entreprise': {
        'nom': 'ABL Expert Renov',
        'detail': 'SAS · SIREN 812 345 678 · décennale Assureur, valable jusqu\'au 31 déc. 2026',
        'decennale': 'Assureur',
        'decennaleJusqua': '2026-12-31',
      },
      'lignes': [
        {'cle': 'a', 'libelle': "Dépose de l'existant et évacuation", 'lot': 'Salle de bain', 'quantite': '1', 'montantHt': '620,00 €', 'note': ''},
        {'cle': 'b', 'libelle': 'Plomberie : alimentation et évacuation du receveur', 'lot': 'Salle de bain', 'quantite': '1', 'montantHt': '980,00 €', 'note': ''},
        {'cle': 'c', 'libelle': 'Peinture plafond et porte', 'lot': 'Couloir', 'quantite': '1', 'montantHt': '211,40 €', 'note': 'variante, hors total'},
      ],
      'totaux': [
        {'libelle': 'Total HT', 'montant': '5 271,40 €'},
        {'libelle': 'TVA 10 % · logement de plus de 2 ans', 'montant': '527,14 €'},
        {'libelle': 'Total TTC', 'montant': '5 798,54 €', 'fort': true},
      ],
      'totalTtc': '5 798,54 €',
      'changements': {
        'texte': 'Ce qui change depuis la version 1 : − 236,28 € TTC, Meuble vasque modifié',
        'lignes': [
          {'type': 'Modifié', 'libelle': 'Meuble vasque', 'ecart': '− 236,28 €'},
        ],
        'avant': {'titre': 'Version 1', 'total': '6 034,82 €', 'lignes': []},
        'note': 'La version précédente reste consultable mais ne peut plus être signée.',
      },
      'acompte': {
        'titre': 'À régler à la signature',
        'montant': '1 739,56 €',
        'pourcent': '30 %',
        'detail': 'acompte 30 % · le reste en 2 fois (situation, solde)',
      },
      'signeLe': aSigner ? '' : '3 nov. 2026 à 09:12',
      'signataire': aSigner ? '' : 'S. Lefèvre',
      'retractation': aSigner
          ? null
          : {'etat': 'ouvert', 'fin': '2026-11-17', 'texte': "Vous pouvez annuler sans motif jusqu'au 17 novembre inclus, avec le formulaire joint au devis signé."},
      'pdf': '/api/client/quotes/q_41/pdf',
      'signature': aSigner
          ? {
              'retractation': 'Vous pourrez annuler sans motif pendant 14 jours après la signature.',
              'finRetractation': '2026-12-02',
              'mentionTva': mentionTva
                  ? {'libelle': "Logement de plus de 2 ans, à usage d'habitation (TVA 10 %)", 'texte': ''}
                  : null,
              'demarrage': {'libelle': 'Je demande que les travaux commencent le 12 novembre, avant la fin du délai', 'date': '2026-11-12'},
              'acceptation': "J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis.",
              'preuve': 'Horodatage, adresse de connexion, appareil et exemplaire PDF conservés par Koji comme preuve de signature.',
            }
          : null,
    };

Map<String, dynamic> _paiements() => {
      'lignes': [
        {'id': 'f1', 'titre': "Facture d'acompte KJ-2026-118", 'etat': 'paye', 'detail': 'payée le 9 nov.', 'montant': '1 739,56 €', 'pdf': '/api/client/factures/f1/pdf'},
        {'id': 'f2', 'titre': 'Facture intermédiaire KJ-2026-125', 'etat': 'a_payer', 'detail': 'à payer avant le 20 déc.', 'montant': '2 515,00 €', 'pdf': '/api/client/factures/f2/pdf'},
        {'id': 'a-venir', 'titre': 'Reste à facturer', 'etat': 'a_venir', 'detail': "situations et solde, selon l'avancement", 'montant': '1 543,98 €', 'pdf': null},
      ],
      'aPayer': {
        'titre': 'À payer avant le 20 décembre',
        'montant': '2 515,00 €',
        'detail': 'Facture intermédiaire KJ-2026-125',
        'pdf': '/api/client/factures/f2/pdf',
        'factureId': 'f2',
      },
      'retenue': '',
      'vide': '',
      'note': 'Réglez par virement avec les coordonnées indiquées sur la facture. Koji ne reçoit pas les paiements.',
    };

Map<String, dynamic> _vue({bool aSigner = true, bool mentionTva = true}) => {
      'id': 'q_41',
      'titre': 'Salle de bain, Paris 10e',
      'entreprise': 'ABL Expert Renov',
      'surTitre': 'Salle de bain, Paris 10e · ABL Expert Renov',
      'etat': aSigner ? 'a_signer' : 'signe',
      'ongletParDefaut': aSigner ? 'devis' : 'chantier',
      'projectId': 'p_7',
      'finChantier': null,
      'devis': _devis(aSigner: aSigner, mentionTva: mentionTva),
      'chantier': aSigner
          ? null
          : {
              'titre': 'Votre chantier · jour 6 sur 18',
              'etat': 'en_cours',
              'avancement': {'pourcent': 35, 'texte': '2 étapes terminées sur 4 · Carrelage et faïence en cours · fin prévue le 4 décembre'},
              'etapes': [
                {'titre': 'Dépose', 'etat': 'fait', 'detail': 'terminé le 14 nov.'},
                {'titre': 'Plomberie', 'etat': 'fait', 'detail': 'terminé le 17 nov.'},
                {'titre': 'Carrelage et faïence', 'etat': 'en_cours', 'detail': 'en cours · Rui C.'},
                {'titre': 'Meuble, robinetterie, finitions', 'etat': 'a_venir', 'detail': 'à partir du 26 nov.'},
                {'titre': 'Réception', 'etat': 'a_venir', 'detail': '4 décembre · vous signez le procès-verbal'},
              ],
              'prochaine': {'titre': 'Prochaine étape', 'texte': 'Meuble vasque · à partir du 26 novembre'},
              'photo': null,
              'taches': [],
              'signaler': {'mode': 'alerte', 'sousTitre': "message à l'entreprise, sur un ouvrage ou tout le chantier · elle vous répond"},
              'receptionLe': '',
              'note': "Seules les informations partagées par l'entreprise apparaissent ici ; ses photos de travail restent chez elle.",
            },
      'paiements': aSigner
          ? {'lignes': [], 'aPayer': null, 'retenue': '', 'vide': 'Les factures arrivent ici après la signature du devis.', 'note': 'Réglez par virement.'}
          : _paiements(),
      'documents': {
        'liste': [
          {'id': 'devis', 'titre': 'Devis signé, version 2', 'detail': '3 nov. · 5 798,54 € TTC · preuve de signature', 'lien': '/api/client/quotes/q_41/pdf'},
          {'id': 'decennale', 'titre': 'Attestation décennale', 'detail': 'ABL Expert Renov · Assureur', 'lien': '/api/client/chantier/q_41/decennale'},
          {'id': 'pv', 'titre': 'Procès-verbal de réception', 'detail': "signé avec l'entreprise à la fin des travaux", 'lien': null},
        ],
        'note': "Tout reste téléchargeable ici après la fin du chantier. L'entreprise conserve aussi ses factures pendant la durée légale.",
      },
      'contact': {'lien': '/client/radar/radar-17?entreprise=u1', 'externe': false, 'sousTitre': 'ABL Expert Renov · conversation de votre demande'},
    };

class _Fichiers {
  final ouverts = <String>[];
}

Widget _app(
  DepotSimule depot, {
  String chemin = '/client/devis/q_41',
  bool connecte = true,
  _Fichiers? fichiers,
}) {
  Widget arrivee(GoRouterState s) => Scaffold(body: Text('→ ${s.uri}'));
  final router = GoRouter(
    initialLocation: chemin,
    routes: [
      GoRoute(
        path: '/client/devis/:quoteId',
        builder: (_, s) => ClientDevisChantierScreen(
          quoteId: s.pathParameters['quoteId']!,
          onglet: s.uri.queryParameters['onglet'],
        ),
      ),
      for (final c in ['/client/messages', '/client/marketplace/login', '/client-home', '/client/paiements'])
        GoRoute(path: c, builder: (_, s) => arrivee(s)),
    ],
  );
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(connecte ? ApiConnectee() : ApiDeconnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
      clientOuvrirFichierProvider.overrideWithValue((chemin, titre) async {
        fichiers?.ouverts.add('$chemin|$titre');
      }),
    ],
    child: MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      routerConfig: router,
    ),
  );
}

ClBouton _bouton(WidgetTester tester, String texte) =>
    tester.widget<ClBouton>(find.widgetWithText(ClBouton, texte));

Future<void> _signer(WidgetTester tester) async {
  final pave = find.byType(ClPaveSignature);
  await tester.ensureVisible(pave);
  await tester.pumpAndSettle();
  await tester.dragFrom(tester.getCenter(pave) - const Offset(80, 10), const Offset(160, 20));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('devis à signer : textes du site, cases non cochées, bouton inactif',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(chantier: _vue());
    await tester.pumpWidget(_app(depot));
    await tester.pumpAndSettle();

    expect(depot.appels, ['chantier:q_41']);
    expect(find.text('Devis à signer'), findsOneWidget);
    expect(find.text('ABL Expert Renov · version 2'), findsOneWidget);
    for (final onglet in ['Devis', 'Chantier', 'Paiements', 'Documents']) {
      expect(find.text(onglet), findsOneWidget, reason: onglet);
    }
    expect(find.text('5 798,54 € TTC'), findsOneWidget);
    expect(find.textContaining('acompte 30 % : 1 739,56 €'), findsOneWidget);
    expect(find.text('ce qui change depuis la version 1'), findsOneWidget);
    expect(find.text('Vous pourrez annuler sans motif pendant 14 jours après la signature.'), findsOneWidget);
    // Aucune case cochée d'avance.
    final cases = tester.widgetList<ClCase>(find.byType(ClCase)).toList();
    expect(cases, hasLength(3));
    expect(cases.every((c) => !c.cochee), isTrue);
    // Un seul bouton marine, inactif tant que rien n'est rempli.
    expect(_bouton(tester, 'Signer le devis').onPressed, isNull);
    final pleins = tester.widgetList<ClBouton>(find.byType(ClBouton)).where((b) => !b.secondaire && !b.contour);
    expect(pleins, hasLength(1));
    expect(_bouton(tester, "Poser une question à l'entreprise").secondaire, isTrue);
    // Pendant la signature, pas de barre du bas (maquette).
    expect(find.byType(ClientBottomBar), findsNothing);
    // Ni paiement en ligne, ni prix Koji.
    expect(find.textContaining('Payer'), findsNothing);
    expect(find.textContaining('recommandé'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('le détail du devis : lignes par lot, totaux, ce qui change, entreprise',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue())));
    await tester.pumpAndSettle();

    expect(find.text('Plomberie : alimentation et évacuation du receveur'), findsNothing);
    await tester.tap(find.text('ce qui change depuis la version 1'));
    await tester.pumpAndSettle();
    expect(find.text('Masquer le détail du devis'), findsOneWidget);
    for (final texte in [
      'Salle de bain',
      'Couloir',
      'Plomberie : alimentation et évacuation du receveur',
      '980,00 €',
      'variante, hors total',
      'Total HT',
      'TVA 10 % · logement de plus de 2 ans',
      'Total TTC',
      'Ce qui change depuis la version 1 : − 236,28 € TTC, Meuble vasque modifié',
      '− 236,28 € TTC',
      'Version 1',
      'SAS · SIREN 812 345 678 · décennale Assureur, valable jusqu\'au 31 déc. 2026',
    ]) {
      expect(find.text(texte, findRichText: true), findsWidgets, reason: texte);
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('la mention TVA est exigée ; tout rempli, le bouton signe en PNG',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(
      chantier: _vue(),
      reponseSignature: {'ok': true, 'exemplaire': {'envoye': true}, 'vue': _vue(aSigner: false)},
    );
    await tester.pumpWidget(_app(depot));
    await tester.pumpAndSettle();

    await tester.tap(find.text("J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis."));
    await _signer(tester);
    expect(tester.widget<ClPaveSignature>(find.byType(ClPaveSignature)).controleur.vide, isFalse);
    // Sans la mention TVA, toujours inactif.
    expect(_bouton(tester, 'Signer le devis').onPressed, isNull);

    await tester.ensureVisible(find.text("Logement de plus de 2 ans, à usage d'habitation (TVA 10 %)"));
    await tester.tap(find.text("Logement de plus de 2 ans, à usage d'habitation (TVA 10 %)"));
    await tester.pumpAndSettle();
    expect(_bouton(tester, 'Signer le devis').onPressed, isNotNull);

    await tester.ensureVisible(find.widgetWithText(ClBouton, 'Signer le devis'));
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ClBouton, 'Signer le devis'));
      for (var i = 0; i < 20 && depot.signatureEnvoyee == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    });
    await tester.pumpAndSettle();

    final envoye = depot.signatureEnvoyee!;
    expect(envoye['consent'], isTrue);
    expect(envoye['mentionTva'], isTrue);
    // Démarrage anticipé non demandé : la case est restée vide.
    expect(envoye['demandeExpresse'], isFalse);
    final image = envoye['signature'] as String;
    expect(image, startsWith('data:image/png;base64,'));
    expect(image.length, inInclusiveRange(200, 400000));
    expect(depot.appels, contains('signer:q_41'));

    // La vue renvoyée remplace la page : devis signé, onglet Devis gardé.
    expect(find.text('Devis signé'), findsOneWidget);
    expect(find.text("Merci, c'est signé. Votre exemplaire part par e-mail."), findsOneWidget);
    expect(find.text('Télécharger le devis signé'), findsOneWidget);
    expect(find.byType(ClPaveSignature), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sans mention TVA attendue : accord et signature suffisent ; erreur du site affichée',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(
      chantier: _vue(mentionTva: false),
      erreurEnvoi: KojiWebApiException(409, "Ce devis n'est pas à signer."),
    );
    await tester.pumpWidget(_app(depot));
    await tester.pumpAndSettle();

    expect(find.byType(ClCase), findsNWidgets(2));
    await tester.tap(find.text("J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis."));
    await _signer(tester);
    expect(_bouton(tester, 'Signer le devis').onPressed, isNotNull);

    // « Effacer » vide le cadre et désactive le bouton.
    await tester.tap(find.text('Effacer'));
    await tester.pumpAndSettle();
    expect(_bouton(tester, 'Signer le devis').onPressed, isNull);
    await _signer(tester);

    await tester.ensureVisible(find.widgetWithText(ClBouton, 'Signer le devis'));
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ClBouton, 'Signer le devis'));
      for (var i = 0; i < 20 && depot.signatureEnvoyee == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    });
    await tester.pumpAndSettle();
    expect(find.text("Ce devis n'est pas à signer."), findsOneWidget);
    expect(find.text('Devis à signer'), findsOneWidget);
  });

  testWidgets('chantier : avancement, étapes, signaler et écrire à l\'entreprise',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(chantier: _vue(aSigner: false));
    await tester.pumpWidget(_app(depot));
    await tester.pumpAndSettle();

    // Onglet par défaut du site : Chantier.
    expect(find.text('Votre chantier'), findsOneWidget);
    expect(find.text('Salle de bain, Paris 10e · jour 6 sur 18'), findsOneWidget);
    expect(find.textContaining('2 étapes terminées sur 4'), findsOneWidget);
    expect(find.text('Prochaine étape'), findsOneWidget);
    expect(find.text('Réception'), findsOneWidget);
    expect(find.text('4 décembre · vous signez le procès-verbal'), findsOneWidget);
    // Barre du bas, Projets allumé ; pas de photo inventée.
    expect(find.byType(ClientBottomBar), findsOneWidget);
    expect(find.byType(Image), findsNothing);

    await tester.tap(find.text('Signaler quelque chose'));
    await tester.pumpAndSettle();
    expect(_bouton(tester, 'Envoyer').onPressed, isNull);
    await tester.enterText(find.byType(TextField), 'Joint de la douche abîmé');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ClBouton, 'Envoyer'));
    await tester.pumpAndSettle();
    expect(depot.appels, contains('alerte:q_41:p_7:Joint de la douche abîmé'));
    expect(find.textContaining("C'est envoyé : ABL Expert Renov est prévenue"), findsOneWidget);
    await tester.tap(find.text('Fermer'));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Écrire à l'entreprise"));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/messages?fil=radar-17%3Au1'), findsOneWidget);
  });

  testWidgets('paiements : lignes, facture à télécharger, aucun « Payer »',
      (tester) async {
    cadreTelephone(tester);
    final fichiers = _Fichiers();
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue(aSigner: false)),
        chemin: '/client/devis/q_41?onglet=paiements', fichiers: fichiers));
    await tester.pumpAndSettle();

    expect(find.text('Paiements'), findsNWidgets(3)); // barre, onglet, barre du bas
    expect(find.text("Facture d'acompte KJ-2026-118"), findsOneWidget);
    expect(find.text('Reste à facturer'), findsOneWidget);
    expect(find.text('À payer avant le 20 décembre'), findsOneWidget);
    expect(find.textContaining('Payer'), findsNothing);
    final due = tester.widget<ClLignePaiement>(find.widgetWithText(ClLignePaiement, 'Facture intermédiaire KJ-2026-125'));
    expect(due.due, isTrue);
    // La ligne « à venir » n'a pas de facture.
    expect(tester.widget<ClLignePaiement>(find.widgetWithText(ClLignePaiement, 'Reste à facturer')).onFacture, isNull);

    await tester.tap(find.text('Télécharger la facture'));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Facture d'acompte KJ-2026-118"));
    await tester.pumpAndSettle();
    expect(fichiers.ouverts, [
      '/api/client/factures/f2/pdf|Facture intermédiaire KJ-2026-125',
      "/api/client/factures/f1/pdf|Facture d'acompte KJ-2026-118",
    ]);
  });

  testWidgets('documents : chaque fichier s\'ouvre avec la session, sauf celui à venir',
      (tester) async {
    cadreTelephone(tester);
    final fichiers = _Fichiers();
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue(aSigner: false)), fichiers: fichiers));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Documents').first);
    await tester.pumpAndSettle();

    expect(find.text('Devis signé, version 2'), findsOneWidget);
    expect(find.textContaining('Tout reste téléchargeable'), findsOneWidget);
    await tester.tap(find.text('Devis signé, version 2'));
    await tester.tap(find.text('Attestation décennale'));
    await tester.tap(find.text('Procès-verbal de réception'));
    await tester.pumpAndSettle();
    expect(fichiers.ouverts, [
      '/api/client/quotes/q_41/pdf|Devis signé, version 2',
      '/api/client/chantier/q_41/decennale|Attestation décennale',
    ]);
  });

  testWidgets('sans session du site : vers « Retrouver mon projet »', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue()), connecte: false));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/login'), findsOneWidget);
  });

  testWidgets('devis introuvable (404) : message et retour aux projets', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(DepotSimule(erreurLecture: KojiWebApiException(404, 'Devis introuvable.'))));
    await tester.pumpAndSettle();
    expect(find.text('Devis introuvable'), findsOneWidget);
    expect(find.text("Ce devis n'existe pas, ou il n'est pas rattaché à votre compte."), findsOneWidget);
    await tester.tap(find.text('Retour à mes projets'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client-home'), findsOneWidget);
  });

  test('liens du site vers les pages de l\'app', () {
    expect(routeAppDuLienSite('/client/chantier/q_41'), '/client/devis/q_41');
    expect(routeAppDuLienSite('https://getkoji.io/client/chantier/q_41?onglet=paiements'),
        '/client/devis/q_41?onglet=paiements');
    expect(routeAppDuLienSite('/client/radar/radar-17?entreprise=u1'), '/client/messages?fil=radar-17%3Au1');
    expect(routeAppDuLienSite('/client/paiements'), '/client/paiements');
    expect(routeAppDuLienSite('https://exemple.com/client/chantier/q_41'), isNull);
    expect(routeAppDuLienSite('/signature/abc'), isNull);
  });

  testWidgets('image de référence : devis à signer', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue())));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientDevisChantierScreen), matchesGoldenFile('goldens/cli02_devis.png'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('image de référence : suivre le chantier', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(DepotSimule(chantier: _vue(aSigner: false))));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientDevisChantierScreen), matchesGoldenFile('goldens/cli02_chantier.png'));
    expect(tester.takeException(), isNull);
  });
}
