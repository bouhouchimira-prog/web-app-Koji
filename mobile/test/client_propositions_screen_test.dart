import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/screens/client_propositions_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

import 'client_charte_support.dart';

// « Propositions reçues » (maquette CLI-01). Réponse du site simulée, rien
// ne part sur le réseau. Aucun prix n'est calculé dans l'app.

Map<String, dynamic> _proposition(String id, String nom, String prix,
        {String note = '', String type = 'rdv', String de = '', String? lien}) =>
    {
      'entrepriseId': id,
      'nom': nom,
      'prix': prix,
      'prixNote': note,
      'resume': ['4,8 · 27 avis · début possible le 12 nov. · 18 jours', 'visite faite le 24 oct.'],
      'action': {
        'type': type,
        'libelle': type == 'signer' ? 'Voir et signer' : 'Prendre rendez-vous',
        'principale': type == 'signer',
        'lien': lien ?? '/client/radar/radar-17?entreprise=$id',
      },
      'voir': 'Voir la proposition $de',
    };

Map<String, dynamic> _vue({bool vide = false, bool aSigner = false}) => {
      'projet': {'id': 'radar-17', 'titre': 'Salle de bain, Paris 10e', 'etat': 'a_choisir'},
      'titre': vide ? 'Aucune proposition' : '3 propositions',
      'propositions': vide
          ? <Map<String, dynamic>>[]
          : [
              aSigner
                  // « Voir et signer » : le lien du site mène toujours à
                  // /client/chantier/{quoteId} (commit e8691a3).
                  ? _proposition('u1', 'ABL Expert Renov', '6 034,82 €',
                      type: 'signer', de: "d'ABL Expert Renov", lien: '/client/chantier/q_41')
                  : _proposition('u1', 'ABL Expert Renov', '6 034,82 €', type: 'voir', de: "d'ABL Expert Renov"),
              _proposition('u2', 'Rénov Est', '5 650,00 €', note: 'estimation avant visite', de: 'de Rénov Est'),
              _proposition('u3', 'Atelier Bain', 'à venir', de: "d'Atelier Bain"),
            ],
      'vide': vide ? "Aucune entreprise n'a encore répondu. Vous serez prévenu dès la première proposition." : '',
      'note': "Koji met en relation ; chaque devis est établi et signé avec l'entreprise. "
          'Les entreprises sont classées par date de réponse, pas par paiement.',
    };

List<Override> _donnees({bool vide = false, bool connecte = true, bool aSigner = false}) => [
      kojiWebApiClientProvider
          .overrideWithValue(connecte ? ApiConnectee() : ApiDeconnectee()),
      clientPropositionsProvider('radar-17').overrideWith((ref) async => _vue(vide: vide, aSigner: aSigner)),
    ];

Widget _avecRouteur(List<Override> overrides) {
  Widget arrivee(GoRouterState s) => Scaffold(body: Text('→ ${s.uri}'));
  final router = GoRouter(
    initialLocation: '/client/projet/radar-17',
    routes: [
      GoRoute(
        path: '/client/projet/:offerId',
        builder: (_, s) => ClientPropositionsScreen(offerId: s.pathParameters['offerId']!),
      ),
      for (final chemin in ['/client/marketplace/:offerId', '/client/marketplace/login', '/client-home', '/client/devis/:quoteId'])
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

  testWidgets('une carte par entreprise dans l’ordre du site, la première choisie',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees()));
    await tester.pumpAndSettle();

    expect(find.text('3 propositions'), findsOneWidget);
    expect(find.text('Salle de bain, Paris 10e'), findsOneWidget);
    expect(find.byType(ClCarteOffre), findsNWidgets(3));
    final noms = tester.widgetList<ClCarteOffre>(find.byType(ClCarteOffre)).map((c) => c.nom).toList();
    expect(noms, ['ABL Expert Renov', 'Rénov Est', 'Atelier Bain']);
    expect(tester.widgetList<ClCarteOffre>(find.byType(ClCarteOffre)).map((c) => c.choisie).toList(),
        [true, false, false]);
    expect(find.text('6 034,82 €'), findsOneWidget);
    expect(find.text('estimation avant visite'), findsOneWidget);
    expect(find.text('à venir'), findsOneWidget);
    expect(find.textContaining('classées par date de réponse'), findsOneWidget);
    expect(find.text("Voir la proposition d'ABL Expert Renov"), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('choisir une autre carte change le bouton, qui ouvre la demande',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Rénov Est'));
    await tester.pumpAndSettle();
    expect(find.text('Voir la proposition de Rénov Est'), findsOneWidget);
    expect(find.text("Voir la proposition d'ABL Expert Renov"), findsNothing);

    await tester.tap(find.text('Voir la proposition de Rénov Est'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/radar-17'), findsOneWidget);
  });

  testWidgets('« Voir et signer » vers /client/chantier/{id} : la page du devis dans l\'app',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees(aSigner: true)));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Voir la proposition d'ABL Expert Renov"));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/devis/q_41'), findsOneWidget);
  });

  testWidgets('aucune proposition : le texte du site, pas de bouton', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees(vide: true)));
    await tester.pumpAndSettle();

    expect(find.text('Aucune proposition'), findsOneWidget);
    expect(find.textContaining("Aucune entreprise n'a encore répondu"), findsOneWidget);
    expect(find.byType(ClCarteOffre), findsNothing);
    expect(find.byType(ClBouton), findsNothing);
  });

  testWidgets('sans session du site : vers la connexion', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees(connecte: false)));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/marketplace/login'), findsOneWidget);
  });

  testWidgets('image de référence : propositions reçues', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_avecRouteur(_donnees()));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientPropositionsScreen),
        matchesGoldenFile('goldens/cli01_propositions.png'));
    expect(tester.takeException(), isNull);
  });
}
