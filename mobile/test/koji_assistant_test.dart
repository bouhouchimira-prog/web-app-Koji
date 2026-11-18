import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/koji/koji_assistant.dart';

// Maquettes PRO-18 à 18.2 (téléphone) : « Je peux commencer lundi chez M. Caron ? »
const _reponse = {
  'constat': "Oui, à deux conditions d'ici vendredi.",
  'chiffres': [{'label': 'Reste dû', 'valeur': '1 554,30 €'}],
  'points': [{'titre': 'Acompte de 1 554,30 € TTC non payé', 'detail': '30 % du devis signé le 2 nov.'}],
  'sources': [{'label': 'Coût du chantier', 'href': '/depenses/chantier?projet=c1'}],
  'actions': [{'type': 'message_client', 'label': "Relancer l'acompte de M. Caron", 'quoteId': 'q1', 'texte': 'Bonjour M. Caron, il nous manque l\'acompte.'}],
  'suggestions': ["Prévenir l'équipe du planning", 'Quelle marge sur ce chantier ?'],
  'mention': 'Réponse de Koji, assistant IA · vérifiez avant de décider',
};

class _FakeRepo extends KojiRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <String>[];
  @override
  Future<Json> question(String message, {String conversationId = '', String page = ''}) async {
    appels.add('question:$message|$page');
    return {'outcome': 'answer', 'message': _reponse['constat'], 'reponse': _reponse};
  }

  @override
  Future<Json> messageClient(String quoteId, String texte) async {
    appels.add('message:$quoteId');
    return {'ok': true};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

void main() {
  test('sources du site ouvertes dans l\'app quand la page existe', () {
    expect(routeApp('/depenses/chantier?projet=c1'), '/depenses/chantier/c1');
    expect(routeApp('/equipe/w1'), '/equipe/fiche/w1');
    expect(routeApp('/interventions/rapide/int-1'), '/intervention-rapide/suivi/int-1');
    expect(routeApp('/devis?id=q1'), isNull);
  });

  testWidgets('question, réponse chiffrée, action à valider, suggestions', (tester) async {
    tester.view.physicalSize = const Size(430, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = _FakeRepo();
    await tester.pumpWidget(ProviderScope(overrides: [kojiRepositoryProvider.overrideWithValue(repo)], child: const MaterialApp(home: KojiAssistantScreen(page: 'Chantier · Cuisine, Montreuil'))));
    await tester.pumpAndSettle();
    expect(_contient('Sur cette page'), findsWidgets);
    expect(_contient("Qui me doit de l'argent ?"), findsWidgets);
    await tester.enterText(find.byType(TextField), 'Je peux commencer lundi chez M. Caron ?');
    await tester.tap(find.byTooltip('Envoyer'));
    await tester.pumpAndSettle();
    expect(repo.appels.first, 'question:Je peux commencer lundi chez M. Caron ?|Chantier · Cuisine, Montreuil');
    expect(_contient('ASSISTANT IA'), findsWidgets);
    expect(_contient("Oui, à deux conditions d'ici vendredi."), findsWidgets);
    expect(_contient('1 554,30 €'), findsWidgets);
    expect(_contient('Coût du chantier'), findsWidgets);
    expect(_contient('Quelle marge sur ce chantier ?'), findsWidgets);
    expect(_contient('Rien ne part sans vous.'), findsWidgets);
    await tester.tap(find.text('Envoyer').last);
    await tester.pumpAndSettle();
    expect(repo.appels, contains('message:q1'));
    expect(_contient('Envoyé.'), findsWidgets);
  });
}
