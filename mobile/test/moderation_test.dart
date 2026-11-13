import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/moderation/moderation.dart';

void main() {
  late List<http.Request> sent;
  late ProviderContainer container;

  const target = ReportTarget(
    kind: 'message_devis',
    id: 'quote-1',
    label: 'Conversation du devis avec Dupont',
    excerpt: 'message injurieux',
  );

  Widget harness(void Function(BuildContext, WidgetRef) onTap) {
    final api = KojiProApi(
      tokenProvider: () async => 'jeton-test',
      httpClient: MockClient((request) async {
        sent.add(request);
        return http.Response(jsonEncode({'report': {'id': 'report-1'}}), 201,
            headers: {'content-type': 'application/json'});
      }),
    );
    container = ProviderContainer(
        overrides: [kojiProApiProvider.overrideWithValue(api)]);
    return UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Scaffold(
          body: Consumer(
            builder: (context, ref, _) => TextButton(
              onPressed: () => onTap(context, ref),
              child: const Text('ouvrir'),
            ),
          ),
        ),
      ),
    );
  }

  setUp(() {
    sent = [];
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('Signaler : motif obligatoire, envoyé à /api/support/report',
      (tester) async {
    await tester.pumpWidget(
        harness((context, ref) => showReportDialog(context, ref, target)));
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    // Bouton inactif tant qu'aucun motif n'est choisi.
    await tester.tap(find.widgetWithText(TextButton, 'Signaler'));
    await tester.pumpAndSettle();
    expect(sent, isEmpty);

    await tester.tap(find.text('Harcèlement ou menace'));
    await tester.pump();
    await tester.tap(find.widgetWithText(TextButton, 'Signaler'));
    await tester.pumpAndSettle();

    expect(sent, hasLength(1));
    expect(sent.single.url.path, '/api/support/report');
    expect(sent.single.headers['Authorization'], 'Bearer jeton-test');
    final body = jsonDecode(sent.single.body) as Map<String, dynamic>;
    expect(body['accountType'], 'entreprise');
    expect(body['page'], 'koji-pro/message_devis/quote-1');
    expect(body['message'], contains('[Signalement contenu]'));
    expect(body['message'], contains('Motif : Harcèlement ou menace'));
    expect(body['message'], contains('message injurieux'));
    expect(find.textContaining('Signalement envoyé'), findsOneWidget);
  });

  testWidgets('Bloquer : masque sur l\'appareil et prévient l\'équipe',
      (tester) async {
    await tester.pumpWidget(harness((context, ref) => confirmBlock(
          context,
          ref,
          target: target,
          title: 'Bloquer ce client ?',
          explanation: 'test',
          apply: () => ref
              .read(moderationProvider.notifier)
              .setQuoteBlocked('quote-1', true),
        )));
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Bloquer'));
    await tester.pumpAndSettle();

    expect(container.read(moderationProvider).blockedQuotes, {'quote-1'});
    expect(await readBlockedQuotes(), {'quote-1'});
    expect(sent, hasLength(1));
    expect(jsonDecode(sent.single.body)['message'], contains('[Blocage]'));
  });
}
