import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:koji/app/koji_web_api_client.dart';

/// In-memory stand-in for the platform secure-storage channel, so these
/// tests never touch a real keychain/keystore.
class _FakeSecureStoragePlatform extends FlutterSecureStoragePlatform {
  final Map<String, String> _store = {};

  @override
  Future<void> write({
    required String key,
    required String? value,
    required Map<String, String> options,
  }) async {
    if (value == null) {
      _store.remove(key);
    } else {
      _store[key] = value;
    }
  }

  @override
  Future<String?> read({
    required String key,
    required Map<String, String> options,
  }) async => _store[key];

  @override
  Future<void> delete({
    required String key,
    required Map<String, String> options,
  }) async => _store.remove(key);

  @override
  Future<bool> containsKey({
    required String key,
    required Map<String, String> options,
  }) async => _store.containsKey(key);

  @override
  Future<void> deleteAll({required Map<String, String> options}) async =>
      _store.clear();

  @override
  Future<Map<String, String>> readAll({
    required Map<String, String> options,
  }) async => Map.of(_store);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  FlutterSecureStoragePlatform.instance = _FakeSecureStoragePlatform();

  group('KojiWebApiClient.login', () {
    test('stores the session cookie and returns the account on success', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/auth/particulier-login');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['identifier'], 'amira@example.com');
        expect(body['password'], 'secret123');
        return http.Response(
          jsonEncode({
            'kind': 'client',
            'account': {'id': 'u1', 'email': 'amira@example.com'},
          }),
          200,
          headers: {
            'set-cookie':
                'koji_portal_session=abc.def.ghi; Path=/; HttpOnly; SameSite=Lax',
          },
        );
      });

      final api = KojiWebApiClient(
        httpClient: mockClient,
        storage: const FlutterSecureStorage(),
      );

      expect(api.isLoggedIn, isFalse);
      final result = await api.login(
        identifier: 'amira@example.com',
        password: 'secret123',
      );
      expect(result['kind'], 'client');
      expect(api.isLoggedIn, isTrue);
    });

    test('throws the server message on a 401', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Identifiant ou mot de passe incorrect.'}),
          401,
        );
      });
      final api = KojiWebApiClient(
        httpClient: mockClient,
        storage: const FlutterSecureStorage(),
      );

      expect(
        () => api.login(identifier: 'x@x.com', password: 'wrong'),
        throwsA(
          isA<KojiWebApiException>().having(
            (e) => e.message,
            'message',
            'Identifiant ou mot de passe incorrect.',
          ),
        ),
      );
    });

    test('a logged-in client resends the cookie on later calls', () async {
      String? seenCookie;
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/auth/particulier-login') {
          return http.Response(
            jsonEncode({'kind': 'client', 'account': {}}),
            200,
            headers: {
              'set-cookie': 'koji_portal_session=xyz; Path=/; HttpOnly',
            },
          );
        }
        seenCookie = request.headers['Cookie'];
        return http.Response(jsonEncode({'ok': true}), 200);
      });
      final api = KojiWebApiClient(
        httpClient: mockClient,
        storage: const FlutterSecureStorage(),
      );
      await api.login(identifier: 'a@a.com', password: 'p');
      await api.get('/api/chantier-offres');

      expect(seenCookie, 'koji_portal_session=xyz');
    });
  });

  group('« Retrouver mon projet » : code par e-mail', () {
    test('demanderCodeParticulier poste l\'adresse, sans session', () async {
      final vus = <http.Request>[];
      final api = KojiWebApiClient(
        httpClient: MockClient((request) async {
          vus.add(request);
          return http.Response(
            jsonEncode({'envoye': true, 'message': 'Si cette adresse...'}),
            200,
          );
        }),
        storage: const FlutterSecureStorage(),
      );
      await api.demanderCodeParticulier('sophie@exemple.fr');
      expect(vus.single.url.path, '/api/auth/particulier-code');
      expect(jsonDecode(vus.single.body), {'email': 'sophie@exemple.fr'});
      expect(api.isLoggedIn, isFalse);
    });

    test('connexionParCode garde le cookie comme la connexion par mot de passe',
        () async {
      String? cookieRenvoye;
      final api = KojiWebApiClient(
        httpClient: MockClient((request) async {
          if (request.url.path == '/api/auth/particulier-code/verifier') {
            expect(jsonDecode(request.body),
                {'email': 'sophie@exemple.fr', 'code': '730512'});
            return http.Response(
              jsonEncode({
                'kind': 'client',
                'account': {'id': 'u1', 'name': 'Sophie Lefèvre'},
              }),
              200,
              headers: {
                'set-cookie':
                    'koji_portal_session=code.jeton; Path=/; HttpOnly; SameSite=Lax',
              },
            );
          }
          cookieRenvoye = request.headers['Cookie'];
          return http.Response(jsonEncode({'ok': true}), 200);
        }),
        storage: const FlutterSecureStorage(),
      );
      final compte =
          await api.connexionParCode(email: 'sophie@exemple.fr', code: '730512');
      expect(compte['kind'], 'client');
      expect(api.isLoggedIn, isTrue);
      expect(api.accountFirstName, 'Sophie');
      await api.get('/api/client/paiements');
      expect(cookieRenvoye, 'koji_portal_session=code.jeton');

      // Gardé aussi d'un lancement à l'autre (même stockage que le mot de passe).
      final relance = KojiWebApiClient(
        httpClient: MockClient((_) async => http.Response('{}', 200)),
        storage: const FlutterSecureStorage(),
      );
      await relance.restoreSession();
      expect(relance.isLoggedIn, isTrue);
    });

    test('code faux : le message du site, pas de session', () async {
      final api = KojiWebApiClient(
        httpClient: MockClient((_) async => http.Response(
            jsonEncode({'error': 'Code incorrect ou expiré.'}), 401)),
        storage: const FlutterSecureStorage(),
      );
      await api.logout();
      await expectLater(
        api.connexionParCode(email: 'a@a.fr', code: '000000'),
        throwsA(isA<KojiWebApiException>()
            .having((e) => e.message, 'message', 'Code incorrect ou expiré.')),
      );
      expect(api.isLoggedIn, isFalse);
    });
  });
}
