import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:logger/logger.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/core/supabase_config.dart';

/// Shown when sign-up is attempted with an address that already has an
/// account (see [signUpAddressTaken]).
const accountExistsMessage =
    'Un compte existe déjà avec cette adresse. Connectez-vous, ou touchez '
    '« Mot de passe oublié ? » pour choisir un nouveau mot de passe.';

/// True when Supabase answered a sign-up for an address that is already
/// registered: no error, but a user without any identity, and no e-mail sent.
bool signUpAddressTaken(AuthResponse response) {
  final identities = response.user?.identities;
  return identities != null && identities.isEmpty;
}

/// Google sign-in failed (Google itself, missing tokens, or Supabase refusing
/// the token). Kept apart so the message can point to e-mail + password.
class GoogleSignInFailure implements Exception {
  const GoogleSignInFailure(this.cause);
  final Object cause;

  @override
  String toString() => 'GoogleSignInFailure($cause)';
}

/// Sign in with Apple failed (not a cancellation by the person).
class AppleSignInFailure implements Exception {
  const AppleSignInFailure(this.cause);
  final Object cause;

  @override
  String toString() => 'AppleSignInFailure($cause)';
}

/// Social sign-ins offered on this device, in display order (14 nov 2026).
/// iPhone: Apple first, then Google — App Store guideline 4.8 requires Sign
/// in with Apple as soon as another social login is offered. Android: Google
/// (browser). Web: none, the website has its own buttons.
List<String> fournisseursConnexion(
    {required bool web, required TargetPlatform platform}) {
  if (web) return const [];
  if (platform == TargetPlatform.iOS) return const ['apple', 'google'];
  return const ['google'];
}

/// Random value for Sign in with Apple: Apple gets its SHA-256, Supabase the
/// raw value and checks both match, so a stolen Apple token can't be replayed.
String nonceAleatoire([Random? random]) {
  const chars =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  final r = random ?? Random.secure();
  return List.generate(32, (_) => chars[r.nextInt(chars.length)]).join();
}

String sha256Hex(String value) => sha256.convert(utf8.encode(value)).toString();

/// « Prénom Nom » from Apple, given only at the very first authorization.
String? nomApple(String? prenom, String? nom) {
  final complet =
      [prenom, nom].whereType<String>().map((s) => s.trim()).join(' ').trim();
  return complet.isEmpty ? null : complet;
}

/// Where Google sends the user back after signing in: one address per app
/// (its package name), so Android never asks « open with Koji or Koji Pro? ».
/// Declared in AndroidManifest.xml (scheme ${applicationId}) and to be listed
/// in Supabase → Authentication → URL Configuration → Redirect URLs.
String googleRedirectFor({required bool isPro}) =>
    isPro ? 'com.koji.pro://login-callback' : 'com.koji.client://login-callback';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(SupabaseConfig.client);
});

class AuthRepository {
  final SupabaseClient _supabase;
  final Logger _logger = Logger();

  AuthRepository(this._supabase);

  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  User? get currentUser => _supabase.auth.currentUser;

  Future<AuthResponse> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    _logger.i('🔑 [AuthRepository] Calling Supabase signInWithPassword');
    try {
      final result = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      _logger.i('✅ [AuthRepository] Supabase signInWithPassword successful');
      return result;
    } catch (e) {
      _logger.e('❌ [AuthRepository] Supabase signInWithPassword failed',
          error: e);
      rethrow;
    }
  }

  Future<AuthResponse> createUserWithEmailAndPassword({
    required String email,
    required String password,
    bool isPro = false,
  }) async {
    _logger.i('📝 [AuthRepository] Calling Supabase signUp');
    try {
      final result = await _supabase.auth.signUp(
        email: email,
        password: password,
        // Le lien de confirmation ramène sur getkoji.io (avant : koji-admin,
        // l'outil d'administration, qui n'a rien à montrer à un utilisateur).
        emailRedirectTo: isPro
            ? '${KojiWebApiConfig.baseUrl}/login?type=entreprise'
            : '${KojiWebApiConfig.baseUrl}/',
        // Pass isPro in user metadata so the DB trigger can read it
        data: {'is_pro': isPro},
      );
      // Adresse déjà inscrite : Supabase ne renvoie pas d'erreur (pour ne pas
      // révéler qui est inscrit) mais un compte sans identité, et n'envoie
      // aucun e-mail. L'app affichait « Vérifiez votre e-mail » pour rien.
      if (signUpAddressTaken(result)) {
        throw const AuthException(accountExistsMessage,
            code: 'user_already_exists');
      }
      _logger.i('✅ [AuthRepository] Supabase signUp successful');
      return result;
    } catch (e) {
      _logger.e('❌ [AuthRepository] Supabase signUp failed', error: e);
      rethrow;
    }
  }

  /// Google sign-in in the browser, like the website (13 nov 2026).
  ///
  /// The native Android picker (google_sign_in) needed an Android OAuth
  /// client for « com.koji.pro + Play signing SHA-1 » in our Google project;
  /// that pair is still held by an old project we cannot reach (koji-android),
  /// and Google allows it in one project only. The browser flow only uses the
  /// web client Supabase already has for the site.
  ///
  /// This only opens the Google page: the session arrives later through the
  /// [googleRedirectFor] deep link (handled by supabase_flutter), on
  /// [authStateChanges]. Errors are rethrown as [GoogleSignInFailure].
  Future<void> signInWithGoogle({required bool isPro}) async {
    _logger.i('🔍 [AuthRepository] Opening Google sign-in in the browser');
    try {
      final opened = await _supabase.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: googleRedirectFor(isPro: isPro),
        authScreenLaunchMode: LaunchMode.externalApplication,
      );
      if (!opened) throw Exception('Navigateur non ouvert');
    } catch (e) {
      _logger.e('❌ [AuthRepository] Google Sign-In failed', error: e);
      throw GoogleSignInFailure(e);
    }
  }

  /// Native Sign in with Apple (iPhone). Returns null when the person
  /// cancels the Apple sheet. Needs the « Sign In with Apple » capability on
  /// the App ID (Runner.entitlements) and both bundle ids in the Supabase
  /// Apple provider's Client IDs. Errors are rethrown as [AppleSignInFailure].
  Future<AuthResponse?> signInWithApple() async {
    _logger.i('🍏 [AuthRepository] Starting Sign in with Apple');
    final rawNonce = nonceAleatoire();
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: sha256Hex(rawNonce),
      );
      final idToken = credential.identityToken;
      if (idToken == null) throw Exception('Jeton Apple absent');
      final result = await _supabase.auth.signInWithIdToken(
        provider: OAuthProvider.apple,
        idToken: idToken,
        nonce: rawNonce,
      );
      // Apple only sends the name the first time: keep it on the account.
      final nom = nomApple(credential.givenName, credential.familyName);
      if (nom != null) {
        try {
          await _supabase.auth
              .updateUser(UserAttributes(data: {'full_name': nom, 'name': nom}));
        } catch (_) {
          // The name is a nicety; the sign-in itself succeeded.
        }
      }
      _logger.i('✅ [AuthRepository] Sign in with Apple successful');
      return result;
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        _logger.w('⚠️ [AuthRepository] Sign in with Apple cancelled');
        return null;
      }
      _logger.e('❌ [AuthRepository] Sign in with Apple failed', error: e);
      throw AppleSignInFailure(e);
    } catch (e) {
      _logger.e('❌ [AuthRepository] Sign in with Apple failed', error: e);
      throw AppleSignInFailure(e);
    }
  }

  /// Per-chantier client login: verify an access code + password against the
  /// `login_with_access_code` RPC. Returns the matching quote id, or null when
  /// the pair is invalid. This does NOT create a Supabase auth session — the
  /// client is taken straight to that quote's signature view.
  Future<String?> loginWithAccessCode({
    required String code,
    required String password,
  }) async {
    _logger.i('🔑 [AuthRepository] Verifying chantier access code');
    try {
      final result = await _supabase.rpc('login_with_access_code', params: {
        'p_code': code.trim(),
        'p_password': password,
      });
      // The RPC returns the quote uuid (text) or null.
      final quoteId = result?.toString();
      if (quoteId == null || quoteId.isEmpty || quoteId == 'null') {
        _logger.w('⚠️ [AuthRepository] Invalid chantier access credentials');
        return null;
      }
      _logger.i('✅ [AuthRepository] Chantier access granted: $quoteId');
      return quoteId;
    } catch (e) {
      _logger.e('❌ [AuthRepository] Chantier access login failed', error: e);
      rethrow;
    }
  }

  /// Per-worker login: verify a worker access code + password against the
  /// `login_worker_with_code` RPC. Returns the matching worker id, or null. Like
  /// the client login, no Supabase auth session is created.
  Future<String?> loginWorkerWithCode({
    required String code,
    required String password,
  }) async {
    _logger.i('🔑 [AuthRepository] Verifying worker access code');
    try {
      final result = await _supabase.rpc('login_worker_with_code', params: {
        'p_code': code.trim(),
        'p_password': password,
      });
      final workerId = result?.toString();
      if (workerId == null || workerId.isEmpty || workerId == 'null') {
        _logger.w('⚠️ [AuthRepository] Invalid worker access credentials');
        return null;
      }
      _logger.i('✅ [AuthRepository] Worker access granted: $workerId');
      return workerId;
    } catch (e) {
      _logger.e('❌ [AuthRepository] Worker access login failed', error: e);
      rethrow;
    }
  }

  /// Tasks assigned to a worker (sessionless, via get_worker_tasks RPC).
  Future<List<Map<String, dynamic>>> getWorkerTasks(String workerId) async {
    final result =
        await _supabase.rpc('get_worker_tasks', params: {'p_worker_id': workerId});
    if (result is List) {
      return result.cast<Map<String, dynamic>>();
    }
    return const [];
  }

  /// Worker flips a task's status (À faire / Terminé) via set_worker_task_status.
  Future<bool> setWorkerTaskStatus({
    required String workerId,
    required String taskId,
    required String status,
  }) async {
    final result = await _supabase.rpc('set_worker_task_status', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_status': status,
    });
    return result == true;
  }

  // ─── Worker activity (chantiers, pointage, photos, documents, reports) ─────
  // All sessionless, via the worker_activity.sql RPCs. Each is guarded server
  // side so a worker can only touch ouvrages they are assigned to.

  /// The worker's chantiers "en cours" (not archived/terminated), each with its
  /// address, the owning company's name, and the list of assigned ouvrages.
  Future<List<Map<String, dynamic>>> getWorkerChantiers(String workerId) async {
    final result = await _supabase
        .rpc('get_worker_chantiers', params: {'p_worker_id': workerId});
    if (result is List) return result.cast<Map<String, dynamic>>();
    return const [];
  }

  /// The worker's archived/terminated chantiers, each ouvrage carrying its full
  /// history (pointages, photos, documents, reports).
  Future<List<Map<String, dynamic>>> getWorkerArchives(String workerId) async {
    final result = await _supabase
        .rpc('get_worker_archives', params: {'p_worker_id': workerId});
    if (result is List) return result.cast<Map<String, dynamic>>();
    return const [];
  }

  /// Full detail for one ouvrage (scheduled_task) for this worker.
  Future<Map<String, dynamic>?> getWorkerOuvrageDetail({
    required String workerId,
    required String taskId,
  }) async {
    final result = await _supabase.rpc('get_worker_ouvrage_detail',
        params: {'p_worker_id': workerId, 'p_task_id': taskId});
    if (result is Map) return Map<String, dynamic>.from(result);
    return null;
  }

  /// Company/entreprise notes addressed to this worker (audience = workers |
  /// both) for one assigned ouvrage — see get_worker_task_notes in
  /// supabase/migrations/0003_task_notes.sql. Read-only; workers reply
  /// through the existing report/pointage RPCs, not this thread.
  Future<List<Map<String, dynamic>>> getWorkerTaskNotes({
    required String workerId,
    required String taskId,
  }) async {
    final result = await _supabase.rpc('get_worker_task_notes',
        params: {'p_worker_id': workerId, 'p_task_id': taskId});
    if (result is List) return result.cast<Map<String, dynamic>>();
    return const [];
  }

  /// Record a pointage event. [kind] ∈ start | pause | resume | end.
  Future<void> addWorkerPointage({
    required String workerId,
    required String taskId,
    required String kind,
  }) async {
    await _supabase.rpc('add_worker_pointage', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_kind': kind,
    });
  }

  /// Record a report. [kind] ∈ reclamation | retard | blocage | commentaire |
  /// depassement.
  Future<void> addWorkerReport({
    required String workerId,
    required String taskId,
    required String kind,
    String message = '',
  }) async {
    await _supabase.rpc('add_worker_report', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_kind': kind,
      'p_message': message,
    });
  }

  /// Raise a safety urgent alert (degat/fuite/urgence/incendie/autre) —
  /// distinct from [addWorkerReport]'s task-progress reports. Fans out to a
  /// company notification server-side (see add_worker_urgent_alert RPC).
  Future<void> addWorkerUrgentAlert({
    required String workerId,
    required String taskId,
    required String type,
    required String message,
  }) async {
    await _supabase.rpc('add_worker_urgent_alert', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_type': type,
      'p_message': message,
    });
  }

  /// Upload photo bytes to the worker-uploads bucket and register the metadata.
  Future<void> addWorkerPhoto({
    required String workerId,
    required String taskId,
    required String chantierId,
    required List<int> bytes,
    required String fileExtension,
    String caption = '',
  }) async {
    final path =
        '$chantierId/$taskId/photo_${DateTime.now().millisecondsSinceEpoch}.$fileExtension';
    await _supabase.storage.from('worker-uploads').uploadBinary(
          path,
          Uint8List.fromList(bytes),
          fileOptions: const FileOptions(upsert: true),
        );
    await _supabase.rpc('add_worker_photo', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_storage_path': path,
      'p_caption': caption,
    });
  }

  /// Upload a document and register its metadata.
  Future<void> addWorkerDocument({
    required String workerId,
    required String taskId,
    required String chantierId,
    required List<int> bytes,
    required String fileName,
    String? mimeType,
  }) async {
    final safeName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final path =
        '$chantierId/$taskId/doc_${DateTime.now().millisecondsSinceEpoch}_$safeName';
    await _supabase.storage.from('worker-uploads').uploadBinary(
          path,
          Uint8List.fromList(bytes),
          fileOptions: FileOptions(upsert: true, contentType: mimeType),
        );
    await _supabase.rpc('add_worker_document', params: {
      'p_worker_id': workerId,
      'p_task_id': taskId,
      'p_storage_path': path,
      'p_file_name': fileName,
      'p_mime': mimeType ?? '',
    });
  }

  /// Public URL for a stored object in the worker-uploads bucket.
  String workerUploadUrl(String storagePath) =>
      _supabase.storage.from('worker-uploads').getPublicUrl(storagePath);

  Future<void> signOut() async {
    _logger.i('🚪 [AuthRepository] Signing out from Supabase');
    try {
      await _supabase.auth.signOut();
      _logger.i('✅ [AuthRepository] Sign out successful');
    } catch (e) {
      _logger.e('❌ [AuthRepository] Sign out failed', error: e);
      rethrow;
    }
  }
}
