import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

String authErrorMessage(Object error) {
  final rawMessage = error.toString();
  final message = error is AuthException ? error.message : rawMessage;
  final normalized = message.toLowerCase();
  final rawNormalized = rawMessage.toLowerCase();

  if (normalized.contains('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }

  if (normalized.contains('email not confirmed')) {
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
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

class AuthNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthRepository _authRepository;
  final UserRepository _userRepository;
  final Logger _logger = Logger();

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
        _logger.i('✅ Auth state changed: User logged in (session active)');
        state = AsyncValue.data(user);
      } else {
        _logger.i('🚪 Auth state changed: No active session');
        state = const AsyncValue.data(null);
      }
    });
  }

  Future<void> signInWithEmailAndPassword(String email, String password) async {
    _logger.i('🔐 Attempting email/password sign in');
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

  Future<void> signInWithGoogle({bool isPro = false}) async {
    _logger.i('🔍 Attempting Google Sign-In (isPro: $isPro)');
    state = const AsyncValue.loading();
    try {
      final response = await _authRepository.signInWithGoogle();
      final user = response?.user;
      if (user != null) {
        _logger.i('✅ Google Sign-In successful');

        // Reconcile the users row with the requested account type.
        // The DB trigger handle_new_user() inserts the row with is_pro
        // pulled from raw_user_meta_data, but Google sign-in via
        // signInWithIdToken does NOT pass any metadata, so the trigger
        // ends up writing the default (is_pro=false) for entreprise
        // Google users. Without this reconciliation, those users get
        // routed to /client-home on every cold start.
        _logger.i('🔍 Checking if user exists in Supabase');
        final userDoc = await _userRepository.getUser(user.id);
        if (userDoc == null) {
          _logger.i('💾 New Google user — saving to Supabase (isPro: $isPro)');
          await _userRepository.saveUser(user.id, user.email ?? '',
              isPro: isPro);
          _logger.i('✅ New Google user saved to Supabase');
        } else {
          final storedIsPro = userDoc['is_pro'] as bool? ?? false;
          if (storedIsPro != isPro) {
            _logger.i(
                '🔧 Reconciling is_pro for existing Google user: $storedIsPro → $isPro');
            await _userRepository.setIsPro(user.id, isPro);
          } else {
            _logger.i('✅ Existing Google user — is_pro already correct');
          }
        }
      } else {
        _logger.w('⚠️ Google Sign-In cancelled by user');
      }
    } catch (e, st) {
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
