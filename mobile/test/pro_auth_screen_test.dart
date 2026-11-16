import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/features/auth/koji_auth_screen.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';

// Écran de compte de l'app Koji Pro (maquette PRO-00) : rendu téléphone de
// la connexion et de l'inscription, et règles de l'inscription (case des
// conditions obligatoire, SIREN de 9 chiffres, 8 caractères).
class _AucuneSession extends StateNotifier<AsyncValue<User?>>
    implements AuthNotifier {
  _AucuneSession() : super(const AsyncValue.data(null));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

Future<void> _ouvrir(WidgetTester tester, KojiAuthTab onglet) async {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [authProvider.overrideWith((ref) => _AucuneSession())],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      home: KojiAuthScreen(initialTab: onglet),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    KojiAppConfig.kind; // saveur par défaut : entreprise (Koji Pro)
    await _chargerDmSans();
  });

  testWidgets('connexion', (tester) async {
    await _ouvrir(tester, KojiAuthTab.login);
    expect(find.text('Se connecter'), findsWidgets);
    expect(find.text('Mot de passe oublié ?'), findsOneWidget);
    expect(
        find.textContaining('Entrer avec mon identifiant', findRichText: true),
        findsOneWidget);
    await expectLater(find.byType(KojiAuthScreen),
        matchesGoldenFile('goldens/pro_auth_login.png'));
  });

  testWidgets('iPhone : « Continuer avec Apple » au-dessus de Google',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    try {
      await _ouvrir(tester, KojiAuthTab.login);
      final apple = find.text('Continuer avec Apple');
      final google = find.text('Continuer avec Google');
      expect(apple, findsOneWidget);
      expect(google, findsOneWidget);
      expect(tester.getTopLeft(apple).dy, lessThan(tester.getTopLeft(google).dy));
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('Android : Google seulement, pas d\'Apple', (tester) async {
    await _ouvrir(tester, KojiAuthTab.login);
    expect(find.text('Continuer avec Google'), findsOneWidget);
    expect(find.text('Continuer avec Apple'), findsNothing);
  });

  testWidgets('inscription', (tester) async {
    await _ouvrir(tester, KojiAuthTab.signup);
    expect(find.text('Compte entreprise, gratuit'), findsOneWidget);
    expect(find.text('SIREN · facultatif maintenant'), findsOneWidget);
    await expectLater(find.byType(KojiAuthScreen),
        matchesGoldenFile('goldens/pro_auth_signup.png'));
  });

  testWidgets("l'inscription exige la case des conditions et un SIREN valide",
      (tester) async {
    await _ouvrir(tester, KojiAuthTab.signup);
    final champs = find.byType(TextField);
    await tester.enterText(champs.at(0), 'nouveau@exemple.fr');
    await tester.enterText(champs.at(1), 'court');
    await tester.pump();
    await tester.tap(find.text('Créer mon compte'));
    await tester.pump();
    expect(find.text('Le mot de passe doit contenir au moins 8 caractères.'),
        findsOneWidget);

    await tester.enterText(champs.at(1), 'motdepasse1');
    await tester.enterText(champs.at(2), '1234');
    await tester.pump();
    await tester.tap(find.text('Créer mon compte'));
    await tester.pump();
    expect(
        find.text(
            'Le SIREN fait 9 chiffres. Vous pouvez aussi le laisser vide.'),
        findsOneWidget);

    await tester.enterText(champs.at(2), '992 204 651');
    await tester.pump();
    await tester.tap(find.text('Créer mon compte'));
    await tester.pump();
    expect(
        find.text("Cochez la case pour accepter les conditions d'utilisation."),
        findsOneWidget);
  });
}
