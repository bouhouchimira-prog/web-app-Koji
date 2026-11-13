import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Shown when Google sign-in fails. Before, those errors (PlatformException,
/// missing tokens) fell through to « Une erreur est survenue », with no way
/// out for an account created with Google on the site.
const googleSignInFailedMessage =
    'La connexion avec Google n\'a pas abouti. Connectez-vous avec votre '
    'e-mail et un mot de passe ; si vous n\'en avez pas encore, touchez '
    '« Mot de passe oublié ? » pour en créer un.';

String authErrorMessage(Object error) {
  if (error is GoogleSignInFailure) return googleSignInFailedMessage;

  final rawMessage = error.toString();
  final message = error is AuthException ? error.message : rawMessage;
  final code = error is AuthException ? (error.code ?? '') : '';
  final normalized = message.toLowerCase();
  final rawNormalized = rawMessage.toLowerCase();

  if (normalized.contains('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }

  if (normalized.contains('email not confirmed')) {
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
  }

  if (code == 'user_already_exists' ||
      normalized.contains('user already registered')) {
    return accountExistsMessage;
  }

  if (code == 'over_email_send_rate_limit' ||
      normalized.contains('email rate limit exceeded')) {
    return "Trop d'e-mails envoyés à cette adresse. Réessayez dans une heure.";
  }

  if (normalized.contains('error sending')) {
    return "L'e-mail n'a pas pu partir. Réessayez plus tard, ou écrivez à "
        'contact@getkoji.io.';
  }

  if (rawNormalized.contains('authretryablefetchexception') ||
      rawNormalized.contains('clientexception') ||
      rawNormalized.contains('socketexception') ||
      rawNormalized.contains('failed host lookup') ||
      rawNormalized.contains('connection timed out') ||
      rawNormalized.contains('failed to fetch')) {
    return 'Connexion impossible. Verifiez votre connexion Internet puis reessayez.';
  }

  if (message.trim().isNotEmpty && !rawNormalized.contains('exception:')) {
    return message;
  }

  return 'Une erreur est survenue. Reessayez dans un instant.';
}

final authProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<User?>>((ref) {
  return AuthNotifier(
    ref.watch(authRepositoryProvider),
    ref.watch(userRepositoryProvider),
  );
});

/// What to do with the `users` row after a Google sign-in from an app.
enum GoogleProfileAction { create, setIsPro, none }

/// The profile row follows the app the person signed in from: created if
/// missing, is_pro aligned otherwise (same rule as before the browser flow).
GoogleProfileAction googleProfileAction(
    Map<String, dynamic>? profile, bool appIsPro) {
  if (profile == null) return GoogleProfileAction.create;
  final storedIsPro = profile['is_pro'] as bool? ?? false;
  return storedIsPro == appIsPro
      ? GoogleProfileAction.none
      : GoogleProfileAction.setIsPro;
}

/// True when the account has a Google identity.
bool hasGoogleIdentity(User user) {
  final providers = user.appMetadata['providers'];
  return (providers is List && providers.contains('google')) ||
      user.appMetadata['provider'] == 'google';
}

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthRepository _authRepository;
  final UserRepository _userRepository;
  final Logger _logger = Logger();

  /// Set when the Google button opened the browser; holds the app's isPro
  /// until the session comes back through the deep link.
  bool? _googlePendingIsPro;

  AuthNotifier(this._authRepository, this._userRepository)
      : super(const AsyncValue.loading()) {
    _logger.i('🔧 AuthNotifier initialized');
    _authRepository.authStateChanges.listen((authState) async {
      // Only update state when there is an active session.
      // During email-confirmation signup Supabase fires authStateChange with a
      // user object but NO session — we must ignore that event so the signup
      // screen can show the "check your email" dialog without being interrupted.
      final session = authState.session;
      final user = session?.user;
      if (user != null) {
        final pendingIsPro = _googlePendingIsPro;
        if (pendingIsPro != null &&
            authState.event == AuthChangeEvent.signedIn &&
            hasGoogleIdentity(user)) {
          _googlePendingIsPro = null;
          // Before routing: the screen reads the profile right after.
          await _reconcileGoogleProfile(user, pendingIsPro);
        }
        _logger.i('✅ Auth state changed: User logged in (session active)');
        state = AsyncValue.data(user);
      } else {
        _logger.i('🚪 Auth state changed: No active session');
        state = const AsyncValue.data(null);
      }
    }, onError: (Object error, StackTrace st) {
      // Error coming back from the Google page (refused, cancelled…).
      _logger.e('❌ Auth state error', error: error, stackTrace: st);
      final wasGoogle = _googlePendingIsPro != null;
      _googlePendingIsPro = null;
      state = AsyncValue.error(
          wasGoogle ? GoogleSignInFailure(error) : error, st);
    });
  }

  Future<void> _reconcileGoogleProfile(User user, bool isPro) async {
    try {
      final userDoc = await _userRepository.getUser(user.id);
      switch (googleProfileAction(userDoc, isPro)) {
        case GoogleProfileAction.create:
          _logger.i('💾 New Google user — saving to Supabase (isPro: $isPro)');
          await _userRepository.saveUser(user.id, user.email ?? '',
              isPro: isPro);
        case GoogleProfileAction.setIsPro:
          _logger.i('🔧 Reconciling is_pro for Google user → $isPro');
          await _userRepository.setIsPro(user.id, isPro);
        case GoogleProfileAction.none:
          _logger.i('✅ Google user — is_pro already correct');
      }
    } catch (e, st) {
      // Never blocks the sign-in: the profile is completed later.
      _logger.e('❌ Google profile reconciliation failed',
          error: e, stackTrace: st);
    }
  }

  Future<void> signInWithEmailAndPassword(String email, String password) async {
    _logger.i('🔐 Attempting email/password sign in');
    _googlePendingIsPro = null;
    state = const AsyncValue.loading();
    try {
      await _authRepository.signInWithEmailAndPassword(
          email: email, password: password);
      _logger.i('✅ Email/password sign in successful');
    } catch (e, st) {
      _logger.e('❌ Email/password sign in failed', error: e, stackTrace: st);
      state = AsyncValue.error(e, st);
    }
  }

  Future<bool> signUpWithEmailAndPassword(String email, String password,
      {bool isPro = false}) async {
    _logger.i('📝 Attempting email/password signup (isPro: $isPro)');
    _googlePendingIsPro = null;
    state = const AsyncValue.loading();
    try {
      final response = await _authRepository.createUserWithEmailAndPassword(
          email: email, password: password, isPro: isPro);
      _logger.i('✅ Supabase Auth account created');

      // The DB trigger handle_new_user() inserts the row into public.users
      // automatically on auth.users INSERT — no client-side insert needed.
      // Attempting it here would fail RLS because the session is null until
      // the user clicks the confirmation email.

      if (response.session == null) {
        _logger
            .i('📧 Email confirmation required — trigger will create user row');
        state = const AsyncValue.data(null);
        return true;
      }

      return false;
    } catch (e, st) {
      _logger.e('❌ Signup failed', error: e, stackTrace: st);
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Opens Google in the browser. No loading state: if the person closes the
  /// browser, nothing comes back and the screen must stay usable. The session
  /// (and the profile reconciliation) arrives in the listener above.
  ///
  /// Reconciliation, as before: Google sign-in carries no is_pro metadata,
  /// so the row is aligned with the app the person signed in from — without
  /// it, Koji Pro Google users got routed to /client-home on every cold start.
  Future<void> signInWithGoogle({bool isPro = false}) async {
    _logger.i('🔍 Attempting Google Sign-In (isPro: $isPro)');
    _googlePendingIsPro = isPro;
    try {
      await _authRepository.signInWithGoogle(isPro: isPro);
    } catch (e, st) {
      _googlePendingIsPro = null;
      _logger.e('❌ Google Sign-In failed', error: e, stackTrace: st);
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> signOut() async {
    _logger.i('🚪 Signing out user');
    try {
      await _authRepository.signOut();
      _logger.i('✅ Sign out successful');
    } catch (e, st) {
      _logger.e('❌ Sign out failed', error: e, stackTrace: st);
    }
  }
}
