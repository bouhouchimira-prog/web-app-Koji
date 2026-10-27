import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/screens/client_accueil_screen.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

void main() {
  Widget wrap(Widget child, {required List<Override> overrides}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(theme: KojiTheme.light(), home: child),
    );
  }

  testWidgets('shows the hero CTA and a greeting with the first name',
      (tester) async {
    await tester.pumpWidget(wrap(
      const ClientAccueilScreen(),
      overrides: [
        currentAccountProvider.overrideWith((ref) async => const KojiAccount(
              id: 'u1',
              email: 'lea@example.com',
              fullName: 'Léa Martin',
            )),
        clientTasksProvider.overrideWith((ref) async => []),
        marketplaceOffersProvider.overrideWith((ref) async => []),
      ],
    ));
    await tester.pump();
    await tester.pump();

    expect(find.text('Bonjour Léa'), findsOneWidget);
    expect(find.text('Un autre projet de travaux ?'), findsOneWidget);
    expect(find.text('Publier un chantier'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('lists chantiers and offres when the providers return data',
      (tester) async {
    await tester.pumpWidget(wrap(
      const ClientAccueilScreen(),
      overrides: [
        currentAccountProvider.overrideWith(
          (ref) async => const KojiAccount(id: 'u1', email: 'lea@x.com'),
        ),
        clientTasksProvider.overrideWith((ref) async => [
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
            ]),
        marketplaceOffersProvider.overrideWith((ref) async => [
              {
                'id': 'radar-1',
                'description': 'Peinture complète du salon',
                'metier': 'Peinture',
                'address': 'Paris 11e',
                'status': 'Publiee',
                'hasArtisanReply': false,
              },
            ]),
      ],
    ));
    await tester.pump();
    await tester.pump();

    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    expect(find.textContaining('Peinture complète du salon'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
