import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/apps/client/client_paiement_en_ligne.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_paiements_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

import 'client_charte_support.dart';

// « Paiements » de tous les chantiers (maquette CLI-02), l'onglet de la
// barre du bas. Réponse de /api/client/paiements simulée. Aucun paiement en
// ligne : pas de bouton « Payer ».

Map<String, dynamic> _vue({bool vide = false, bool enLigne = false}) => {
      'groupes': vide
          ? []
          : [
              {
                'id': 'q_41',
                'titre': 'Salle de bain, Paris 10e',
                'entreprise': 'ABL Expert Renov',
                'lien': '/client/chantier/q_41?onglet=paiements',
                'paiements': {
                  'lignes': [
                    {'id': 'f1', 'titre': "Facture d'acompte KJ-2026-118", 'etat': 'paye', 'detail': 'payée le 9 nov.', 'montant': '1 739,56 €', 'pdf': '/api/client/factures/f1/pdf'},
                    {'id': 'f2', 'titre': 'Situation 1 KJ-2026-125', 'etat': 'a_payer', 'detail': 'à payer avant le 20 déc.', 'montant': '2 515,00 €', 'pdf': '/api/client/factures/f2/pdf'},
                    {'id': 'a-venir', 'titre': 'Reste à facturer', 'etat': 'a_venir', 'detail': 'facture de solde à venir', 'montant': '1 580,10 €', 'pdf': null},
                  ],
                  'aPayer': {
                    'titre': 'À payer avant le 20 décembre',
                    'montant': '2 515,00 €',
                    'detail': 'Situation 1 KJ-2026-125',
                    'pdf': '/api/client/factures/f2/pdf',
                    'factureId': 'f2',
                    if (enLigne)
                      'payer': {
                        'libelle': 'Payer 2 515,00 €',
                        'mention': 'Paiement par carte ou virement, sécurisé par notre prestataire.',
                      },
                  },
                  'retenue': "Retenue de garantie : 307,09 € (5 %) que vous gardez jusqu'au 4 décembre 2027, au cas où une réserve ne serait pas levée. L'entreprise vous la facture ensuite.",
                  'vide': '',
                  'note': '',
                },
              },
            ],
      'aPayer': vide ? 0 : 1,
      'vide': vide ? "Aucune facture pour le moment. Les factures de vos chantiers arrivent ici dès que l'entreprise les envoie." : '',
      'note': enLigne
          ? 'Carte ou virement, par notre prestataire de paiement agréé. Koji ne détient pas les fonds ; le reçu arrive dans Documents.'
          : 'Réglez par virement avec les coordonnées indiquées sur la facture. Koji ne reçoit pas les paiements.',
    };

List<Override> _overrides(DepotSimule depot, {bool connecte = true, List<String>? ouverts, List<String>? payes, PayerEnLigne? payer}) => [
      clientPayerEnLigneProvider.overrideWithValue(payer ??
          (factureId) async {
            payes?.add(factureId);
          }),
      kojiWebApiClientProvider.overrideWithValue(connecte ? ApiConnectee() : ApiDeconnectee()),
      marketplaceRepositoryProvider.overrideWithValue(depot),
      currentAccountProvider.overrideWith((ref) async => null),
      clientQuotesProvider.overrideWith((ref) async => []),
      clientNotificationsProvider.overrideWith((ref) async => []),
      clientOuvrirFichierProvider.overrideWithValue((chemin, titre) async {
        ouverts?.add('$chemin|$titre');
      }),
    ];

Widget _avecRouteur(List<Override> overrides) {
  Widget arrivee(GoRouterState s) => Scaffold(body: Text('→ ${s.uri}'));
  final router = GoRouter(
    initialLocation: '/client/paiements',
    routes: [
      GoRoute(path: '/client/paiements', builder: (_, __) => const ClientPaiementsScreen()),
      for (final c in ['/client/devis/:quoteId', '/client/marketplace/login'])
        GoRoute(path: c, builder: (_, s) => arrivee(s)),
    ],
  );
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(theme: KojiTheme.light(), routerConfig: router),
  );
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('regroupé par chantier : lignes, retenue, facture due, aucun « Payer »',
      (tester) async {
    cadreTelephone(tester);
    final ouverts = <String>[];
    final depot = DepotSimule(paiements: _vue());
    await tester.pumpWidget(_avecRouteur(_overrides(depot, ouverts: ouverts)));
    await tester.pumpAndSettle();

    expect(depot.appels, ['paiements']);
    expect(find.text('1 facture à payer'), findsOneWidget);
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
    expect(find.text('ABL Expert Renov'), findsOneWidget);
    expect(find.byType(ClLignePaiement), findsNWidgets(3));
    expect(find.textContaining('Retenue de garantie : 307,09 €'), findsOneWidget);
    expect(find.text('À payer avant le 20 décembre'), findsOneWidget);
    expect(find.textContaining('Payer'), findsNothing);
    expect(find.textContaining('Koji ne reçoit pas les paiements'), findsOneWidget);
    // Plusieurs chantiers possibles : le téléchargement est au trait.
    final telecharger = tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Télécharger la facture'));
    expect(telecharger.contour, isTrue);

    await tester.tap(find.text('Télécharger la facture'));
    await tester.pumpAndSettle();
    expect(ouverts, ['/api/client/factures/f2/pdf|Situation 1 KJ-2026-125']);

    await tester.tap(find.text('Voir le chantier'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/devis/q_41?onglet=paiements'), findsOneWidget);
  });

  testWidgets('aucune facture : le texte du site', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_overrides(DepotSimule(paiements: _vue(vide: true)))));
    await tester.pumpAndSettle();
    expect(find.textContaining('Aucune facture pour le moment.'), findsOneWidget);
    expect(find.byType(ClLignePaiement), findsNothing);
  });

  testWidgets('sans session du site : se connecter, sans appel', (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(paiements: _vue());
    await tester.pumpWidget(_avecRouteur(_overrides(depot, connecte: false)));
    await tester.pumpAndSettle();
    expect(depot.appels, isEmpty);
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/login'), findsOneWidget);
  });

  testWidgets('onglet Paiements de la barre du bas', (tester) async {
    cadreTelephone(tester);
    expect(paiementsPret, isTrue);
    expect(clientTabPaths, contains('/client/paiements'));
    expect(clientOngletDe('/client/paiements'), '/client/paiements');
  });

  testWidgets('paiement en ligne : « Payer » ouvre le prestataire, le retour recharge',
      (tester) async {
    cadreTelephone(tester);
    final payes = <String>[];
    final depot = DepotSimule(paiements: _vue(enLigne: true));
    await tester.pumpWidget(_avecRouteur(_overrides(depot, payes: payes)));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(ClBouton, 'Payer 2 515,00 €'), findsOneWidget);
    expect(find.text('Paiement par carte ou virement, sécurisé par notre prestataire.'), findsOneWidget);
    // Le montant n'est jamais envoyé : seulement la facture.
    await tester.ensureVisible(find.text('Payer 2 515,00 €'));
    await tester.tap(find.text('Payer 2 515,00 €'));
    await tester.pumpAndSettle();
    expect(payes, ['f2']);

    // Retour de la page de paiement : l'app revient au premier plan.
    final avant = depot.appels.length;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(depot.appels.length, avant + 1);
    expect(depot.appels.last, 'paiements');
  });

  testWidgets("paiement en ligne : l'erreur du site s'affiche", (tester) async {
    cadreTelephone(tester);
    final depot = DepotSimule(paiements: _vue(enLigne: true));
    await tester.pumpWidget(_avecRouteur(_overrides(depot,
        payer: (id) async => throw KojiWebApiException(409,
            "Le paiement en ligne n'est pas disponible pour cette facture : réglez par virement."))));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Payer 2 515,00 €'));
    await tester.tap(find.text('Payer 2 515,00 €'));
    await tester.pumpAndSettle();
    expect(find.textContaining("n'est pas disponible pour cette facture"), findsOneWidget);
  });

  testWidgets('image de référence : Paiements, cadre téléphone', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: _overrides(DepotSimule(paiements: _vue())),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: KojiTheme.light(),
        home: const ClientShell(location: '/client/paiements', child: ClientPaiementsScreen()),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(ClientBottomBar), findsOneWidget);
    await expectLater(find.byType(ClientShell), matchesGoldenFile('goldens/cli02_paiements.png'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('image de référence : Paiements avec « Payer », cadre téléphone', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(ProviderScope(
      overrides: _overrides(DepotSimule(paiements: _vue(enLigne: true))),
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: KojiTheme.light(),
        home: const ClientShell(location: '/client/paiements', child: ClientPaiementsScreen()),
      ),
    ));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientShell), matchesGoldenFile('goldens/cli02_paiements_en_ligne.png'));
    expect(tester.takeException(), isNull);
  });
}
