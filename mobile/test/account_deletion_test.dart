import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/features/account/account_deletion.dart';

void main() {
  late List<http.Request> sent;

  Widget harness() {
    final api = KojiProApi(
      tokenProvider: () async => 'jeton-test',
      httpClient: MockClient((request) async {
        sent.add(request);
        return http.Response(jsonEncode({'deletionRequest': {'id': 'del-req-1'}}), 201,
            headers: {'content-type': 'application/json'});
      }),
    );
    return ProviderScope(
      overrides: [kojiProApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        home: Scaffold(
          body: Consumer(
            builder: (context, ref, _) => TextButton(
              onPressed: () => confirmAccountDeletion(context, ref, accountType: 'entreprise'),
              child: const Text('ouvrir'),
            ),
          ),
        ),
      ),
    );
  }

  setUp(() => sent = []);

  testWidgets('la demande part vers /api/account/deletion-request avec le jeton', (tester) async {
    await tester.pumpWidget(harness());
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'Je ferme mon entreprise');
    await tester.tap(find.widgetWithText(TextButton, 'Supprimer mon compte'));
    await tester.pumpAndSettle();

    expect(sent, hasLength(1));
    expect(sent.single.method, 'POST');
    expect(sent.single.url.path, '/api/account/deletion-request');
    expect(sent.single.headers['Authorization'], 'Bearer jeton-test');
    expect(jsonDecode(sent.single.body),
        {'accountType': 'entreprise', 'reason': 'Je ferme mon entreprise'});
    expect(find.textContaining('Demande de suppression envoyée'), findsOneWidget);
  });

  testWidgets('Annuler n\'envoie rien', (tester) async {
    await tester.pumpWidget(harness());
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(TextButton, 'Annuler'));
    await tester.pumpAndSettle();

    expect(sent, isEmpty);
  });

  test('le menu Koji Pro propose « Supprimer mon compte » avant la déconnexion', () {
    final ids = entrepriseNavGroups.expand((g) => g.items).map((i) => i.id).toList();
    expect(ids, contains('supprimer-compte'));
    expect(ids.indexOf('supprimer-compte'), lessThan(ids.indexOf('deconnexion')));
  });
}
