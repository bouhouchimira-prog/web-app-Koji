import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_messages_inbox_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Messages » (maquette CLI-03) : fils par entreprise, bulles, saisie.
// Dépôt du site simulé, horloge figée au 18 nov. 2026 à 10 h.

final _maintenant = DateTime(2026, 11, 18, 10);

Map<String, dynamic> _filAbl({bool nonLu = false, bool photos = false}) => {
      'offerId': 'radar-17',
      'entrepriseUserId': 'ent-abl',
      'entrepriseSnapshot': {'raisonSociale': 'ABL Expert Renov'},
      'offre': {
        'description': 'Salle de bain, Paris 10e',
        'address': '',
        'status': 'Active',
      },
      'unread': nonLu,
      'messages': [
        {
          'id': 'm1',
          'senderType': 'entreprise',
          'message':
              'Le receveur est posé. Demain je fais la faïence du mur du fond.',
          'kind': 'text',
          'createdAt': '2026-11-17T18:42:00',
        },
        {
          'id': 'm2',
          'senderType': 'particulier',
          'message': 'Parfait, merci ! Le gardien sera là avant 12 h vendredi.',
          'kind': 'text',
          'createdAt': '2026-11-18T07:40:00',
        },
        {
          'id': 'm3',
          'senderType': 'entreprise',
          'message': 'Proposition de visite : vendredi 21 novembre à 9 h.',
          'kind': 'rdv_proposal',
          'rdvDate': '2026-11-21T09:00:00',
          'createdAt': '2026-11-18T07:52:00',
        },
        if (photos)
          {
            'id': 'm4',
            'senderType': 'entreprise',
            'message': "Demande d'accès aux photos du chantier.",
            'kind': 'photo_request',
            'createdAt': '2026-11-18T08:00:00',
          },
      ],
    };

Map<String, dynamic> _filEst() => {
      'offerId': 'radar-9',
      'entrepriseUserId': 'ent-est',
      'entrepriseSnapshot': {'raisonSociale': 'Rénov Est'},
      'offre': {'description': 'Peinture du séjour'},
      'unread': false,
      'messages': [
        {
          'id': 'e1',
          'senderType': 'particulier',
          'message': 'Merci pour votre réponse, bonne continuation.',
          'kind': 'text',
          'createdAt': '2026-11-16T09:00:00',
        },
      ],
    };

Widget _ecran(DepotSimule depot, {String? fil, bool coquille = false}) {
  final ecran = ClientMessagesInboxScreen(fil: fil, maintenant: _maintenant);
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: coquille
          ? ClientShell(location: '/client/messages', child: ecran)
          : ecran,
    ),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('liste : un fil par entreprise, aperçu, date, non lu',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(fils: [_filAbl(nonLu: true), _filEst()]);
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    expect(find.text('Messages'), findsOneWidget);
    expect(find.text('1 fil non lu'), findsOneWidget);
    expect(find.text('ABL Expert Renov'), findsOneWidget);
    expect(find.text('Proposition de visite : vendredi 21 novembre à 9 h.'),
        findsOneWidget);
    expect(find.text('07:52'), findsOneWidget);
    expect(find.text('Rénov Est'), findsOneWidget);
    expect(find.text('Vous · Merci pour votre réponse, bonne continuation.'),
        findsOneWidget);
    expect(find.text('lun.'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp(r'^Non lu')), findsOneWidget);
    // Les messages ne portent pas de traduction : rien n'en parle.
    expect(find.textContaining('tradui'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'ouvrir un fil non lu : bulles, et ses notifications passent en lues',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(fils: [
      _filAbl(nonLu: true),
      _filEst()
    ], notifications: [
      {
        'id': 'n1',
        'type': 'radar.message',
        'read': false,
        'offerId': 'radar-17',
        'entrepriseUserId': 'ent-abl',
      },
      {
        'id': 'n2',
        'type': 'radar.message',
        'read': false,
        'offerId': 'radar-9',
        'entrepriseUserId': 'ent-est',
      },
    ]);
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    await tester.tap(find.text('ABL Expert Renov'));
    await tester.pumpAndSettle();

    // Barre : l'entreprise et la demande ; bulles reçues et envoyée.
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
    final recue = tester.widget<ClBulle>(find.widgetWithText(ClBulle,
        'Le receveur est posé. Demain je fais la faïence du mur du fond.'));
    expect(recue.envoyee, isFalse);
    expect(recue.note, 'hier 18:42');
    final envoyee = tester.widget<ClBulle>(find.widgetWithText(
        ClBulle, 'Parfait, merci ! Le gardien sera là avant 12 h vendredi.'));
    expect(envoyee.envoyee, isTrue);
    expect(envoyee.note, '07:40');
    expect(find.text('Écrire un message…'), findsOneWidget);
    expect(depot.appels, ['lu:n1']);

    // « ‹ » revient à la liste.
    await tester.tap(find.bySemanticsLabel('Retour'));
    await tester.pumpAndSettle();
    expect(find.text('Rénov Est'), findsOneWidget);
  });

  testWidgets('écrire, répondre à la visite, montrer les photos',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(fils: [_filAbl(photos: true)]);
    await tester.pumpWidget(_ecran(depot, fil: 'radar-17:ent-abl'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Je serai là à 9 h.');
    await tester.tap(find.bySemanticsLabel('Envoyer'));
    await tester.pumpAndSettle();
    expect(depot.appels.last, 'message:radar-17:ent-abl:Je serai là à 9 h.');
    expect(find.text('Je serai là à 9 h.'), findsNothing);

    await tester.tap(find.widgetWithText(ClBouton, 'Accepter'));
    await tester.pumpAndSettle();
    expect(depot.appels.last, 'rdv:m3:true');

    await tester.tap(
        find.widgetWithText(ClBouton, 'Montrer mes photos à ABL Expert Renov'));
    await tester.pumpAndSettle();
    expect(depot.appels.last, 'photos:radar-17:ent-abl');
  });

  testWidgets('erreur d\'envoi : le message du site s\'affiche',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(
      fils: [_filAbl()],
      erreurEnvoi: KojiWebApiException(400, 'Message trop long.'),
    );
    await tester.pumpWidget(_ecran(depot, fil: 'radar-17:ent-abl'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Bonjour');
    await tester.tap(find.bySemanticsLabel('Envoyer'));
    await tester.pumpAndSettle();
    expect(find.text('Message trop long.'), findsOneWidget);
  });

  testWidgets('« Voir la demande » mène au détail de la demande',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(fils: [_filAbl()]);
    final router = GoRouter(
      initialLocation: '/client/messages?fil=radar-17:ent-abl',
      routes: [
        GoRoute(
          path: '/client/messages',
          builder: (_, s) => ClientMessagesInboxScreen(
              fil: s.uri.queryParameters['fil'], maintenant: _maintenant),
        ),
        GoRoute(
          path: '/client/marketplace/:offerId',
          builder: (_, s) => Scaffold(body: Text('→ ${s.uri}')),
        ),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
        marketplaceRepositoryProvider.overrideWithValue(depot),
      ],
      child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Voir la demande : visite, photos, paiements'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/radar-17'), findsOneWidget);
  });

  testWidgets(
      'image de référence : fil ouvert, cadre téléphone avec la barre du bas',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(fils: [_filAbl(), _filEst()]);
    await tester
        .pumpWidget(_ecran(depot, fil: 'radar-17:ent-abl', coquille: true));
    await tester.pumpAndSettle();

    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(find.byType(ClientShell),
        matchesGoldenFile('goldens/cli03_messages.png'));
    expect(tester.takeException(), isNull);
  });
}
