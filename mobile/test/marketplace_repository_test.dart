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

    test('getMessages hits the messages endpoint and unwraps the list',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/marketplace/offres/o1/messages');
        return http.Response(
          jsonEncode({
            'messages': [
              {'id': 'm1', 'senderType': 'entreprise', 'message': 'Bonjour'},
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

      final messages = await repo.getMessages('o1');
      expect(messages.single['message'], 'Bonjour');
    });

    test('proposeRdv sends kind rdv_proposal with an ISO date', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['kind'], 'rdv_proposal');
        expect(body['entrepriseUserId'], 'e1');
        expect(body['rdvDate'], '2026-11-01T10:00:00.000');
        return http.Response(
          jsonEncode({'message': {'id': 'm2', 'kind': 'rdv_proposal'}}),
          201,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final message = await repo.proposeRdv(
        'o1',
        entrepriseUserId: 'e1',
        rdvDate: DateTime(2026, 11, 1, 10),
      );
      expect(message['kind'], 'rdv_proposal');
    });

    test('getPaiements hits the paiement endpoint and unwraps the list',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/marketplace/offres/o1/paiement');
        return http.Response(
          jsonEncode({
            'paiements': [
              {'id': 'p1', 'step': 'acompte', 'status': 'pending'},
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

      final paiements = await repo.getPaiements('o1');
      expect(paiements.single['step'], 'acompte');
    });

    test('checkoutPaiement returns the Stripe Checkout url', () async {
      final mockClient = MockClient((request) async {
        expect(
          request.url.path,
          '/api/marketplace/offres/o1/paiement/p1/checkout',
        );
        return http.Response(
          jsonEncode({'url': 'https://checkout.stripe.com/session/abc'}),
          200,
        );
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final url = await repo.checkoutPaiement('o1', 'p1');
      expect(url, 'https://checkout.stripe.com/session/abc');
    });

    test('getEntrepriseCardPdf fetches raw bytes, not JSON', () async {
      final mockClient = MockClient((request) async {
        expect(
          request.url.path,
          '/api/marketplace/offres/o1/entreprise-card',
        );
        expect(request.url.queryParameters['entrepriseUserId'], 'e1');
        return http.Response.bytes([0x25, 0x50, 0x44, 0x46], 200);
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      final bytes = await repo.getEntrepriseCardPdf('o1', entrepriseUserId: 'e1');
      expect(bytes, [0x25, 0x50, 0x44, 0x46]);
    });

    test('getClientMessages hits /api/client/messages and unwraps conversations',
        () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/client/messages');
        return http.Response(
          jsonEncode({
            'conversations': [
              {'offerId': 'o1', 'entrepriseUserId': 'e1', 'unread': true},
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

      final conversations = await repo.getClientMessages();
      expect(conversations.single['entrepriseUserId'], 'e1');
    });

    test('markNotificationRead PATCHes the notification id', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/notifications');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['id'], 'n1');
        expect(body['action'], 'read');
        return http.Response(jsonEncode({'ok': true}), 200);
      });
      final repo = MarketplaceRepository(
        KojiWebApiClient(
          httpClient: mockClient,
          storage: const FlutterSecureStorage(),
        ),
      );

      await repo.markNotificationRead('n1');
    });
  });
}
