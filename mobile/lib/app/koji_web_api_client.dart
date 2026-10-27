import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'koji_web_api_config.dart';

/// Single shared instance for the app's lifetime (keeps the cached session
/// cookie in memory instead of hitting secure storage on every call).
final kojiWebApiClientProvider = Provider<KojiWebApiClient>((ref) {
  final client = KojiWebApiClient();
  ref.onDispose(client.dispose);
  return client;
});

/// One SSE event from a koji-web streaming endpoint (e.g. /api/radar-chat):
/// `event: <name>\ndata: <json>\n\n`.
class SseEvent {
  const SseEvent(this.event, this.data);
  final String event;
  final Map<String, dynamic> data;
}

/// Thrown for any non-2xx response, carrying the server's own error message
/// when the body was JSON `{ error: "..." }` (koji-web's convention, see
/// lib/http.js's `badRequest`).
class KojiWebApiException implements Exception {
  KojiWebApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

/// Talks to koji-web's own API routes over HTTPS, using the exact same
/// particulier session cookie (`koji_portal_session`, see
/// lib/session-cookies.js) a browser would carry — koji-web never needs to
/// know the caller is this app rather than a browser. We read the cookie
/// manually from `Set-Cookie` on login (an `httpOnly` cookie still reaches a
/// plain HTTP client; that flag only blocks page JavaScript) and resend it
/// ourselves on every call, since Dart's `http` package has no cookie jar.
class KojiWebApiClient {
  KojiWebApiClient({http.Client? httpClient, FlutterSecureStorage? storage})
    : _http = httpClient ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();

  static const _cookieName = 'koji_portal_session';
  static const _storageKey = 'koji_web_portal_cookie';
  static const _accountNameKey = 'koji_web_portal_account_name';

  final http.Client _http;
  final FlutterSecureStorage _storage;
  String? _cachedCookie;
  String? _cachedAccountName;

  Uri _uri(String path, [Map<String, dynamic>? query]) => Uri.parse(
    '${KojiWebApiConfig.baseUrl}$path',
  ).replace(queryParameters: query?.map((k, v) => MapEntry(k, '$v')));

  Future<String?> _cookie() async {
    return _cachedCookie ??= await _storage.read(key: _storageKey);
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    final cookie = await _cookie();
    return {
      if (json) 'Content-Type': 'application/json',
      if (cookie != null) 'Cookie': '$_cookieName=$cookie',
    };
  }

  /// Extracts just the cookie value from a raw `Set-Cookie` header (ignores
  /// the `HttpOnly`/`Secure`/`SameSite`/`Path`/`Max-Age` attributes, we only
  /// need the value to resend on the next request).
  String? _extractCookie(String? setCookieHeader) {
    if (setCookieHeader == null) return null;
    final match = RegExp(
      '$_cookieName=([^;]+)',
    ).firstMatch(setCookieHeader);
    return match?.group(1);
  }

  bool get isLoggedIn => _cachedCookie != null;

  /// First name only, for personalizing the radar-chat assistant's greeting
  /// (`prenom`, see lib/radar-chat-prompt.js) — empty when unknown, never
  /// required for the app to function.
  String get accountFirstName =>
      (_cachedAccountName ?? '').trim().split(RegExp(r'\s+')).first;

  /// Call once at app startup (before the router's session guard needs to
  /// know) so `isLoggedIn` reflects a session saved on a previous launch,
  /// not just one obtained during the current one.
  Future<void> restoreSession() async {
    _cachedCookie = await _storage.read(key: _storageKey);
    _cachedAccountName = await _storage.read(key: _accountNameKey);
  }

  void dispose() => _http.close();

  /// POST /api/auth/particulier-login — identifiant can be the particulier's
  /// email or their chantier "portal identifier". Returns the account JSON
  /// on success (`{ kind, account: {...} }`), stores the session cookie.
  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final res = await _http.post(
      _uri('/api/auth/particulier-login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    final body = _decodeJson(res.body);
    if (res.statusCode >= 400) {
      throw KojiWebApiException(
        res.statusCode,
        (body?['error'] as String?) ?? 'Connexion impossible.',
      );
    }
    final cookie = _extractCookie(res.headers['set-cookie']);
    if (cookie == null) {
      throw KojiWebApiException(500, 'Session non reçue, réessayez.');
    }
    _cachedCookie = cookie;
    await _storage.write(key: _storageKey, value: cookie);
    final name = (body?['account'] as Map?)?['name'] as String?;
    if (name != null && name.isNotEmpty) {
      _cachedAccountName = name;
      await _storage.write(key: _accountNameKey, value: name);
    }
    return body!;
  }

  Future<void> logout() async {
    _cachedCookie = null;
    _cachedAccountName = null;
    await _storage.delete(key: _storageKey);
    await _storage.delete(key: _accountNameKey);
  }

  Map<String, dynamic>? _decodeJson(String body) {
    if (body.isEmpty) return null;
    final decoded = jsonDecode(body);
    return decoded is Map<String, dynamic> ? decoded : {'value': decoded};
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final res = await _http.get(_uri(path, query), headers: await _headers());
    return _unwrap(res);
  }

  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    final res = await _http.post(
      _uri(path),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _unwrap(res);
  }

  Future<dynamic> patchJson(String path, Map<String, dynamic> body) async {
    final res = await _http.patch(
      _uri(path),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _unwrap(res);
  }

  dynamic _unwrap(http.Response res) {
    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final message = (decoded is Map && decoded['error'] is String)
          ? decoded['error'] as String
          : 'Erreur serveur (${res.statusCode}).';
      throw KojiWebApiException(res.statusCode, message);
    }
    return decoded;
  }

  /// Streams Server-Sent Events from a koji-web streaming endpoint (currently
  /// only /api/radar-chat). `event:`/`data:` lines are koji-web's own frames
  /// (see app/api/radar-chat/route.js's `sseFrame`) — this just decodes them,
  /// it does not interpret the event names (the caller's provider does).
  Stream<SseEvent> postSse(String path, Map<String, dynamic> body) async* {
    final request = http.Request('POST', _uri(path))
      ..headers.addAll(await _headers())
      ..body = jsonEncode(body);
    final streamed = await _http.send(request);

    if (streamed.statusCode >= 400) {
      final text = await streamed.stream.bytesToString();
      final decoded = text.isEmpty ? null : jsonDecode(text);
      final message = (decoded is Map && decoded['error'] is String)
          ? decoded['error'] as String
          : 'Erreur serveur (${streamed.statusCode}).';
      throw KojiWebApiException(streamed.statusCode, message);
    }

    String? pendingEvent;
    final buffer = StringBuffer();
    await for (final chunk in streamed.stream.transform(utf8.decoder)) {
      buffer.write(chunk);
      // Frames are separated by a blank line ("\n\n"); a chunk may contain
      // zero, one, or several complete frames plus a partial one to keep.
      while (true) {
        final text = buffer.toString();
        final boundary = text.indexOf('\n\n');
        if (boundary == -1) break;
        final frame = text.substring(0, boundary);
        buffer
          ..clear()
          ..write(text.substring(boundary + 2));

        String? dataLine;
        for (final line in frame.split('\n')) {
          if (line.startsWith('event:')) {
            pendingEvent = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine = line.substring(5).trim();
          }
        }
        if (pendingEvent != null && dataLine != null) {
          final decoded = jsonDecode(dataLine);
          yield SseEvent(
            pendingEvent,
            decoded is Map<String, dynamic> ? decoded : {'value': decoded},
          );
        }
      }
    }
  }
}
