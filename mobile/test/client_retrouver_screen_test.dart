import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/testing.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/screens/client_retrouver_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

import 'client_charte_support.dart';

// « Retrouver mon projet » (maquette CLI-05) : e-mail, puis code à 6
// chiffres. Le site est simulé ; jamais de différence de message selon que
// l'adresse existe ou non.

/// Site simulé : note les demandes, accepte le code [bon].
class _ApiCode extends KojiWebApiClient {
  _ApiCode({this.erreurEnvoi = false})
      : super(httpClient: MockClient((r) async => fail('réseau : ${r.url}')));

  static const bon = '730512';
  final bool erreurEnvoi;
  final demandes = <String>[];
  final essais = <String>[];
  bool connecte = false;

  @override
  bool get isLoggedIn => connecte;

  @override
  Future<void> demanderCodeParticulier(String email) async {
    demandes.add(email);
    if (erreurEnvoi) throw KojiWebApiException(500, 'Erreur serveur (500).');
  }

  @override
  Future<Map<String, dynamic>> connexionParCode({required String email, required String code}) async {
    essais.add('$email:$code');
    if (code != bon) throw KojiWebApiException(401, 'Code incorrect ou expiré.');
    connecte = true;
    return {'kind': 'client', 'account': {'id': 'u1', 'email': email}};
  }
}

Widget _app(_ApiCode api) {
  Widget arrivee(GoRouterState s) => Scaffold(body: Text('→ ${s.uri}'));
  final router = GoRouter(
    initialLocation: '/client/marketplace/login',
    routes: [
      GoRoute(path: '/client/marketplace/login', builder: (_, __) => const ClientRetrouverScreen()),
      for (final c in ['/client-home', '/client/connexion']) GoRoute(path: c, builder: (_, s) => arrivee(s)),
    ],
  );
  return ProviderScope(
    overrides: [
      kojiWebApiClientProvider.overrideWithValue(api),
      clientProjetsProvider.overrideWith((ref) async => {}),
      clientNotificationsProvider.overrideWith((ref) async => []),
    ],
    child: MaterialApp.router(debugShowCheckedModeBanner: false, theme: KojiTheme.light(), routerConfig: router),
  );
}

Future<void> _demanderCode(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextField), email);
  await tester.pump();
  await tester.tap(find.text('Recevoir un code'));
  await tester.pump();
  await tester.pump();
}

void main() {
  setUpAll(chargerPolicesClient);

  testWidgets('écran d\'entrée : e-mail, un bouton, le mot de passe en lien secondaire',
      (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(_ApiCode()));
    await tester.pumpAndSettle();

    expect(find.text('Retrouver mon projet'), findsOneWidget);
    expect(find.text('Adresse e-mail'), findsOneWidget);
    expect(find.text('Décrire un projet'), findsOneWidget);
    final bouton = tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Recevoir un code'));
    expect(bouton.onPressed, isNull);
    // Pas de téléphone ni de SMS : le code arrive par e-mail.
    expect(find.textContaining('SMS'), findsNothing);
    expect(find.textContaining('Téléphone'), findsNothing);

    await tester.tap(find.text('Se connecter avec un mot de passe'));
    await tester.pumpAndSettle();
    expect(find.text('→ /client/connexion'), findsOneWidget);
  });

  testWidgets('adresse invalide : message, rien n\'est envoyé', (tester) async {
    cadreTelephone(tester);
    final api = _ApiCode();
    await tester.pumpWidget(_app(api));
    await _demanderCode(tester, 'sophie');
    expect(api.demandes, isEmpty);
    expect(find.text("Saisissez l'adresse e-mail donnée en publiant votre demande."), findsOneWidget);
  });

  testWidgets('après l\'envoi : toujours le même message, adresse masquée, renvoi après 60 s',
      (tester) async {
    cadreTelephone(tester);
    final api = _ApiCode();
    await tester.pumpWidget(_app(api));
    await _demanderCode(tester, ' Sophie.Lefevre@Exemple.fr ');

    expect(api.demandes, ['Sophie.Lefevre@Exemple.fr']);
    expect(find.text('Code reçu'), findsOneWidget);
    expect(find.text('envoyé à s••••@••••.fr'), findsOneWidget);
    expect(find.textContaining('lefevre'), findsNothing);
    expect(find.text(messageCodeEnvoye), findsOneWidget);
    expect(find.textContaining('renvoyer dans 60 s', findRichText: true), findsOneWidget);
    expect(tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Ouvrir mon projet')).onPressed, isNull);

    await tester.pump(const Duration(seconds: 61));
    expect(find.text('renvoyer'), findsOneWidget);
    await tester.tap(find.text('renvoyer'));
    await tester.pump();
    await tester.pump();
    expect(api.demandes, hasLength(2));
    expect(find.text('Nouveau code envoyé. Le précédent ne fonctionne plus.'), findsOneWidget);
    // Même message, qu'une adresse existe ou non : le site ne le dit pas.
    expect(find.text(messageCodeEnvoye), findsOneWidget);

    await tester.tap(find.text("changer d'adresse"));
    await tester.pumpAndSettle();
    expect(find.text('Adresse e-mail'), findsOneWidget);
  });

  testWidgets('code faux : erreur du site, champ vidé ; bon code : session et Vos projets',
      (tester) async {
    cadreTelephone(tester);
    final api = _ApiCode();
    await tester.pumpWidget(_app(api));
    await _demanderCode(tester, 'sophie@exemple.fr');

    await tester.enterText(find.byType(TextField), '12a34x56');
    await tester.pump();
    // Chiffres seulement, six au plus.
    expect(find.text('1'), findsOneWidget);
    expect(tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Ouvrir mon projet')).onPressed, isNotNull);
    await tester.tap(find.text('Ouvrir mon projet'));
    await tester.pump();
    await tester.pump();
    expect(api.essais, ['sophie@exemple.fr:123456']);
    expect(find.text('Code incorrect ou expiré.'), findsOneWidget);
    expect(tester.widget<ClBouton>(find.widgetWithText(ClBouton, 'Ouvrir mon projet')).onPressed, isNull);

    await tester.enterText(find.byType(TextField), '730512');
    await tester.pump();
    await tester.tap(find.text('Ouvrir mon projet'));
    await tester.pumpAndSettle();
    expect(api.essais.last, 'sophie@exemple.fr:730512');
    expect(api.isLoggedIn, isTrue);
    expect(find.text('→ /client-home'), findsOneWidget);
  });

  testWidgets('panne d\'envoi : message réseau, on reste sur l\'e-mail', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(_ApiCode(erreurEnvoi: true)));
    await _demanderCode(tester, 'sophie@exemple.fr');
    expect(find.text("L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez."), findsOneWidget);
    expect(find.text('Adresse e-mail'), findsOneWidget);
  });

  testWidgets('image de référence : Retrouver mon projet', (tester) async {
    cadreTelephone(tester);
    await tester.pumpWidget(_app(_ApiCode()));
    await tester.pumpAndSettle();
    await expectLater(find.byType(ClientRetrouverScreen), matchesGoldenFile('goldens/cli05_retrouver.png'));
    expect(tester.takeException(), isNull);
  });
}
