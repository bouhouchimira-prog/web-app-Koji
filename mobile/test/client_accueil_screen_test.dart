import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_accueil_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

import 'client_charte_support.dart';

// « Vos projets » (maquette CLI-01), l'accueil du téléphone. Données du site
// et de l'app simulées, rien ne part sur le réseau.

const _lea = KojiAccount(id: 'u1', email: 'lea@example.com', fullName: 'Léa Martin');

const _taches = [
  {
    'chantier_id': 'c1',
    'chantier_reference': 'Rénovation salle de bain',
    'is_done': true,
    'label': 'Dépose carrelage',
  },
  {
    'chantier_id': 'c1',
    'chantier_reference': 'Rénovation salle de bain',
    'is_done': false,
    'label': 'Pose carrelage',
  },
];

Map<String, dynamic> _projets() => {
      'bonjour': 'Mme Lefèvre',
      'projets': [
        // Devis ou chantier du site : ouvre la page CLI-02 de l'app.
        {
          'cle': 'chantier:q_1',
          'type': 'chantier',
          'id': 'q_1',
          'titre': 'Chantier du site',
          'detail': 'ABL Expert Renov · chantier en cours · jour 6 sur 18',
          'etat': 'en_cours',
          'etiquette': 'En cours',
          'etiquettePleine': true,
          'attenue': false,
        },
        {
          'cle': 'offre:radar-17',
          'type': 'offre',
          'id': 'radar-17',
          'titre': 'Salle de bain, Paris 10e',
          'detail': '3 propositions reçues · 1 visite le 24 oct.',
          'etat': 'a_choisir',
          'etiquette': 'À choisir',
          'etiquettePleine': true,
          'action': 'Comparer',
          'principale': false,
          'attenue': false,
          'lien': '/client/projet/radar-17',
          'propositions': 3,
        },
        {
          'cle': 'brouillon:radar-draft-9',
          'type': 'brouillon',
          'id': 'radar-draft-9',
          'titre': 'Peinture du séjour',
          'detail': 'brouillon · 2 questions restantes',
          'etat': 'brouillon',
          'etiquette': 'Brouillon',
          'etiquettePleine': false,
          'action': 'Continuer',
          'principale': false,
          'attenue': true,
          'lien': '/client/radar/new?draftId=radar-draft-9&reprendre=1',
          'propositions': 0,
        },
      ],
      'attendus': ['Visite confirmée vendredi 9 h pour la peinture.'],
    };

List<Override> _donnees({
  bool connecte = true,
  KojiAccount? compte = _lea,
  List<Map<String, dynamic>> taches = const [],
  Future<Map<String, dynamic>> Function()? projets,
  List<Map<String, dynamic>> notifications = const [],
  void Function()? surNotifications,
}) =>
    [
      kojiWebApiClientProvider
          .overrideWithValue(connecte ? ApiConnectee() : ApiDeconnectee()),
      currentAccountProvider.overrideWith((ref) async => compte),
      clientTasksProvider.overrideWith((ref) async => taches),
      clientProjetsProvider
          .overrideWith((ref) => (projets ?? () async => _projets())()),
      clientNotificationsProvider.overrideWith((ref) async {
        surNotifications?.call();
        return notifications;
      }),
    ];

Widget _ecran(List<Override> overrides, {Widget home = const ClientAccueilScreen()}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: home,
    ),
  );
}

/// L'écran dans un routeur : chaque destination affiche son adresse.
Widget _avecRouteur(List<Override> overrides) {
  Widget arrivee(GoRouterState s) => Scaffold(body: Text('→ ${s.uri}'));
  final router = GoRouter(
    initialLocation: '/client-home',
    routes: [
      GoRoute(path: '/client-home', builder: (_, __) => const ClientAccueilScreen()),
      for (final chemin in [
        '/client/projet/:offerId',
        '/client/marketplace/new',
        '/client/marketplace/login',
        '/client/chantier/:key',
        '/client/devis/:quoteId',
        '/client/notifications',
      ])
        GoRoute(path: chemin, builder: (_, s) => arrivee(s)),
    ],
  );
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('aucun projet : bonjour avec le prénom, phrase, bouton, encadré',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(_donnees(connecte: false)));
    await tester.pumpAndSettle();

    expect(find.text('Bonjour Léa'), findsOneWidget);
    expect(find.text('Vos projets'), findsOneWidget);
    expect(find.text("Vous n'avez pas encore de projet."), findsOneWidget);
    expect(find.byType(ClCarteProjet), findsNothing);
    expect(find.widgetWithText(ClBouton, 'Nouveau projet'), findsOneWidget);
    expect(
      find.text("Décrivez vos travaux avec l'assistant Koji : il pose les "
          'bonnes questions et prépare votre demande pour les entreprises.'),
      findsOneWidget,
    );
    // Jamais de prix recommandé côté client.
    expect(find.textContaining('prix'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sans compte ni nom : « Bonjour » seul', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(_donnees(connecte: false, compte: null)));
    await tester.pumpAndSettle();
    expect(find.text('Bonjour'), findsOneWidget);
  });

  testWidgets('chantier, demande et brouillon : une carte chacun, textes du site',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(_donnees(taches: _taches)));
    await tester.pumpAndSettle();

    // Le bonjour du site passe avant le prénom du compte.
    expect(find.text('Bonjour Mme Lefèvre'), findsOneWidget);
    expect(find.byType(ClCarteProjet), findsNWidgets(4));

    // Chantier de l'app : référence, tâches et état.
    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    expect(find.text('1 / 2 tâches · En cours'), findsOneWidget);
    expect(
        tester
            .widget<ClEtiquette>(find.descendant(
                of: find.widgetWithText(ClCarteProjet, 'Rénovation salle de bain'),
                matching: find.byType(ClEtiquette)))
            .pleine,
        isTrue);

    // Demande : étiquette pleine.
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
    expect(find.text('3 propositions reçues · 1 visite le 24 oct.'), findsOneWidget);
    expect(tester.widget<ClEtiquette>(find.widgetWithText(ClEtiquette, 'À choisir')).pleine, isTrue);

    // Brouillon : étiquette au trait, carte atténuée.
    expect(find.text('brouillon · 2 questions restantes'), findsOneWidget);
    expect(tester.widget<ClEtiquette>(find.widgetWithText(ClEtiquette, 'Brouillon')).pleine, isFalse);
    final brouillon = find.widgetWithText(ClCarteProjet, 'Peinture du séjour');
    expect(tester.widget<ClCarteProjet>(brouillon).attenue, isTrue);
    expect(
      tester.widget<Opacity>(find.descendant(of: brouillon, matching: find.byType(Opacity))).opacity,
      0.75,
    );

    // Le chantier du site (une autre source que ceux de l'app) a sa carte.
    expect(find.text('Chantier du site'), findsOneWidget);
    expect(find.text('ABL Expert Renov · chantier en cours · jour 6 sur 18'), findsOneWidget);
    expect(find.text("Vous n'avez pas encore de projet."), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('même chantier dans l’app et sur le site : une seule carte, celle du site',
      (tester) async {
    cadreTelephone(tester);
    final donnees = _projets();
    (donnees['projets'] as List).first['projectId'] = 'c1';
    await tester.pumpWidget(_ecran(_donnees(taches: _taches, projets: () async => donnees)));
    await tester.pumpAndSettle();

    expect(find.text('Chantier du site'), findsOneWidget);
    expect(find.text('Rénovation salle de bain'), findsNothing);
    expect(find.byType(ClCarteProjet), findsNWidgets(3));
  });

  testWidgets('sans session du site : le site n\'est pas interrogé, les chantiers restent',
      (tester) async {
    cadreTelephone(tester);
    var appels = 0;
    await tester.pumpWidget(_ecran(_donnees(
      connecte: false,
      taches: _taches,
      projets: () async {
        appels++;
        return _projets();
      },
      surNotifications: () => appels++,
    )));
    await tester.pumpAndSettle();

    expect(appels, 0);
    expect(find.byType(ClCarteProjet), findsOneWidget);
    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    expect(find.text('Salle de bain, Paris 10e'), findsNothing);
  });

  testWidgets('erreur du site : une ligne grise et « Réessayer », qui relance',
      (tester) async {
    cadreTelephone(tester);
    var appels = 0;
    await tester.pumpWidget(_ecran(_donnees(
      taches: _taches,
      projets: () async {
        appels++;
        if (appels == 1) throw KojiWebApiException(500, 'Erreur serveur (500).');
        return _projets();
      },
    )));
    await tester.pumpAndSettle();

    expect(find.text('Impossible de charger vos projets.'), findsOneWidget);
    // Les chantiers de l'app restent affichés.
    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    final reessayer = find.widgetWithText(ClBouton, 'Réessayer');
    expect(tester.widget<ClBouton>(reessayer).secondaire, isTrue);

    await tester.tap(reessayer);
    await tester.pumpAndSettle();
    expect(appels, 2);
    expect(find.text('Impossible de charger vos projets.'), findsNothing);
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
  });

  testWidgets('cartes et boutons mènent aux bons écrans', (tester) async {
    cadreTelephone(tester);
    Future<void> ouvrir(Finder cible, String attendu, {bool connecte = true}) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_avecRouteur(_donnees(
        connecte: connecte,
        taches: _taches,
        notifications: const [
          {'id': 'n1', 'read': false},
        ],
      )));
      await tester.pumpAndSettle();
      await tester.tap(cible);
      await tester.pumpAndSettle();
      expect(find.text('→ $attendu'), findsOneWidget, reason: attendu);
    }

    await ouvrir(find.text('Salle de bain, Paris 10e'), '/client/projet/radar-17');
    await ouvrir(find.text('Peinture du séjour'), '/client/marketplace/new?draftId=radar-draft-9');
    await ouvrir(find.text('Rénovation salle de bain'), '/client/chantier/c1');
    await ouvrir(find.text('Chantier du site'), '/client/devis/q_1');
    await ouvrir(find.text('Nouveau projet'), '/client/marketplace/new');
    await ouvrir(find.text('Nouveau projet'), '/client/marketplace/login', connecte: false);
    await ouvrir(find.bySemanticsLabel('Notifications, 1 non lue'), '/client/notifications');
  });

  testWidgets('image de référence : Vos projets, cadre téléphone avec la barre du bas',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(
      _donnees(
        notifications: const [
          {'id': 'n1', 'read': false},
          {'id': 'n2', 'read': false},
          {'id': 'n3', 'read': true},
        ],
      ),
      home: const ClientShell(
        location: '/client-home',
        child: ClientAccueilScreen(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Bonjour Mme Lefèvre'), findsOneWidget);
    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(
        find.byType(ClientShell), matchesGoldenFile('goldens/cli01_vos_projets.png'));
    expect(tester.takeException(), isNull);
  });
}
