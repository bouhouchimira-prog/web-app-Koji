import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/features/auth/pro_forgot_password_screen.dart';

// Koji Pro, « Mot de passe oublié » (maquette PRO-00 / PRO-00.1) : rendu
// téléphone, envoi vers getkoji.io simulé, message identique qu'un compte
// existe ou non, erreur réseau signalée.
Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

Future<void> _ouvrir(WidgetTester tester, ProResetLinkSender send,
    {String email = ''}) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    debugShowCheckedModeBanner: false,
    home: ProForgotPasswordScreen(initialEmail: email, send: send),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(_chargerDmSans);

  test("masque l'e-mail comme le site", () {
    expect(masquerEmail('bilal@exemple.fr'), 'bil•••@exemple.fr');
    expect(masquerEmail('al@exemple.fr'), 'al•••@exemple.fr');
    expect(masquerEmail('pas-un-email'), '');
  });

  testWidgets('écran vide', (tester) async {
    await _ouvrir(tester, (_) async {});
    expect(find.text('on vous envoie un lien'), findsOneWidget);
    expect(
        find.text(
            'Si un compte existe, vous recevez un lien valable 30 minutes.'),
        findsOneWidget);
    await expectLater(find.byType(ProForgotPasswordScreen),
        matchesGoldenFile('goldens/pro_forgot_password.png'));
  });

  testWidgets('envoi : e-mail transmis en minuscules, confirmation masquée',
      (tester) async {
    final envoyes = <String>[];
    await _ouvrir(tester, (email) async => envoyes.add(email));
    await tester.enterText(find.byType(TextField), '  Bilal@Exemple.fr ');
    await tester.tap(find.text('Envoyer le lien'));
    await tester.pumpAndSettle();
    expect(envoyes, ['bilal@exemple.fr']);
    expect(find.text('Lien envoyé à bil•••@exemple.fr'), findsOneWidget);
    await expectLater(find.byType(ProForgotPasswordScreen),
        matchesGoldenFile('goldens/pro_forgot_password_sent.png'));
  });

  testWidgets("adresse invalide : rien n'est envoyé", (tester) async {
    var appels = 0;
    await _ouvrir(tester, (_) async => appels++);
    await tester.enterText(find.byType(TextField), 'bilal');
    await tester.tap(find.text('Envoyer le lien'));
    await tester.pumpAndSettle();
    expect(appels, 0);
    expect(find.text('Entrez une adresse e-mail valide.'), findsOneWidget);
  });

  testWidgets('réseau indisponible : erreur, pas de fausse confirmation',
      (tester) async {
    await _ouvrir(tester, (_) async => throw Exception('hors ligne'),
        email: 'bilal@exemple.fr');
    await tester.tap(find.text('Envoyer le lien'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Envoi impossible'), findsOneWidget);
    expect(find.textContaining('Lien envoyé'), findsNothing);
  });
}
