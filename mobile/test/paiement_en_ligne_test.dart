import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/client/client_paiement_en_ligne.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/paiement_en_ligne_pro.dart';

// Paiement en ligne des factures (Stripe Connect) : bouton « Payer » de
// l'app Koji et carte « Paiement en ligne » de Koji Pro. Aucun appel réel :
// le site et le navigateur sont simulés.

void _revenir(WidgetTester tester) {
  for (final s in [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(s);
  }
}

Widget _app(List<Override> overrides, Widget child) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: KojiTheme.light(),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

void main() {
  group('Koji · « Payer »', () {
    const aPayer = {
      'titre': 'À payer avant le 20 décembre',
      'montant': '2 515,00 €',
      'factureId': 'f2',
      'payer': {
        'libelle': 'Payer 2 515,00 €',
        'mention':
            'Paiement par carte ou virement, sécurisé par notre prestataire.',
      },
    };

    testWidgets("absent quand le site ne le propose pas", (tester) async {
      await tester
          .pumpWidget(_app([], const ClPayer(aPayer: {'factureId': 'f2'})));
      expect(find.byType(ClBouton), findsNothing);
    });

    testWidgets('ouvre le paiement de la facture, puis recharge au retour',
        (tester) async {
      final payes = <String>[];
      var retours = 0;
      await tester.pumpWidget(_app([
        clientPayerEnLigneProvider
            .overrideWithValue((id) async => payes.add(id)),
      ], ClPayer(aPayer: aPayer, onRetour: () => retours++)));
      expect(find.text('Payer 2 515,00 €'), findsOneWidget);
      expect(
          find.text(
              'Paiement par carte ou virement, sécurisé par notre prestataire.'),
          findsOneWidget);

      // Retour au premier plan sans paiement lancé : rien à recharger.
      _revenir(tester);
      expect(retours, 0);

      await tester.tap(find.text('Payer 2 515,00 €'));
      await tester.pumpAndSettle();
      expect(payes, ['f2']);
      _revenir(tester);
      await tester.pump();
      expect(retours, 1);
    });
  });

  group('Koji Pro · Paiement en ligne', () {
    Map<String, dynamic> vue(String etat,
            {bool actif = false,
            Map<String, dynamic>? action,
            bool tableau = false}) =>
        {
          'disponible': etat != 'indisponible',
          'etat': etat,
          'actif': actif,
          'detail': etat == 'actif'
              ? 'actif · vos clients paient leurs factures en ligne, l\'argent arrive sur votre compte'
              : "vérification d'identité de l'entreprise à l'activation · frais par paiement à fixer",
          'action': action,
          'tableau': tableau,
        };

    testWidgets("rien tant que le paiement en ligne n'est pas ouvert",
        (tester) async {
      await tester.pumpWidget(_app([
        paiementEnLigneProProvider
            .overrideWith((ref) async => vue('indisponible')),
      ], const PaiementEnLigneCarte()));
      await tester.pumpAndSettle();
      expect(find.text('Paiement en ligne'), findsNothing);
      expect(find.byType(Switch), findsNothing);
    });

    testWidgets(
        "à activer : commutateur éteint, l'inscription s'ouvre chez le prestataire",
        (tester) async {
      final actions = <String>[];
      final ouverts = <String>[];
      await tester.pumpWidget(_app([
        paiementEnLigneProProvider.overrideWith((ref) async => vue('a_activer',
                action: {
                  'id': 'inscription',
                  'libelle': 'Activer le paiement en ligne'
                })),
        paiementEnLigneActionProvider.overrideWithValue((a) async {
          actions.add(a);
          return {'url': 'https://connect.stripe.com/setup/e/acct_1/abc'};
        }),
        ouvrirLienPrestataireProvider.overrideWithValue((url) async {
          ouverts.add('$url');
          return true;
        }),
      ], const PaiementEnLigneCarte()));
      await tester.pumpAndSettle();
      expect(find.text('Paiement en ligne'), findsOneWidget);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
      expect(find.textContaining("vérification d'identité de l'entreprise"),
          findsOneWidget);
      await tester
          .tap(find.widgetWithText(KojiButton, 'Activer le paiement en ligne'));
      await tester.pumpAndSettle();
      expect(actions, ['inscription']);
      expect(ouverts, ['https://connect.stripe.com/setup/e/acct_1/abc']);
    });

    testWidgets(
        'actif (confirmé par Stripe) : commutateur allumé, mise en pause',
        (tester) async {
      final actions = <String>[];
      await tester.pumpWidget(_app([
        paiementEnLigneProProvider.overrideWith((ref) async => vue('actif',
            actif: true,
            action: {'id': 'pause', 'libelle': 'Mettre en pause'},
            tableau: true)),
        paiementEnLigneActionProvider.overrideWithValue((a) async {
          actions.add(a);
          return vue('suspendu',
              action: {'id': 'reprendre', 'libelle': 'Réactiver'},
              tableau: true);
        }),
      ], const PaiementEnLigneCarte()));
      await tester.pumpAndSettle();
      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
      expect(find.text('Tableau de bord du prestataire'), findsOneWidget);
      // Pause et reprise passent par le commutateur, sans bouton à part.
      expect(find.text('Mettre en pause'), findsNothing);
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(actions, ['pause']);
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    });
  });
}
