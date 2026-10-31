import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

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
    'ClientShell displays a bottom navigation bar on narrow screens',
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

      // On narrow screens, the bottom navigation bar should be visible.
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('Accueil'), findsOneWidget);
      expect(find.text('Devis'), findsOneWidget);
      expect(find.text('Chantiers'), findsOneWidget);
      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Profil'), findsOneWidget);
    },
  );

}
