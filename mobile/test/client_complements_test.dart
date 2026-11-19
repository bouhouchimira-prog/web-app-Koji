import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_photos_chantier.dart';
import 'package:koji/apps/client/client_signature_pad.dart';
import 'package:koji/apps/client/screens/client_devis_chantier_screen.dart';
import 'package:koji/apps/client/screens/client_messages_inbox_screen.dart';
import 'package:koji/apps/client/screens/client_notifications_screen.dart';
import 'package:koji/apps/client/signature_lien/client_signature_lien_screen.dart';
import 'package:koji/apps/client/signature_lien/signature_lien_api.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// Koji Client · compléments (maquettes CLI-02, CLI-03, CLI-04, CLI-07) :
// photo « après » et galerie, rétractation depuis l'espace, détail des
// notifications, message traduit, signature par lien dans l'app. Réponses du
// site simulées, rien ne part sur le réseau.

final _maintenant = DateTime(2026, 11, 19, 10);

const _formulaire = [
  'Formulaire de rétractation',
  '(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)',
  "À l'attention de ABL Expert Renov, 3 rue X, Paris, contact@abl.fr :",
];

Map<String, dynamic> _devisSigne({Map<String, dynamic>? retractation}) => {
      'etat': 'signe',
      'titreEcran': 'Devis signé',
      'version': 2,
      'titre': 'Devis 2026-041 · version 2',
      'entreprise': {'nom': 'ABL Expert Renov', 'detail': ''},
      'lignes': [],
      'totaux': [],
      'totalTtc': '5 798,54 €',
      'changements': null,
      'acompte': null,
      'signeLe': '18 nov. 2026 à 09:12',
      'signataire': 'S. Lefèvre',
      'retractation': retractation ??
          {
            'etat': 'ouvert',
            'fin': '2026-12-02',
            'texte': "Vous pouvez annuler sans motif jusqu'au 2 décembre inclus, avec le formulaire joint au devis signé.",
            'jusquau': "Vous pouvez annuler sans motif jusqu'au 2 décembre inclus.",
            'formulaire': _formulaire,
          },
      'pdf': '/api/client/quotes/q1/pdf',
      'signature': null,
    };

const _photos = [
  {'id': 'p1', 'url': 'https://stockage.test/p1.jpg', 'lot': 'Dépose', 'date': '14/11', 'auteur': 'Mehdi B.', 'legende': '14/11 · Mehdi B.'},
  {'id': 'p2', 'url': 'https://stockage.test/p2.jpg', 'lot': 'Plomberie', 'date': '19/11', 'auteur': 'Rui C.', 'legende': '19/11 · Rui C.'},
];

Map<String, dynamic> _vue({Map<String, dynamic>? devis, String etat = 'signe'}) => {
      'id': 'q1',
      'titre': 'Salle de bain, Paris 10e',
      'entreprise': 'ABL Expert Renov',
      'etat': etat,
      'ongletParDefaut': 'devis',
      'projectId': 'p1',
      'devis': devis ?? _devisSigne(),
      'chantier': {
        'titre': 'Votre chantier · jour 6 sur 18',
        'etat': 'en_cours',
        'avancement': {'pourcent': 35, 'texte': 'Dépose et plomberie terminées · carrelage en cours'},
        'etapes': [],
        'prochaine': null,
        'photo': {'url': 'https://stockage.test/p2.jpg', 'legende': '19/11 · Rui C.', 'etiquette': 'Après', 'lot': 'Plomberie'},
        'photos': _photos,
        'taches': [],
        'signaler': null,
        'receptionLe': '',
        'note': '',
      },
      'paiements': {'lignes': [], 'aPayer': null, 'retenue': '', 'vide': '', 'note': ''},
      'documents': {
        'liste': [
          {'id': 'devis', 'titre': 'Devis signé, version 2', 'detail': '5 798,54 € TTC', 'lien': '/api/client/quotes/q1/pdf'},
          {'id': 'photos', 'type': 'photos', 'titre': 'Photos du chantier', 'detail': '2 photos après, par étape (2)', 'lien': null},
        ],
        'note': '',
      },
      'contact': null,
    };

/// Le dépôt simulé, avec la rétractation depuis l'espace.
class _Depot extends DepotSimule {
  _Depot({super.chantier, super.notifications, super.fils});

  Map<String, dynamic>? apresRetractation;

  @override
  Future<Map<String, dynamic>> retracterDevisClient(String quoteId) async {
    appels.add('retractation:$quoteId');
    return {'ok': true, 'vue': apresRetractation};
  }
}

Widget _app(Widget ecran, DepotSimule depot, {String chemin = '/'}) {
  final router = GoRouter(
    initialLocation: chemin,
    routes: [
      GoRoute(path: '/', builder: (_, __) => ecran),
      GoRoute(
        path: '/client/devis/:quoteId',
        builder: (_, s) => Scaffold(body: Text('→ ${s.uri}')),
      ),
      for (final c in ['/client/messages', '/client-home', '/client/marketplace/login', '/client/paiements'])
        GoRoute(path: c, builder: (_, s) => Scaffold(body: Text('→ ${s.uri}'))),
    ],
  );
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
      clientOuvrirFichierProvider.overrideWithValue((_, __) async {}),
    ],
    child: MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      routerConfig: router,
    ),
  );
}

/// L'API du lien de signature, simulée.
class _ApiLien extends SignatureLienApi {
  _ApiLien({this.lecture = const {}, this.invalide = false, this.expiree = false});

  Map<String, dynamic> lecture;
  bool invalide;
  bool expiree;
  final appels = <String>[];
  Map<String, dynamic>? signature;

  @override
  Future<String> connexion({required String identifiant, required String motDePasse}) async {
    appels.add('connexion:$identifiant');
    if (motDePasse != 'bon') throw KojiWebApiException(401, 'Identifiant ou mot de passe incorrect.');
    return 'sig-1';
  }

  @override
  Future<Map<String, dynamic>> lire(String jeton) async {
    appels.add('lire:$jeton');
    if (expiree) throw const SignatureSessionExpiree();
    if (invalide) throw const LienSignatureInvalide({'nom': 'ABL Expert Renov', 'email': 'contact@abl.fr'});
    return lecture;
  }

  @override
  Future<Map<String, dynamic>> signer(String jeton, Map<String, dynamic> corps) async {
    appels.add('signer:$jeton');
    signature = corps;
    return {
      'quote': {'id': 'q1'},
      'vue': _vueLien(signe: true),
      'exemplaire': {'envoye': true},
    };
  }

  @override
  Future<Uint8List> pdf(String jeton) async => Uint8List(0);
}

Map<String, dynamic> _vueLien({bool signe = false}) => {
      'devis': {
        'etat': signe ? 'signe' : 'a_signer',
        'titre': 'Devis 2026-041 · version 2',
        'entreprise': {'nom': 'ABL Expert Renov', 'detail': 'SAS · SIREN 812 345 678'},
        'lignes': [
          {'cle': 'a', 'libelle': 'Dépose', 'quantite': '1', 'montantHt': '620,00 €', 'note': ''},
        ],
        'totaux': [
          {'libelle': 'Total HT', 'montant': '5 271,40 €'},
          {'libelle': 'TVA 10 % · logement de plus de 2 ans', 'montant': '527,14 €'},
          {'libelle': 'Total TTC', 'montant': '5 798,54 €', 'fort': true},
        ],
        'totalTtc': '5 798,54 €',
        'acompte': {'detail': 'acompte 30 % · le reste en 2 fois', 'montant': '1 739,56 €', 'pourcent': '30 %'},
        'signeLe': signe ? '19 nov. 2026 à 09:12' : '',
        'retractation': null,
        'pdf': '/api/signatures/sig-1/pdf',
        'signature': signe
            ? null
            : {
                'retractation': 'Vous pourrez annuler sans motif pendant 14 jours.',
                'mentionTva': null,
                'demarrage': null,
                'acceptation': "J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis.",
                'preuve': 'Horodatage, adresse de connexion, appareil et exemplaire PDF conservés par Koji comme preuve de signature.',
              },
      },
      'nom': 'S. Lefèvre',
      'emailMasque': 's••••@••••.fr',
      'intro': 'Vous recevez ce devis par un lien envoyé par ABL Expert Renov.',
      'apres': signe
          ? {
              'texte': 'Signé le 19 nov. 2026 à 09:12. Votre exemplaire part à s••••@••••.fr.',
              'etapes': [
                {'titre': 'Acompte', 'texte': 'ABL Expert Renov vous envoie la facture d\'acompte.'},
                {'titre': 'Suivre le chantier', 'texte': 'avancement, factures et documents dans Koji Client.'},
              ],
            }
          : null,
      'contact': null,
    };

Widget _appLien(_ApiLien api, {String lien = ''}) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, __) => ClientSignatureLienScreen(lien: lien)),
      for (final c in ['/client-home', '/client/marketplace/login'])
        GoRoute(path: c, builder: (_, s) => Scaffold(body: Text('→ ${s.uri}'))),
    ],
  );
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(ApiDeconnectee()),
      signatureLienApiProvider.overrideWithValue(api),
    ],
    child: MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      routerConfig: router,
    ),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('chantier : la dernière photo « après », puis la galerie par étape dans Documents',
      (tester) async {
    cadreTelephone(tester);
    final depot = _Depot(chantier: _vue());
    await tester.pumpWidget(_app(const ClientDevisChantierScreen(quoteId: 'q1', onglet: 'chantier'), depot));
    await tester.pumpAndSettle();
    expect(find.byType(ClPhotoApres), findsOneWidget);
    expect(find.text('19/11 · Rui C.'), findsOneWidget);
    expect(find.text('APRÈS'), findsOneWidget);
    // Agrandie : l'étape et la légende.
    await tester.tap(find.byType(ClPhotoApres));
    await tester.pumpAndSettle();
    expect(find.text('Plomberie · 19/11 · Rui C.'), findsOneWidget);
    await tester.tap(find.text('Fermer'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Documents'));
    await tester.pumpAndSettle();
    expect(find.text('Photos du chantier'), findsOneWidget);
    expect(find.byType(ClGaleriePhotos), findsNothing);
    await tester.tap(find.text('Photos du chantier'));
    await tester.pumpAndSettle();
    expect(find.byType(ClGaleriePhotos), findsOneWidget);
    for (final etape in ['Dépose', 'Plomberie']) {
      expect(find.text(etape), findsOneWidget, reason: etape);
    }
    expect(find.byType(ClPhotoApres), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('rétractation depuis l\'onglet Devis : formulaire, confirmation, devis annulé',
      (tester) async {
    cadreTelephone(tester);
    final depot = _Depot(chantier: _vue())
      ..apresRetractation = _vue(
        etat: 'retracte',
        devis: {
          ..._devisSigne(retractation: {'etat': 'retracte', 'texte': 'Vous vous êtes rétracté le 19 novembre 2026 : le devis est annulé.'}),
          'etat': 'retracte',
          'titreEcran': 'Devis annulé',
        },
      );
    await tester.pumpWidget(_app(const ClientDevisChantierScreen(quoteId: 'q1', onglet: 'devis'), depot));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text("Je changerai d'avis : où est le formulaire ?"));
    await tester.tap(find.text("Je changerai d'avis : où est le formulaire ?"));
    await tester.pumpAndSettle();
    expect(find.text("Vous pouvez annuler sans motif jusqu'au 2 décembre inclus."), findsOneWidget);
    expect(find.text('Formulaire de rétractation'), findsOneWidget);
    // Action destructrice : en contour, jamais en marine plein.
    final retracter = tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Me rétracter'));
    expect(retracter.secondaire, isTrue);
    await tester.ensureVisible(find.text('Me rétracter'));
    await tester.tap(find.text('Me rétracter'));
    await tester.pumpAndSettle();
    expect(find.textContaining("Confirmez-vous l'annulation"), findsOneWidget);
    expect(depot.appels, isNot(contains('retractation:q1')));
    await tester.ensureVisible(find.text('Je me rétracte'));
    await tester.tap(find.text('Je me rétracte'));
    await tester.pumpAndSettle();
    expect(depot.appels, contains('retractation:q1'));
    expect(find.text('Devis annulé'), findsOneWidget);
    expect(find.text('Vous vous êtes rétracté le 19 novembre 2026 : le devis est annulé.'), findsOneWidget);
    expect(find.text('Me rétracter'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('notification « devis à signer » : objet, écart de version, rappel, action réelle',
      (tester) async {
    cadreTelephone(tester);
    final depot = _Depot(notifications: [
      {
        'id': 'n1',
        'type': 'devis.nouvelle_version',
        'accountType': 'particulier',
        'title': 'Nouvelle version du devis : version 2',
        'message': 'ABL Expert Renov · salle de bain, Paris 10e · 5 798,54 € TTC · version 2',
        'texte': 'ABL Expert Renov a mis à jour le devis : version 2, 5 798,54 € TTC. Vous pouvez comparer avec la version 1 avant de signer.',
        'entrepriseName': 'ABL Expert Renov',
        'quoteId': 'q1',
        'objet': {'titre': 'Devis 2026-041 · version 2', 'detail': '5 798,54 € TTC · TVA 10 % · acompte 30 % à la signature'},
        'ecart': {'titre': 'Ce qui change depuis la version 1', 'detail': '− 236,28 € · Meuble vasque modifié', 'lien': '/client/chantier/q1?onglet=devis'},
        'rappel': "Signer en ligne : vous gardez 14 jours pour changer d'avis (formulaire dans Documents).",
        'actionUrl': '/client/chantier/q1?onglet=devis',
        'actionLabel': 'Lire et signer',
        'read': false,
        'createdAt': '2026-11-19T09:12:00',
      },
    ]);
    await tester.pumpWidget(_app(ClientNotificationsScreen(maintenant: _maintenant), depot));
    await tester.pumpAndSettle();
    expect(find.text('Nouvelle version du devis : version 2'), findsOneWidget);
    await tester.tap(find.text('Nouvelle version du devis : version 2'));
    await tester.pumpAndSettle();
    expect(find.text('Nouvelle version'), findsOneWidget);
    expect(find.textContaining('Vous pouvez comparer avec la version 1'), findsOneWidget);
    expect(find.text('Devis 2026-041 · version 2'), findsOneWidget);
    expect(find.text('5 798,54 € TTC · TVA 10 % · acompte 30 % à la signature'), findsOneWidget);
    expect(find.text('Ce qui change depuis la version 1'), findsOneWidget);
    expect(find.textContaining('14 jours pour changer'), findsOneWidget);
    expect(find.textContaining('recommandé'), findsNothing);
    await tester.tap(find.text('Lire et signer'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/devis/q1?onglet=devis'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('message traduit : « traduit du portugais · voir l\'original », sans auteur inventé',
      (tester) async {
    cadreTelephone(tester);
    final depot = _Depot(fils: [
      {
        'offerId': 'radar-17',
        'entrepriseUserId': 'e1',
        'entrepriseSnapshot': {'raisonSociale': 'ABL Expert Renov'},
        'offre': {'description': 'Salle de bain', 'titre': 'Salle de bain, Paris 10e'},
        'unread': false,
        'messages': [
          {
            'id': 'm1',
            'offerId': 'radar-17',
            'senderType': 'entreprise',
            'message': 'Le receveur est posé.',
            'kind': 'text',
            'auteur': '',
            'traduction': {'langue': 'portugais', 'original': 'O recetor está colocado.', 'sens': 'ltr'},
            'createdAt': '2026-11-19T07:52:00',
          },
        ],
      },
    ]);
    await tester.pumpWidget(_app(ClientMessagesInboxScreen(fil: 'radar-17:e1', maintenant: _maintenant), depot));
    await tester.pumpAndSettle();
    expect(find.text('Le receveur est posé.'), findsOneWidget);
    expect(find.textContaining('traduit du portugais', findRichText: true), findsOneWidget);
    expect(find.textContaining('O recetor'), findsNothing);
    await tester.tap(find.textContaining('voir l\'original', findRichText: true));
    await tester.pumpAndSettle();
    expect(find.text('Original : O recetor está colocado.'), findsOneWidget);
    expect(find.textContaining('masquer l\'original', findRichText: true), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('un lien de signature collé donne le jeton et l\'identifiant', () {
    final l = lireLienSignature('https://getkoji.io/signature/login?signatureToken=sig-123-abc&identifier=Koji-AB12CD');
    expect(l.jeton, 'sig-123-abc');
    expect(l.identifiant, 'Koji-AB12CD');
    expect(lireLienSignature('https://getkoji.io/signature/sig-9').jeton, 'sig-9');
    expect(lireLienSignature('Koji-AB12CD').identifiant, 'Koji-AB12CD');
    expect(lireLienSignature('bonjour').identifiant, '');
  });

  testWidgets('lien de signature : connexion, signer (cases non cochées), signé et « Et maintenant »',
      (tester) async {
    cadreTelephone(tester);
    final api = _ApiLien(lecture: {'quote': {'id': 'q1'}, 'vue': _vueLien()});
    await tester.pumpWidget(_appLien(api, lien: 'https://getkoji.io/signature/login?signatureToken=sig-1&identifier=Koji-AB12CD'));
    await tester.pumpAndSettle();
    expect(find.text("J'ai reçu un lien de signature"), findsOneWidget);
    // Le lien collé remplit l'identifiant.
    expect(find.text('Koji-AB12CD'), findsOneWidget);
    final ouvrir = tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Ouvrir le devis'));
    expect(ouvrir.onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(2), 'faux');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le devis'));
    await tester.pumpAndSettle();
    expect(find.text('Identifiant ou mot de passe incorrect.'), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(2), 'bon');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le devis'));
    await tester.pumpAndSettle();
    expect(api.appels, ['connexion:Koji-AB12CD', 'connexion:Koji-AB12CD', 'lire:sig-1']);
    expect(find.text('Signer le devis'), findsWidgets);
    expect(find.text('ABL Expert Renov · lien reçu par e-mail'), findsOneWidget);
    expect(find.text('5 798,54 € TTC'), findsOneWidget);
    expect(find.text('TVA 10 % · acompte 30 % à la signature'), findsOneWidget);
    final cases = tester.widgetList<ClCase>(find.byType(ClCase)).toList();
    expect(cases, hasLength(1));
    expect(cases.single.cochee, isFalse);
    expect(tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Signer le devis')).onPressed, isNull);

    await tester.ensureVisible(find.text("J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis."));
    await tester.tap(find.text("J'ai lu le devis et je l'accepte ; ma signature vaut accord sur ce devis."));
    final pave = find.byType(ClPaveSignature);
    await tester.ensureVisible(pave);
    await tester.pumpAndSettle();
    await tester.dragFrom(tester.getCenter(pave) - const Offset(80, 10), const Offset(160, 20));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(ClBouton, 'Signer le devis'));
    // L'image PNG se fabrique hors de l'horloge simulée.
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ClBouton, 'Signer le devis'));
      for (var i = 0; i < 20 && api.signature == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    });
    await tester.pumpAndSettle();
    expect(api.signature?['consent'], isTrue);
    expect(api.signature?['mentionTva'], isFalse);
    expect(api.signature?['signerName'], 'S. Lefèvre');
    expect((api.signature?['signature'] as String).startsWith('data:image/png;base64,'), isTrue);

    expect(find.text("Merci, c'est signé."), findsOneWidget);
    expect(find.text('Devis signé'), findsOneWidget);
    expect(find.text('Et maintenant'), findsOneWidget);
    expect(find.text('Acompte'), findsOneWidget);
    await tester.ensureVisible(find.text('Suivre mon chantier'));
    await tester.tap(find.text('Suivre mon chantier'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/login'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('lien de signature : lien qui n\'ouvre plus rien, session expirée',
      (tester) async {
    cadreTelephone(tester);
    final api = _ApiLien(invalide: true);
    await tester.pumpWidget(_appLien(api, lien: 'Koji-AB12CD'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(2), 'bon');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le devis'));
    await tester.pumpAndSettle();
    expect(find.text('Lien non valide'), findsOneWidget);
    expect(find.text("Ce lien n'ouvre plus de devis"), findsOneWidget);
    expect(find.text('Écrire à ABL Expert Renov'), findsOneWidget);

    final expiree = _ApiLien(expiree: true);
    await tester.pumpWidget(_appLien(expiree, lien: 'Koji-AB12CD'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(2), 'bon');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le devis'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Session de signature expirée'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('image de référence : signer par lien', (tester) async {
    cadreTelephone(tester);
    final api = _ApiLien(lecture: {'quote': {'id': 'q1'}, 'vue': _vueLien()});
    await tester.pumpWidget(_appLien(api, lien: 'Koji-AB12CD'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(2), 'bon');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le devis'));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientSignatureLienScreen), matchesGoldenFile('goldens/cli07_signer_lien.png'));
  });

  testWidgets('image de référence : photo après et galerie', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(const ClientDevisChantierScreen(quoteId: 'q1', onglet: 'documents'), _Depot(chantier: _vue())));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Photos du chantier'));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientDevisChantierScreen), matchesGoldenFile('goldens/cli02_photos.png'));
  });
}
