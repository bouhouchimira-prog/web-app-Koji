import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/subscription/data/subscription_repository.dart';

void main() {
  group('SubscriptionStatus.fromWebPlan (même règle que le site)', () {
    test('pas de formule ou « trial » : essai, jamais bloqué', () {
      for (final plan in [null, '', 'trial', 'TRIAL']) {
        final s = SubscriptionStatus.fromWebPlan(plan);
        expect(s.state, AccessState.trial, reason: 'plan=$plan');
        expect(s.hasAccess, isTrue);
      }
    });

    test('formule payante du site : abonné', () {
      for (final plan in ['pro', 'business', 'premium', 'active']) {
        final s = SubscriptionStatus.fromWebPlan(plan);
        expect(s.state, AccessState.subscribed, reason: 'plan=$plan');
        expect(s.plan, plan);
      }
    });
  });

  group('SubscriptionRepository.resolveStatus', () {
    late List<http.Request> sent;

    SubscriptionRepository repo(http.Response Function() reply) {
      final api = KojiProApi(
        tokenProvider: () async => 'jeton-test',
        httpClient: MockClient((request) async {
          sent.add(request);
          return reply();
        }),
      );
      return SubscriptionRepository(SupabaseClient('https://exemple.supabase.co', 'cle-anon'), api);
    }

    setUp(() => sent = []);

    test('lit la formule calculée par le site sur /api/auth/profile', () async {
      final status = await repo(() => http.Response(
            jsonEncode({'user': {'plan': 'business'}}), 200,
            headers: {'content-type': 'application/json'})).resolveStatus();
      expect(status.state, AccessState.subscribed);
      expect(status.plan, 'business');
      expect(sent.single.url.path, '/api/auth/profile');
      expect(sent.single.headers['Authorization'], 'Bearer jeton-test');
    });

    test('erreur réseau ou serveur : état inconnu, l\'app n\'est pas bloquée', () async {
      final status = await repo(() => http.Response('{"error":"boom"}', 500,
          headers: {'content-type': 'application/json'})).resolveStatus();
      expect(status.state, AccessState.unknown);
    });

    test('profil absent (session expirée) : état inconnu', () async {
      final status = await repo(() => http.Response(jsonEncode({'user': null}), 200,
          headers: {'content-type': 'application/json'})).resolveStatus();
      expect(status.state, AccessState.unknown);
    });
  });
}
