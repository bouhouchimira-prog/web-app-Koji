import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/auth/koji_auth_screen.dart';
import 'package:koji/features/auth/pro_forgot_password_screen.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';

// « Continuer avec Google » par le navigateur (13 nov) : le couple
// com.koji.pro + empreinte Play est bloqué dans un ancien projet Google
// inaccessible, la connexion native ne peut pas marcher.
User _user(Map<String, dynamic> appMetadata) => User(
      id: 'u1',
      appMetadata: appMetadata,
      userMetadata: const {},
      aud: 'authenticated',
      createdAt: '2026-11-13T00:00:00Z',
    );

void main() {
  test('une adresse de retour par app, jamais la même', () {
    expect(googleRedirectFor(isPro: true), 'com.koji.pro://login-callback');
    expect(
        googleRedirectFor(isPro: false), 'com.koji.client://login-callback');
  });

  test('Android sait ouvrir ces adresses (schéma = identifiant de l\'app)',
      () {
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(
        manifest,
        contains(
            '<data android:scheme="\${applicationId}" android:host="login-callback" />'));
    final gradle = File('android/app/build.gradle.kts').readAsStringSync();
    for (final id in ['com.koji.pro', 'com.koji.client']) {
      expect(gradle, contains('applicationId = "$id"'));
    }
  });

  test('pas de permission de paiement Google Play (rien à vendre dans l\'app)',
      () {
    // Play refusait la version 73 : BILLING seule = ancien paiement « AIDL ».
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(
        manifest,
        contains(
            '<uses-permission android:name="com.android.vending.BILLING" tools:node="remove"/>'));
    expect(
        RegExp(r'<uses-permission android:name="com\.android\.vending\.BILLING"\s*/>')
            .hasMatch(manifest),
        isFalse);
  });

  group('profil après Google', () {
    test('pas de ligne : on la crée', () {
      expect(googleProfileAction(null, true), GoogleProfileAction.create);
    });

    test('type différent de l\'app : on l\'aligne', () {
      expect(googleProfileAction({'is_pro': true}, false),
          GoogleProfileAction.setIsPro);
      expect(googleProfileAction({'is_pro': false}, true),
          GoogleProfileAction.setIsPro);
      expect(googleProfileAction(<String, dynamic>{}, true),
          GoogleProfileAction.setIsPro);
    });

    test('déjà bon : rien', () {
      expect(googleProfileAction({'is_pro': true}, true),
          GoogleProfileAction.none);
      expect(googleProfileAction({'is_pro': false}, false),
          GoogleProfileAction.none);
    });
  });

  test('compte avec une identité Google', () {
    expect(
        hasGoogleIdentity(_user({
          'provider': 'email',
          'providers': ['email', 'google']
        })),
        isTrue);
    expect(hasGoogleIdentity(_user({'provider': 'google'})), isTrue);
    expect(
        hasGoogleIdentity(_user({
          'provider': 'email',
          'providers': ['email']
        })),
        isFalse);
  });

  test('session arrivée par le lien de retour : on ouvre le compte', () {
    // Déconnecté → connecté (retour de Google, même après redémarrage).
    expect(sessionVientDArriver(const AsyncData<User?>(null)), isTrue);
    // Démarrage (restauration de session) ou connexion en cours : non.
    expect(sessionVientDArriver(const AsyncLoading<User?>()), isFalse);
    expect(sessionVientDArriver(null), isFalse);
    expect(sessionVientDArriver(AsyncData<User?>(_user(const {}))), isFalse);
  });

  test('mot de passe oublié : l\'app dit qui elle est', () {
    expect(demandeLienReinitialisation('a@b.fr', isClient: true), {
      'email': 'a@b.fr',
      'accountType': 'entreprise',
      'app': 'koji',
    });
    expect(demandeLienReinitialisation('a@b.fr', isClient: false)['app'],
        'pro');
  });

  test('échec à l\'ouverture : message qui propose l\'e-mail', () {
    expect(authErrorMessage(GoogleSignInFailure(Exception('x'))),
        googleSignInFailedMessage);
  });
}
