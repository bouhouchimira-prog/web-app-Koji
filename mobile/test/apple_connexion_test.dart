import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';

// « Se connecter avec Apple » sur iPhone (14 nov) : obligatoire dès qu'une
// autre connexion sociale (Google) est proposée (App Store, règle 4.8).
void main() {
  group('boutons proposés selon l\'appareil', () {
    test('iPhone : Apple d\'abord, puis Google', () {
      expect(fournisseursConnexion(web: false, platform: TargetPlatform.iOS),
          ['apple', 'google']);
    });
    test('Android : Google seulement', () {
      expect(
          fournisseursConnexion(web: false, platform: TargetPlatform.android),
          ['google']);
    });
    test('web : aucun (le site a ses propres boutons)', () {
      expect(fournisseursConnexion(web: true, platform: TargetPlatform.iOS),
          isEmpty);
    });
  });

  group('jeton à usage unique (nonce)', () {
    test('32 caractères sûrs, différent à chaque fois', () {
      final a = nonceAleatoire();
      final b = nonceAleatoire();
      expect(a, hasLength(32));
      expect(RegExp(r'^[0-9A-Za-z\-._]{32}$').hasMatch(a), isTrue);
      expect(a, isNot(b));
      expect(nonceAleatoire(Random(1)), nonceAleatoire(Random(1)));
    });
    test('Apple reçoit son empreinte SHA-256', () {
      expect(sha256Hex('abc'),
          'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });

  test('nom donné par Apple (première connexion seulement)', () {
    expect(nomApple('Imed', 'Lachiheb'), 'Imed Lachiheb');
    expect(nomApple(' Imed ', null), 'Imed');
    expect(nomApple(null, null), isNull);
    expect(nomApple('', ' '), isNull);
  });

  test('échec Apple : message qui propose l\'e-mail', () {
    expect(authErrorMessage(AppleSignInFailure(Exception('x'))),
        appleSignInFailedMessage);
    expect(appleSignInFailedMessage, contains('Mot de passe oublié'));
  });

  test('compte avec une identité Apple', () {
    User user(Map<String, dynamic> meta) => User(
          id: 'u1',
          appMetadata: meta,
          userMetadata: const {},
          aud: 'authenticated',
          createdAt: '2026-11-14T00:00:00Z',
        );
    expect(
        hasProviderIdentity(
            user({
              'provider': 'apple',
              'providers': ['apple']
            }),
            'apple'),
        isTrue);
    expect(hasProviderIdentity(user({'provider': 'email'}), 'apple'), isFalse);
  });

  test('iPhone : droit « Sign in with Apple » et adresse de retour Google', () {
    final droits = File('ios/Runner/Runner.entitlements').readAsStringSync();
    expect(droits, contains('<key>com.apple.developer.applesignin</key>'));
    expect(droits, contains('<string>Default</string>'));
    final info = File('ios/Runner/Info.plist').readAsStringSync();
    // com.koji.pro:// ou com.koji.client:// selon l'app (googleRedirectFor).
    expect(info, contains(r'<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>'));
  });
}
