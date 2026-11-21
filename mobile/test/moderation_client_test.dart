import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/screens/client_messages_inbox_screen.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';
import 'package:koji/features/moderation/moderation.dart';

import 'client_charte_support.dart';

// Signaler / Bloquer dans l'app Koji (App Store, règle 1.2) : messagerie du
// Radar. Le signalement part par la session du Radar avec sa cible
// (« radar:<demande>:<entreprise> ») ; le blocage masque l'entreprise.

/// Session du Radar simulée qui note les signalements envoyés.
class ApiQuiNote extends ApiConnectee {
  final envois = <Map<String, dynamic>>[];

  @override
  Future<dynamic> postJson(String path, Map<String, dynamic> body) async {
    expect(path, '/api/support/report');
    envois.add(body);
    return {'report': {'id': 'report-1'}};
  }
}

final _maintenant = DateTime(2026, 11, 18, 10);

Map<String, dynamic> _fil() => {
      'offerId': 'radar-17',
      'entrepriseUserId': 'ent-abl',
      'entrepriseSnapshot': {'raisonSociale': 'ABL Expert Renov'},
      'offre': {'description': 'Salle de bain, Paris 10e'},
      'unread': false,
      'messages': [
        {
          'id': 'm1',
          'senderType': 'entreprise',
          'message': 'Message déplacé de l’entreprise.',
          'kind': 'text',
          'createdAt': '2026-11-17T18:42:00',
        },
        {
          'id': 'm2',
          'senderType': 'particulier',
          'message': 'Ma réponse.',
          'kind': 'text',
          'createdAt': '2026-11-18T07:40:00',
        },
      ],
    };

void main() {
  setUpAll(chargerPolicesClient);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Widget ecran(ApiQuiNote api, {String? fil}) => ProviderScope(
        overrides: [
          kojiWebApiClientProvider.overrideWithValue(api),
          marketplaceRepositoryProvider
              .overrideWithValue(DepotSimule(fils: [_fil()])),
        ],
        child: MaterialApp(
          theme: KojiTheme.light(),
          home: ClientMessagesInboxScreen(fil: fil, maintenant: _maintenant),
        ),
      );

  test('corps du signalement depuis Koji : particulier, nature et cible', () {
    final corps = corpsSignalement(
      tag: 'Signalement contenu',
      target: const ReportTarget(
          kind: 'conversation', id: 'radar:o1:e1', label: 'Conversation'),
      details: 'Motif : Spam ou publicité',
      depuisKoji: true,
    );
    expect(corps['accountType'], 'particulier');
    expect(corps['page'], 'koji/conversation/radar:o1:e1');
    expect(corps['nature'], 'contenu');
    expect(corps['cible'], {'type': 'conversation', 'id': 'radar:o1:e1'});
    expect(corps['message'], contains('Type : conversation · id : radar:o1:e1'));
    final blocage = corpsSignalement(
        tag: 'Blocage',
        target: const ReportTarget(kind: 'offre_radar', id: 'o1', label: 'x'),
        details: '');
    expect(blocage['nature'], 'blocage');
    expect(blocage['accountType'], 'entreprise');
  });

  testWidgets('Signaler une conversation : motif, envoi avec sa cible',
      (tester) async {
    cadreTelephone(tester);
    final api = ApiQuiNote();
    await tester.pumpWidget(ecran(api, fil: 'radar-17:ent-abl'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Signaler ou bloquer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Signaler la conversation'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Arnaque ou fraude'));
    await tester.pump();
    await tester.tap(find.widgetWithText(TextButton, 'Signaler'));
    await tester.pumpAndSettle();

    expect(api.envois, hasLength(1));
    final corps = api.envois.single;
    expect(corps['accountType'], 'particulier');
    expect(corps['cible'], {'type': 'conversation', 'id': 'radar:radar-17:ent-abl'});
    expect(corps['message'], contains('Motif : Arnaque ou fraude'));
    expect(corps['message'], contains('Message déplacé de l’entreprise.'));
  });

  testWidgets('Bloquer : messages de l’entreprise masqués, réponse fermée, '
      'puis débloquer', (tester) async {
    cadreTelephone(tester);
    final api = ApiQuiNote();
    await tester.pumpWidget(ecran(api, fil: 'radar-17:ent-abl'));
    await tester.pumpAndSettle();
    expect(find.text('Message déplacé de l’entreprise.'), findsOneWidget);

    await tester.tap(find.byTooltip('Signaler ou bloquer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bloquer cette entreprise'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Bloquer'));
    await tester.pumpAndSettle();

    expect(find.text('Message déplacé de l’entreprise.'), findsNothing);
    expect(find.text('Ma réponse.'), findsOneWidget);
    expect(find.byType(ClSaisie), findsNothing);
    expect(find.textContaining('Vous avez bloqué ABL Expert Renov'), findsOneWidget);
    expect(api.envois.single['nature'], 'blocage');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList('moderation_blocked_threads'),
        ['radar:radar-17:ent-abl']);

    // Dans la liste : « Entreprise bloquée ».
    await tester.tap(find.bySemanticsLabel('Retour'));
    await tester.pumpAndSettle();
    expect(find.text('Entreprise bloquée'), findsOneWidget);

    // Débloquer depuis le fil.
    await tester.tap(find.text('ABL Expert Renov'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Signaler ou bloquer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Débloquer cette entreprise'));
    await tester.pumpAndSettle();
    expect(find.text('Message déplacé de l’entreprise.'), findsOneWidget);
    expect(find.byType(ClSaisie), findsOneWidget);
  });
}
