import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_accueil_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

import 'client_charte_support.dart';

Widget _wrapClientShell(
  Widget shell, {
  required double screenWidth,
}) {
  return ProviderScope(
    overrides: [
      currentAccountProvider.overrideWith(
        (ref) async => const KojiAccount(
          id: 'u1',
          email: 'test@example.com',
          fullName: 'Test User',
        ),
      ),
      kojiWebApiClientProvider.overrideWithValue(ApiDeconnectee()),
      clientQuotesProvider.overrideWith((ref) async => []),
      clientTasksProvider.overrideWith((ref) async => []),
      marketplaceOffersProvider.overrideWith((ref) async => []),
      clientNotificationsProvider.overrideWith((ref) async => []),
    ],
    child: MaterialApp(
      theme: KojiTheme.light(),
      home: MediaQuery(
        data: MediaQueryData(size: Size(screenWidth, 800)),
        child: shell,
      ),
    ),
  );
}

void main() {
  testWidgets(
    'ClientShell displays the charter bottom bar on narrow screens',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _wrapClientShell(
          const ClientShell(
            location: '/client-home',
            child: Scaffold(body: Text('Test')),
          ),
          screenWidth: 400,
        ),
      );
      await tester.pump();

      // Barre de la charte Client : Projets, Messages, « + », Profil.
      expect(find.byType(ClientBottomBar), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('Projets'), findsOneWidget);
      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Profil'), findsOneWidget);
      expect(find.bySemanticsLabel('Nouveau projet'), findsOneWidget);
      // Devis et Chantiers ont quitté la barre ; Paiements attend son écran.
      expect(find.text('Accueil'), findsNothing);
      expect(find.text('Devis'), findsNothing);
      expect(find.text('Chantiers'), findsNothing);
      expect(paiementsPret, isFalse);
      expect(find.text('Paiements'), findsNothing);
      expect(clientTabPaths,
          ['/client-home', '/client/messages', '/client/profil']);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('pages hors onglets (devis, chantiers…) : plein écran, sans barre',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    for (final location in ['/client/devis', '/client/chantiers']) {
      await tester.pumpWidget(
        _wrapClientShell(
          ClientShell(
            location: location,
            child: const Scaffold(body: Text('Test')),
          ),
          screenWidth: 400,
        ),
      );
      await tester.pump();
      expect(find.text('Test'), findsOneWidget);
      expect(find.byType(ClientBottomBar), findsNothing);
    }
  });

  testWidgets('barre du bas : onglet actif, choix d\'un onglet, « + » qui dépasse',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final choisis = <String>[];
    var nouveaux = 0;
    var dessous = 0;
    await tester.pumpWidget(MaterialApp(
      home: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => dessous++,
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ClientBottomBar(
              location: '/client/messages',
              onSelect: choisis.add,
              onNouveau: () => nouveaux++,
            ),
          ),
        ],
      ),
    ));

    // Onglet actif : marine et gras ; les autres gris.
    final actif = tester.widget<Text>(find.text('Messages'));
    expect(actif.style!.color, ClCharte.marine);
    expect(actif.style!.fontWeight, FontWeight.w700);
    expect(tester.widget<Text>(find.text('Projets')).style!.color,
        ClCharte.gris);

    await tester.tap(find.text('Projets'));
    await tester.tap(find.text('Profil'));
    expect(choisis, ['/client-home', '/client/profil']);

    // Le « + » dépasse de 14 px au-dessus de la barre et reste touchable
    // jusqu'en haut ; à côté, la bande laisse passer le geste vers la page.
    final barre = tester.getRect(find.byType(ClientBottomBar));
    final plus = tester.getRect(find.bySemanticsLabel('Nouveau projet'));
    expect(barre.height, ClientBottomBar.hauteur + 14);
    expect(plus.top, barre.top);
    expect(plus.size, const Size(44, 44));
    await tester.tapAt(plus.topCenter + const Offset(0, 3));
    expect(nouveaux, 1);
    await tester.tapAt(barre.topLeft + const Offset(20, 5));
    expect(dessous, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('grand écran : menu latéral inchangé, « Vos projets » sans bandeau',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _wrapClientShell(
        const ClientShell(
          location: '/client-home',
          child: ClientAccueilScreen(),
        ),
        screenWidth: 1280,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(ClientBottomBar), findsNothing);
    expect(find.text('Devis reçus'), findsOneWidget);
    expect(find.text('Mes chantiers'), findsOneWidget);
    expect(find.text('Vos projets'), findsOneWidget);
    expect(find.text('Nouveau projet'), findsOneWidget);
    expect(find.byType(ClBandeau), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
