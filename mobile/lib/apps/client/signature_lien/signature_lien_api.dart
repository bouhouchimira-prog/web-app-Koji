import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/app/koji_web_api_config.dart';

/// Signature d'un devis par lien, sans compte (maquette CLI-07), dans l'app
/// Koji. Mêmes routes que la page du site app/signature/[token] :
/// - POST /api/auth/signature-login { identifier, password } → `{
///   signatureToken, quoteNumber }` et le cookie `koji_signature_session`
///   (lié à ce devis, 2 h au plus) ;
/// - GET /api/signatures/{jeton} → `{ quote, vue }`, 410/404 → lien non
///   valide, 401 → session à refaire ;
/// - POST /api/signatures/{jeton} → `{ quote, vue, clientAccess, exemplaire }` ;
/// - POST /api/signatures/{jeton}/retractation → `{ quote }` ;
/// - GET /api/signatures/{jeton}/pdf → le PDF.
/// Le cookie est gardé comme celui de la session Koji Client
/// (KojiWebApiClient) : lu dans `Set-Cookie`, rangé dans le stockage
/// sécurisé, renvoyé à chaque appel. Rien d'autre n'est gardé.
final signatureLienApiProvider = Provider<SignatureLienApi>((ref) {
  final api = SignatureLienApi();
  ref.onDispose(api.dispose);
  return api;
});

/// Session de signature absente ou expirée : il faut se reconnecter.
class SignatureSessionExpiree implements Exception {
  const SignatureSessionExpiree();
  @override
  String toString() =>
      'Session de signature expirée. Reconnectez-vous avec vos identifiants.';
}

/// Le lien n'ouvre plus de devis (déjà signé, expiré, remplacé) ;
/// [entreprise] : `{ nom, email }` quand le site la nomme.
class LienSignatureInvalide implements Exception {
  const LienSignatureInvalide([this.entreprise = const {}]);
  final Map<String, dynamic> entreprise;
}

/// Ce qu'un texte collé apporte : le jeton du devis et l'identifiant, lus
/// dans un lien de signature (`…/signature/login?signatureToken=…&identifier=…`
/// ou `…/signature/{jeton}`), ou l'identifiant seul (« Koji-AB12CD »).
({String jeton, String identifiant}) lireLienSignature(String texte) {
  final brut = texte.trim();
  final seul = RegExp(r'^Koji-[A-Z0-9]{4,}$', caseSensitive: false);
  if (seul.hasMatch(brut)) return (jeton: '', identifiant: brut);
  final uri = Uri.tryParse(brut);
  if (uri == null || !uri.hasScheme) return (jeton: '', identifiant: '');
  final morceaux = uri.pathSegments.where((m) => m.isNotEmpty).toList();
  var jeton = uri.queryParameters['signatureToken'] ?? '';
  if (jeton.isEmpty &&
      morceaux.length == 2 &&
      morceaux[0] == 'signature' &&
      morceaux[1] != 'login') {
    jeton = morceaux[1];
  }
  return (
    jeton: RegExp(r'^[A-Za-z0-9_-]{4,120}$').hasMatch(jeton) ? jeton : '',
    identifiant: (uri.queryParameters['identifier'] ?? '').trim(),
  );
}

class SignatureLienApi {
  SignatureLienApi({http.Client? httpClient, FlutterSecureStorage? storage})
      : _http = httpClient ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  static const _cookieName = 'koji_signature_session';
  static const _cleCookie = 'koji_signature_cookie';
  static const _cleJeton = 'koji_signature_jeton';

  final http.Client _http;
  final FlutterSecureStorage _storage;
  String? _cookie;

  void dispose() => _http.close();

  Uri _uri(String chemin) => Uri.parse('${KojiWebApiConfig.baseUrl}$chemin');
  String _devis(String jeton) =>
      '/api/signatures/${Uri.encodeComponent(jeton)}';

  Future<Map<String, String>> _entetes({bool json = true}) async {
    _cookie ??= await _storage.read(key: _cleCookie);
    return {
      if (json) 'Content-Type': 'application/json',
      if (_cookie != null) 'Cookie': '$_cookieName=$_cookie',
    };
  }

  Map<String, dynamic> _json(String corps) {
    if (corps.isEmpty) return const {};
    final d = jsonDecode(corps);
    return d is Map<String, dynamic> ? d : const {};
  }

  /// Le jeton du devis de la dernière connexion, s'il y en a une.
  Future<String> jetonGarde() async =>
      (await _storage.read(key: _cleJeton)) ?? '';

  Future<void> oublier() async {
    _cookie = null;
    await _storage.delete(key: _cleCookie);
    await _storage.delete(key: _cleJeton);
  }

  /// Connexion avec l'identifiant et le mot de passe reçus ; renvoie le
  /// jeton du devis.
  Future<String> connexion({
    required String identifiant,
    required String motDePasse,
  }) async {
    final res = await _http.post(
      _uri('/api/auth/signature-login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifiant, 'password': motDePasse}),
    );
    final corps = _json(res.body);
    if (res.statusCode >= 400 || corps['error'] is String) {
      throw KojiWebApiException(
        res.statusCode >= 400 ? res.statusCode : 400,
        (corps['error'] as String?) ?? 'Identifiant ou mot de passe incorrect.',
      );
    }
    final cookie = RegExp('$_cookieName=([^;]+)')
        .firstMatch(res.headers['set-cookie'] ?? '')
        ?.group(1);
    final jeton = (corps['signatureToken'] as String?) ?? '';
    if (cookie == null || jeton.isEmpty) {
      throw KojiWebApiException(
          500, 'Session de signature non reçue, réessayez.');
    }
    _cookie = cookie;
    await _storage.write(key: _cleCookie, value: cookie);
    await _storage.write(key: _cleJeton, value: jeton);
    return jeton;
  }

  Map<String, dynamic> _verifier(http.Response res, String erreur) {
    final corps = _json(res.body);
    if (res.statusCode == 401) throw const SignatureSessionExpiree();
    if (res.statusCode == 404 || res.statusCode == 410) {
      final ent = corps['entreprise'];
      throw LienSignatureInvalide(ent is Map<String, dynamic> ? ent : const {});
    }
    if (res.statusCode >= 400) {
      throw KojiWebApiException(
          res.statusCode, (corps['error'] as String?) ?? erreur);
    }
    return corps;
  }

  /// Le devis et sa vue (`{ quote, vue }`).
  Future<Map<String, dynamic>> lire(String jeton) async {
    final res = await _http.get(_uri(_devis(jeton)), headers: await _entetes());
    return _verifier(res, 'Le devis n\'a pas pu être chargé.');
  }

  /// Signe : `{ signerName, mentionTva, demandeExpresse, consent, signature }`.
  Future<Map<String, dynamic>> signer(
      String jeton, Map<String, dynamic> corps) async {
    final res = await _http.post(_uri(_devis(jeton)),
        headers: await _entetes(), body: jsonEncode(corps));
    return _verifier(res, 'Signature impossible.');
  }

  /// « Me rétracter » dans le délai (PRO-03.7).
  Future<Map<String, dynamic>> retracter(String jeton) async {
    final res = await _http.post(_uri('${_devis(jeton)}/retractation'),
        headers: await _entetes(), body: '{}');
    return _verifier(res, "La rétractation n'a pas pu être enregistrée.");
  }

  /// Le PDF du devis (signé ou à signer).
  Future<Uint8List> pdf(String jeton) async {
    final res = await _http.get(_uri('${_devis(jeton)}/pdf'),
        headers: await _entetes(json: false));
    if (res.statusCode == 401) throw const SignatureSessionExpiree();
    if (res.statusCode >= 400) {
      throw KojiWebApiException(res.statusCode, 'PDF indisponible.');
    }
    return res.bodyBytes;
  }
}
