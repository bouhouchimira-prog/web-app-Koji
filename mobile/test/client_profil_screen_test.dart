import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_profil_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Profil » (maquette CLI-03) : coordonnées masquées, logement, données.
// Compte du site simulé (/api/client/profile).

Map<String, dynamic> _profil() => {
      'id': 'p1',
      'email': 'sophie.lefevre@exemple.fr',
      'name': 'Sophie Lefèvre',
      'profileKind': 'professionnel',
      'personal': {
        'firstName': 'Sophie',
        'lastName': 'Lefèvre',
        'phone': '06 12 34 41 18',
        'address': '12 rue des Vinaigriers',
        'postalCode': '75010',
        'city': 'Paris',
      },
    };

Widget _ecran(DepotSimule depot,
    {bool connecte = true, bool coquille = false}) {
  const ecran = ClientProfilScreen();
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider
          .overrideWithValue(connecte ? ApiConnectee() : ApiDeconnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
      currentAccountProvider.overrideWith((ref) async => null),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: coquille
          ? const ClientShell(location: '/client/profil', child: ecran)
          : ecran,
    ),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  test('coordonnées masquées : téléphone et e-mail', () {
    expect(masquerTelephone('06 12 34 41 18'), '06 •• •• 41 18');
    expect(masquerTelephone('+33 6 12 34 41 18'), '06 •• •• 41 18');
    expect(masquerTelephone(''), '');
    expect(masquerEmail('sophie.lefevre@exemple.fr'), 's••••@••••.fr');
    expect(masquerEmail('pas-une-adresse'), '');
  });

  testWidgets('liste de la maquette avec les champs réels seulement',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(DepotSimule(profil: _profil())));
    await tester.pumpAndSettle();

    expect(find.text('Profil'), findsOneWidget);
    expect(find.text('Sophie Lefèvre'), findsOneWidget);
    expect(find.text('06 •• •• 41 18 · s••••@••••.fr'), findsOneWidget);
    expect(find.text('12 rue des Vinaigriers, 75010 Paris'), findsOneWidget);
    expect(find.text('Mes données'), findsOneWidget);
    expect(find.text('télécharger, supprimer mon compte'), findsOneWidget);
    // Pas encore de langue ni de réglage des notifications : pas de ligne.
    expect(find.text('Langue'), findsNothing);
    expect(find.text('Notifications'), findsNothing);
    // Le numéro complet n'est pas affiché dans la liste.
    expect(find.textContaining('12 34'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Coordonnées : formulaire, enregistrement, retour à la liste',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(profil: _profil());
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Coordonnées'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ClChamp, 'Prénom'), findsOneWidget);
    expect(find.text('Sophie'), findsOneWidget);
    // L'e-mail se lit, ne se modifie pas.
    final email =
        tester.widget<ClChamp>(find.widgetWithText(ClChamp, 'E-mail'));
    expect(email.lectureSeule, isTrue);

    await tester.enterText(
        find.descendant(
            of: find.widgetWithText(ClChamp, 'Téléphone'),
            matching: find.byType(TextField)),
        '07 00 00 00 99');
    await tester.tap(find.widgetWithText(ClBouton, 'Enregistrer'));
    await tester.pumpAndSettle();

    final envoye = depot.profilEnvoye!;
    expect((envoye['personal'] as Map)['phone'], '07 00 00 00 99');
    expect((envoye['personal'] as Map)['city'], 'Paris');
    // Ni type de compte ni mot de passe envoyés : ils restent tels quels.
    expect(envoye.containsKey('profileKind'), isFalse);
    expect(envoye.containsKey('password'), isFalse);
    expect(find.text('Mon logement'), findsOneWidget);
    expect(find.text('Profil enregistré.'), findsOneWidget);
  });

  testWidgets('erreur du site : le message reste sur le formulaire',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(
      profil: _profil(),
      erreurEnvoi: KojiWebApiException(403, 'Mot de passe actuel incorrect.'),
    );
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mon logement'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ClBouton, 'Enregistrer'));
    await tester.pumpAndSettle();
    expect(find.text('Mot de passe actuel incorrect.'), findsOneWidget);
    expect(find.widgetWithText(ClChamp, 'Ville'), findsOneWidget);
  });

  testWidgets('sans session du site : se connecter, sans appel',
      (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(profil: _profil());
    await tester.pumpWidget(_ecran(depot, connecte: false));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ClBouton, 'Se connecter'), findsOneWidget);
    expect(find.text('Coordonnées'), findsNothing);
    expect(find.text('Mes données'), findsOneWidget);
    expect(depot.appels, isEmpty);
  });

  testWidgets('Mes données et Aide ouvrent leurs écrans', (tester) async {
    cadreTelephone(tester);
    final router = GoRouter(
      initialLocation: '/client/profil',
      routes: [
        GoRoute(
            path: '/client/profil',
            builder: (_, __) => const ClientProfilScreen()),
        for (final chemin in ['/client/parametres', '/client/aide'])
          GoRoute(
              path: chemin,
              builder: (_, s) => Scaffold(body: Text('→ ${s.uri}'))),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
        marketplaceRepositoryProvider
            .overrideWithValue(DepotSimule(profil: _profil())),
        currentAccountProvider.overrideWith((ref) async => null),
      ],
      child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mes données'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/parametres'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aide'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/aide'), findsOneWidget);
  });

  testWidgets(
      'image de référence : Profil, cadre téléphone avec la barre du bas',
      (tester) async {
    cadreTelephone(tester);
    await tester
        .pumpWidget(_ecran(DepotSimule(profil: _profil()), coquille: true));
    await tester.pumpAndSettle();
    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(find.byType(ClientShell),
        matchesGoldenFile('goldens/cli03_profil.png'));
    expect(tester.takeException(), isNull);
  });
}
