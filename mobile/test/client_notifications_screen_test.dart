import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_notifications_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Notifications » (maquette CLI-04) : liste par jour, détail, actions
// réelles. /api/notifications simulé, horloge figée au mer. 18 nov. 10 h.

final _maintenant = DateTime(2026, 11, 18, 10);

List<Map<String, dynamic>> _notifications() => [
      {
        'id': 'n1',
        'type': 'radar.message',
        'title': 'ABL Expert Renov vous a contacté',
        'message':
            'Le receveur est posé. Demain je fais la faïence du mur du fond.',
        'offerId': 'radar-17',
        'entrepriseUserId': 'ent-abl',
        'entrepriseName': 'ABL Expert Renov',
        'read': false,
        'createdAt': '2026-11-18T07:52:00',
      },
      {
        'id': 'n2',
        'type': 'radar.positionnement',
        'title': "Rénov Est s'est positionnée sur votre chantier",
        'message': 'Salle de bain, Paris 10e',
        'offerId': 'radar-17',
        'entrepriseUserId': 'ent-est',
        'entrepriseName': 'Rénov Est',
        'read': false,
        'createdAt': '2026-11-17T18:30:00',
      },
      {
        'id': 'n3',
        'type': 'radar.positionnement',
        'title': "Atelier Nord s'est positionnée sur votre chantier",
        'message': 'Peinture du séjour',
        'offerId': 'radar-9',
        'entrepriseUserId': 'ent-nord',
        'entrepriseName': 'Atelier Nord',
        'read': true,
        'createdAt': '2026-11-16T09:00:00',
      },
      {
        'id': 'n4',
        'type': 'autre',
        'title': 'Bienvenue sur Koji',
        'message': '',
        'read': true,
        'createdAt': '2026-10-28T09:00:00',
      },
    ];

/// Fil existant avec Rénov Est (pour « Écrire à l'entreprise »).
const _filEst = {
  'offerId': 'radar-17',
  'entrepriseUserId': 'ent-est',
  'entrepriseSnapshot': {'raisonSociale': 'Rénov Est'},
  'offre': {'description': 'Salle de bain, Paris 10e'},
  'unread': false,
  'messages': [],
};

List<Override> _donnees(DepotSimule depot) => [
      kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
    ];

Widget _ecran(DepotSimule depot, {bool coquille = false}) {
  final ecran = ClientNotificationsScreen(maintenant: _maintenant);
  return ProviderScope(
    overrides: _donnees(depot),
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: coquille
          ? ClientShell(location: '/client/notifications', child: ecran)
          : ecran,
    ),
  );
}

Widget _avecRouteur(DepotSimule depot) {
  final router = GoRouter(
    initialLocation: '/client/notifications',
    routes: [
      GoRoute(
        path: '/client/notifications',
        builder: (_, __) => ClientNotificationsScreen(maintenant: _maintenant),
      ),
      for (final chemin in [
        '/client/projet/:offerId',
        '/client/messages',
        '/client/marketplace/:offerId',
      ])
        GoRoute(
            path: chemin,
            builder: (_, s) => Scaffold(body: Text('→ ${s.uri}'))),
    ],
  );
  return ProviderScope(
    overrides: _donnees(depot),
    child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets(
      'liste par jour : non lues en gras avec le point, tout marquer lu',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(notifications: _notifications());
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    expect(find.text('2 non lues'), findsOneWidget);
    for (final jour in ["Aujourd'hui", 'Hier', 'Cette semaine', 'Plus tôt']) {
      expect(find.text(jour), findsOneWidget, reason: jour);
    }
    // Aujourd'hui et hier : l'heure ; cette semaine : le jour ; avant : la date.
    expect(find.text('07:52'), findsOneWidget);
    expect(find.text('18:30'), findsOneWidget);
    expect(find.text('lun.'), findsOneWidget);
    expect(find.text('28 oct.'), findsOneWidget);

    final nonLue = tester.widget<ClLigneNotification>(find.widgetWithText(
        ClLigneNotification, 'ABL Expert Renov vous a contacté'));
    expect(nonLue.nonLue, isTrue);
    expect(
        tester
            .widget<Text>(find.text('ABL Expert Renov vous a contacté'))
            .style!
            .fontWeight,
        FontWeight.w700);
    expect(
        tester
            .widget<Text>(
                find.text("Atelier Nord s'est positionnée sur votre chantier"))
            .style!
            .fontWeight,
        FontWeight.w500);
    // Jamais de prix calculé par Koji.
    expect(find.textContaining('prix'), findsNothing);

    await tester.tap(find.text('Tout marquer lu'));
    await tester.pumpAndSettle();
    expect(depot.appels, ['tout-lu']);
  });

  testWidgets('détail : fait en serif, action marine, écrire à l\'entreprise',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(notifications: _notifications(), fils: [_filEst]);
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    await tester
        .tap(find.text("Rénov Est s'est positionnée sur votre chantier"));
    await tester.pumpAndSettle();

    expect(depot.appels, ['lu:n2']);
    expect(find.text('Entreprise positionnée'), findsOneWidget);
    expect(find.text('Rénov Est · hier 18:30'), findsOneWidget);
    final fait = tester.widget<Text>(
        find.text("Rénov Est s'est positionnée sur votre chantier"));
    expect(fait.style!.fontFamily, ClCharte.serif);
    final principal = tester.widget<ClBouton>(
        find.widgetWithText(ClBouton, 'Voir les propositions'));
    expect(principal.secondaire, isFalse);
    final ecrire = tester.widget<ClBouton>(
        find.widgetWithText(ClBouton, "Écrire à l'entreprise"));
    expect(ecrire.secondaire, isTrue);

    await tester.tap(find.text('Supprimer cette notification'));
    await tester.pumpAndSettle();
    expect(depot.appels.last, 'supprime:n2');
    expect(find.text('Tout marquer lu'), findsOneWidget);
  });

  testWidgets('sans fil avec l\'entreprise : pas de bouton secondaire',
      (tester) async {
    cadreTelephone(tester);
    await tester
        .pumpWidget(_ecran(DepotSimule(notifications: _notifications())));
    await tester.pumpAndSettle();
    await tester
        .tap(find.text("Atelier Nord s'est positionnée sur votre chantier"));
    await tester.pumpAndSettle();
    expect(
        find.widgetWithText(ClBouton, 'Voir les propositions'), findsOneWidget);
    expect(
        find.widgetWithText(ClBouton, "Écrire à l'entreprise"), findsNothing);

    // Sans demande liée : aucun bouton.
    await tester.tap(find.bySemanticsLabel('Retour'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bienvenue sur Koji'));
    await tester.pumpAndSettle();
    expect(find.byType(ClBouton), findsNothing);
  });

  testWidgets('les actions mènent au fil et aux propositions', (tester) async {
    cadreTelephone(tester);
    Future<void> ouvrir(
        String notification, String bouton, String attendu) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_avecRouteur(
          DepotSimule(notifications: _notifications(), fils: [_filEst])));
      await tester.pumpAndSettle();
      await tester.tap(find.text(notification));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ClBouton, bouton));
      await tester.pumpAndSettle();
      expect(find.text('→ $attendu'), findsOneWidget, reason: attendu);
    }

    await ouvrir('ABL Expert Renov vous a contacté', 'Ouvrir la conversation',
        '/client/messages?fil=radar-17%3Aent-abl');
    await ouvrir("Rénov Est s'est positionnée sur votre chantier",
        'Voir les propositions', '/client/projet/radar-17');
    await ouvrir("Rénov Est s'est positionnée sur votre chantier",
        "Écrire à l'entreprise", '/client/messages?fil=radar-17%3Aent-est');
  });

  testWidgets('image de référence : Notifications, cadre téléphone',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(
        _ecran(DepotSimule(notifications: _notifications()), coquille: true));
    await tester.pumpAndSettle();
    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(find.byType(ClientShell),
        matchesGoldenFile('goldens/cli04_notifications.png'));
    expect(tester.takeException(), isNull);
  });
}
