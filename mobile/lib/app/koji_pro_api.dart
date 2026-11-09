import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'koji_web_api_client.dart' show KojiWebApiException;
import 'koji_web_api_config.dart';

/// Returns the current Supabase access token, refreshed when it is about to
/// expire, or null when nobody is signed in.
typedef AccessTokenProvider = Future<String?> Function();

Future<String?> supabaseAccessToken() async {
  final auth = Supabase.instance.client.auth;
  var session = auth.currentSession;
  if (session == null) return null;
  final expiresAt = session.expiresAt;
  final soon = DateTime.now().add(const Duration(seconds: 60)).millisecondsSinceEpoch ~/ 1000;
  if (expiresAt != null && expiresAt < soon) {
    session = (await auth.refreshSession()).session ?? session;
  }
  return session.accessToken;
}

final kojiProApiProvider = Provider<KojiProApi>((ref) {
  final api = KojiProApi(tokenProvider: supabaseAccessToken);
  ref.onDispose(api.dispose);
  return api;
});

/// Koji Pro (entreprise) talks to koji-web's API routes, the single backend
/// shared with the website: same data, same calculations, same results.
/// koji-web verifies the Supabase access token sent as a Bearer header
/// against Supabase Auth itself (lib/server-auth.js getVerifiedUserId).
class KojiProApi {
  KojiProApi({required AccessTokenProvider tokenProvider, http.Client? httpClient})
      : _token = tokenProvider,
        _http = httpClient ?? http.Client();

  final AccessTokenProvider _token;
  final http.Client _http;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final uri = Uri.parse('${KojiWebApiConfig.baseUrl}$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: {
      ...uri.queryParameters,
      ...query.map((key, value) => MapEntry(key, '$value')),
    });
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    final token = await _token();
    if (token == null) throw KojiWebApiException(401, 'Session expirée. Reconnectez-vous.');
    return {
      'Authorization': 'Bearer $token',
      if (json) 'Content-Type': 'application/json',
    };
  }

  Map<String, dynamic> _decode(http.Response res) {
    Object? decoded;
    try {
      decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    } on FormatException {
      // koji-web answers some refusals with an HTML page (402 « Formule
      // requise » on documents during the trial).
      throw KojiWebApiException(
        res.statusCode,
        // Neutral wording: nothing is sold in the app (App Store 3.1.3(f)).
        res.statusCode == 402
            ? 'Ce document n\'est pas inclus dans votre formule actuelle.'
            : 'Réponse inattendue du serveur (${res.statusCode}).',
      );
    }
    final body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{'value': decoded};
    if (res.statusCode >= 400) {
      throw KojiWebApiException(
        res.statusCode,
        (body['error'] as String?) ?? 'Erreur serveur (${res.statusCode}).',
      );
    }
    return body;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async =>
      _decode(await _http.get(_uri(path, query), headers: await _headers(json: false)));

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async =>
      _decode(await _http.post(_uri(path), headers: await _headers(), body: jsonEncode(body)));

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async =>
      _decode(await _http.patch(_uri(path), headers: await _headers(), body: jsonEncode(body)));

  Future<Map<String, dynamic>> delete(String path, {Map<String, dynamic>? query}) async =>
      _decode(await _http.delete(_uri(path, query), headers: await _headers(json: false)));

  /// For PDFs and other files served by koji-web (e.g. /api/invoices/pdf).
  Future<Uint8List> getBytes(String path, {Map<String, dynamic>? query}) async {
    final res = await _http.get(_uri(path, query), headers: await _headers(json: false));
    if (res.statusCode >= 400) _decode(res);
    return res.bodyBytes;
  }

  /// List endpoints answer `{ <key>: [...] }`; returns that list as maps.
  Future<List<Map<String, dynamic>>> list(String path, String key, {Map<String, dynamic>? query}) async {
    final body = await get(path, query: query);
    final items = body[key];
    if (items is! List) return const [];
    return items.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  }

  void dispose() => _http.close();
}
