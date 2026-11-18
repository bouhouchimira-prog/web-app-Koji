import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_parametres_screen.dart';
import 'package:koji/core/theme_provider.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Paramètres » et « Supprimer mon compte » (maquette CLI-06), avec ce qui
// existe réellement. Aucun appel ne part : demande de suppression simulée.

const _lefevre = KojiAccount(
    id: 'u1', email: 'sophie.lefevre@exemple.fr', fullName: 'Sophie Lefèvre');

Widget _ecran({
  List<String>? demandes,
  bool coquille = false,
}) {
  const ecran = ClientParametresScreen();
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(ApiConnectee()),
      marketplaceRepositoryProvider.overrideWithValue(DepotSimule()),
      currentAccountProvider.overrideWith((ref) async => _lefevre),
      clientDemandeSuppressionProvider.overrideWithValue(() async {
        demandes?.add('suppression');
        return true;
      }),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      home: coquille
          ? const ClientShell(location: '/client/parametres', child: ecran)
          : ecran,
    ),
  );
}

void main() {
  setUpAll(chargerPolicesClient);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('sections réelles : affichage, données, compte, pages légales',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran());
    await tester.pumpAndSettle();

    expect(find.text('Paramètres'), findsOneWidget);
    expect(find.text('Sophie Lefèvre'), findsOneWidget);
    for (final texte in [
      'Affichage',
      'Mes données',
      'Télécharger mes données',
      'Supprimer mon compte',
      "sous 30 jours ; les factures restent chez l'entreprise",
      'Compte',
      'Se déconnecter',
      'pages légales',
    ]) {
      expect(find.text(texte), findsOneWidget, reason: texte);
    }
    // Pas de réglage qui n'existe pas encore.
    expect(find.text('Notifications'), findsNothing);
    expect(find.text('Langue'), findsNothing);
    expect(find.text('Par e-mail aussi'), findsNothing);
    expect(pagesLegalesUrl, 'https://getkoji.io/legal/conditions-particuliers');
    expect(tester.takeException(), isNull);
  });

  testWidgets('thème : la ligne touchée devient le thème de l\'app',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sombre'));
    await tester.pumpAndSettle();
    final conteneur = ProviderScope.containerOf(
        tester.element(find.byType(ClientParametresScreen)));
    expect(conteneur.read(themeProvider), ThemeMode.dark);
  });

  testWidgets('supprimer : case non cochée, bouton en contour, puis demande',
      (tester) async {
    cadreTelephone(tester);
    final demandes = <String>[];
    await tester.pumpWidget(_ecran(demandes: demandes));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Supprimer mon compte'));
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Je comprends que mon compte et mes projets seront supprimés'),
        findsOneWidget);
    expect(tester.widget<ClCase>(find.byType(ClCase)).cochee, isFalse);
    final supprimer = find.widgetWithText(ClBouton, 'Supprimer mon compte');
    expect(tester.widget<ClBouton>(supprimer).contour, isTrue);
    expect(tester.widget<ClBouton>(supprimer).onPressed, isNull);
    expect(
        tester
            .widget<ClBouton>(
                find.widgetWithText(ClBouton, 'Garder mon compte'))
            .secondaire,
        isTrue);
    // Une destruction n'est jamais en marine plein.
    expect(
        tester
            .widgetList<ClBouton>(find.byType(ClBouton))
            .where((b) => !b.secondaire && !b.contour),
        isEmpty);

    await tester.tap(find.byType(ClCase));
    await tester.pumpAndSettle();
    await tester.tap(supprimer);
    await tester.pumpAndSettle();
    expect(demandes, ['suppression']);
    expect(find.text('Votre demande est envoyée.'), findsOneWidget);
  });

  testWidgets('« Garder mon compte » revient aux paramètres', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Supprimer mon compte'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Garder mon compte'));
    await tester.pumpAndSettle();
    expect(find.text('Affichage'), findsOneWidget);
  });

  testWidgets('image de référence : Paramètres, cadre téléphone',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_ecran(coquille: true));
    await tester.pumpAndSettle();
    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(find.byType(ClientShell),
        matchesGoldenFile('goldens/cli06_parametres.png'));
    expect(tester.takeException(), isNull);
  });
}
