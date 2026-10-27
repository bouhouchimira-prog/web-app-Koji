import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

/// Same in-memory stand-in as koji_web_api_client_test.dart, duplicated here
/// since each test file gets a fresh isolate and platform instance.
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

  group('MarketplaceRepository', () {
    test('getMyOffers hits /api/chantier-offres and unwraps offres', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/chantier-offres');
        return http.Response(
          jsonEncode({
            'offres': [
              {'id': 'o1', 'status': 'Publiee'},
            ],
          }),
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final offers = await repo.getMyOffers();
      expect(offers, [{'id': 'o1', 'status': 'Publiee'}]);
    });

    test('getOfferDetail hits /api/chantier-offres/:id and unwraps offre',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/chantier-offres/o1');
        return http.Response(
          jsonEncode({'offre': {'id': 'o1', 'description': 'Peinture'}}),
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final offer = await repo.getOfferDetail('o1');
      expect(offer['description'], 'Peinture');
    });

    test('getPositions hits the positionner endpoint and unwraps the list',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/marketplace/offres/o1/positionner');
        return http.Response(
          jsonEncode({
            'positionnements': [
              {'id': 'p1', 'entrepriseSnapshot': {'raisonSociale': 'Acme'}},
            ],
          }),
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final positions = await repo.getPositions('o1');
      expect(positions.single['entrepriseSnapshot']['raisonSociale'], 'Acme');
    });

    test('sendChatTurn decodes the SSE frames from /api/radar-chat',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/radar-chat');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['turns'], [
          {'role': 'user', 'text': 'Bonjour'},
        ]);
        return http.Response(
          'event: delta\ndata: {"text":"Bon"}\n\n'
          'event: done\ndata: {"draftId":"d1","finished":false,"message":"Bonjour !"}\n\n',
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final events = await repo
          .sendChatTurn(
            turns: [
              {'role': 'user', 'text': 'Bonjour'},
            ],
            conversationId: 'conv-1',
          )
          .toList();

      expect(events.map((e) => e.event), ['delta', 'done']);
      expect(events.last.data['draftId'], 'd1');
    });

    test('getChatDraft hits /api/radar-chat/draft/:id and unwraps draft',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/radar-chat/draft/d1');
        return http.Response(
          jsonEncode({
            'draft': {'id': 'd1', 'status': 'termine', 'data': {'metier': 'Plomberie'}},
          }),
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final draft = await repo.getChatDraft('d1');
      expect(draft['data']['metier'], 'Plomberie');
    });

    test('launchExpertise posts answers/photos to /api/expertise-koji',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/expertise-koji');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['answers']['metier'], 'Plomberie');
        return http.Response(
          jsonEncode({'expertiseId': 'e1', 'metier': 'Plomberie', 'conseils': []}),
          201,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final result = await repo.launchExpertise(
        answers: {'metier': 'Plomberie'},
      );
      expect(result['expertiseId'], 'e1');
    });

    test('publishOffer posts to /api/chantier-offres and unwraps offre',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/chantier-offres');
        return http.Response(
          jsonEncode({'offre': {'id': 'radar-1', 'status': 'Publiee'}}),
          201,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final offer = await repo.publishOffer(
        expertiseId: 'e1',
        conseilsSelectionnes: const [],
        description: 'Rénovation',
        metier: 'Plomberie',
        address: '1 rue de Paris',
      );
      expect(offer['id'], 'radar-1');
    });
  });
}
