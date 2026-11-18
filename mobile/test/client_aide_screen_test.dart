import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_aide_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Aide » (maquette CLI-06) : recherche sur l'appareil, quatre thèmes, ordre
// de recours. Signalement simulé, rien ne part sur le réseau.

Widget _ecran(DepotSimule depot, {bool coquille = false}) {
  const ecran = ClientAideScreen();
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: coquille
          ? const ClientShell(location: '/client/aide', child: ecran)
          : ecran,
    ),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('quatre thèmes, recours, adresse contact@, aucun prix Koji',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(DepotSimule()));
    await tester.pumpAndSettle();

    for (final theme in [
      'Mon devis',
      'Le chantier',
      'Paiements',
      'Mon compte'
    ]) {
      expect(find.text(theme), findsOneWidget, reason: theme);
      // Chaque thème s'ouvre sur ses réponses.
      await tester.ensureVisible(find.text(theme));
      await tester.tap(find.text(theme));
      await tester.pumpAndSettle();
    }
    expect(find.textContaining('recommandé'), findsNothing);
    expect(find.textContaining('aide@'), findsNothing);

    await tester.scrollUntilVisible(find.text('Contacter Koji'), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    expect(find.text('contact@getkoji.io'),
        findsOneWidget);
    expect(find.text("Écrire à l'entreprise"), findsOneWidget);
    expect(find.text('Médiateur de la consommation'), findsOneWidget);
    expect(find.text('si le désaccord persiste (à désigner)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('le champ filtre les questions sur l\'appareil', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(DepotSimule()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'reserve');
    await tester.pumpAndSettle();
    expect(find.text("Qu'est-ce qu'une réserve ?"), findsOneWidget);
    expect(find.text('Mon devis'), findsNothing);

    await tester.enterText(find.byType(TextField), 'signé');
    await tester.pumpAndSettle();
    expect(
        find.text("Puis-je changer d'avis après signature ?"), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();
    expect(find.textContaining('Aucune réponse ne correspond'), findsOneWidget);
  });

  testWidgets('signaler un problème : envoi à l\'équipe Koji', (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule();
    await tester.pumpWidget(_ecran(depot));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(find.text('Signaler un problème'), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Signaler un problème'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.descendant(
            of: find.byType(AlertDialog), matching: find.byType(TextField)),
        'Retard de trois semaines');
    await tester.tap(find.text('Envoyer'));
    await tester.pumpAndSettle();
    expect(depot.appels,
        ['signalement:[Signalement artisan] Retard de trois semaines']);
    expect(find.text("Signalement envoyé, l'équipe Koji revient vers vous."),
        findsOneWidget);
  });

  testWidgets('« Écrire à l\'entreprise » ouvre Messages', (tester) async {
    cadreTelephone(tester);
    final router = GoRouter(
      initialLocation: '/client/aide',
      routes: [
        GoRoute(
            path: '/client/aide', builder: (_, __) => const ClientAideScreen()),
        GoRoute(
            path: '/client/messages',
            builder: (_, s) => Scaffold(body: Text('→ ${s.uri}'))),
      ],
    );
    await tester.pumpWidget(ProviderScope(
      overrides: [
        kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
        marketplaceRepositoryProvider.overrideWithValue(DepotSimule()),
      ],
      child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
    ));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text("Écrire à l'entreprise"), 200,
        scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text("Écrire à l'entreprise"));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/messages'), findsOneWidget);
  });

  testWidgets('image de référence : Aide, cadre téléphone', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(DepotSimule(), coquille: true));
    await tester.pumpAndSettle();
    expect(find.byType(ClientBottomBar), findsOneWidget);
    expect(find.byType(ClRangee), findsNWidgets(8));
    await expectLater(
        find.byType(ClientShell), matchesGoldenFile('goldens/cli06_aide.png'));
    expect(tester.takeException(), isNull);
  });
}
