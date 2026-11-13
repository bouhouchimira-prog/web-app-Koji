import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';

// Retour testeur du 12 nov : connexion, inscription et mot de passe oublié
// « ne marchaient pas » et l'app ne disait que « Une erreur est survenue ».
User _user({required List<UserIdentity>? identities}) => User(
      id: 'u1',
      appMetadata: const {},
      userMetadata: const {},
      aud: 'authenticated',
      createdAt: '2026-11-12T00:00:00Z',
      email: 'imed@exemple.fr',
      identities: identities,
    );

UserIdentity _identity() => const UserIdentity(
      id: 'u1',
      userId: 'u1',
      identityData: {},
      identityId: 'i1',
      provider: 'email',
      createdAt: '2026-11-12T00:00:00Z',
      lastSignInAt: '2026-11-12T00:00:00Z',
    );

void main() {
  group('inscription avec une adresse déjà prise', () {
    test('Supabase répond sans erreur mais sans identité : adresse prise', () {
      expect(signUpAddressTaken(AuthResponse(user: _user(identities: []))),
          isTrue);
    });

    test('nouveau compte (une identité) : pas pris', () {
      expect(
          signUpAddressTaken(
              AuthResponse(user: _user(identities: [_identity()]))),
          isFalse);
    });

    test('réponse sans utilisateur ou sans liste : pas pris', () {
      expect(signUpAddressTaken(AuthResponse()), isFalse);
      expect(signUpAddressTaken(AuthResponse(user: _user(identities: null))),
          isFalse);
    });

    test('message clair, quelle que soit la forme de l\'erreur', () {
      expect(
          authErrorMessage(const AuthException(accountExistsMessage,
              code: 'user_already_exists')),
          accountExistsMessage);
      expect(authErrorMessage(const AuthException('User already registered')),
          accountExistsMessage);
    });
  });

  group('connexion Google', () {
    test('échec Google Android (ApiException 10) : message qui donne la sortie',
        () {
      final erreur = GoogleSignInFailure(PlatformException(
          code: 'sign_in_failed',
          message: 'com.google.android.gms.common.api.ApiException: 10: '));
      expect(authErrorMessage(erreur), googleSignInFailedMessage);
      expect(googleSignInFailedMessage, contains('Mot de passe oublié'));
    });

    test('jetons manquants : même message', () {
      expect(
          authErrorMessage(
              GoogleSignInFailure(Exception('Missing Google Auth Tokens'))),
          googleSignInFailedMessage);
    });
  });

  group('autres erreurs Supabase', () {
    test('identifiants et limite d\'envoi', () {
      expect(authErrorMessage(const AuthException('Invalid login credentials')),
          'E-mail ou mot de passe incorrect.');
      expect(
          authErrorMessage(const AuthException('email rate limit exceeded',
              code: 'over_email_send_rate_limit')),
          contains('Réessayez dans une heure'));
      expect(
          authErrorMessage(
              const AuthException('Error sending confirmation email')),
          contains('contact@getkoji.io'));
    });
  });
}
