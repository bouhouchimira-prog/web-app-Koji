import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/messages_pro/messages_pro.dart';

// Maquette PRO-12 (téléphone) : liste des conversations et fil.
final liste = <String, dynamic>{
  'compteurs': {'nonLus': 3, 'filsNonLus': 2},
  'fils': [
    {'cle': 'devis:q1', 'titre': 'Mme Lefèvre', 'initiales': 'LE', 'sousTitre': 'Salle de bain, Paris 10e', 'nonLus': 0, 'pro': false, 'dernier': {'texte': 'Le gardien peut réceptionner avant 12 h.', 'le': '2026-11-15T08:42:00Z', 'quand': '9 h 42'}},
    {'cle': 'radar:o1', 'titre': 'Laura M.', 'initiales': 'LM', 'sousTitre': "Salle d'eau à refaire", 'nonLus': 1, 'pro': false, 'dernier': {'texte': 'Je suis disponible mardi.', 'le': '2026-11-14T10:00:00Z', 'quand': 'hier'}},
    {'cle': 'devis:q2', 'titre': 'Caulaincourt', 'initiales': 'CA', 'sousTitre': 'Appartement Caulaincourt', 'nonLus': 2, 'pro': false, 'dernier': {'texte': 'Situation 2 reçue, virement lundi.', 'le': '2026-11-14T09:00:00Z', 'quand': 'hier'}},
  ],
};
final fil = <String, dynamic>{
  'fil': {'cle': 'devis:q1', 'titre': 'Mme Lefèvre', 'sousTitre': 'Salle de bain, Paris 10e', 'quoteId': 'q1', 'offreId': ''},
  'jours': [
    {'jour': '2026-11-15', 'titre': "Aujourd'hui", 'messages': [
      {'id': '1', 'texte': "Le gardien est là jusqu'à 12 h.", 'heure': '9 h 42', 'entreprise': false},
    ]},
  ],
  'contexte': {'etiquettes': [{'texte': 'Livraison Cedeo ven. 20 · lieu à confirmer', 'alerte': true}, {'texte': 'Devis signé', 'alerte': false}]},
  'suggestion': {'etat': 'propose', 'action': 'livraison', 'resume': 'Livraison Cedeo ven. 20, réception par le gardien avant 12 h', 'reponses': ['Parfait, je préviens Cedeo pour avant 12 h.']},
  'reponses': ["Merci, c'est noté."],
};

class _FakeRepo extends MessagesRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <String>[];

  @override
  Future<Json> liste() async => liste_;
  @override
  Future<Json> fil(String cle) async => fil_;
  @override
  Future<Json> envoyer(Json f, String texte) async {
    appels.add('envoyer ${f['quoteId']} $texte');
    return {'ok': true};
  }
  @override
  Future<Json> suggestion(String cle, String decision) async {
    appels.add('suggestion $cle $decision');
    return {'ok': true};
  }
}
final liste_ = liste;
final fil_ = fil;

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, _FakeRepo repo) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [messagesRepositoryProvider.overrideWithValue(repo)], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('liste : non lus, filtre Non lus, onglet Pros vide', (tester) async {
    await _pump(tester, const MessagesProScreen(), _FakeRepo());
    expect(_contient('3 non lus'), findsWidgets);
    expect(_contient('Le gardien peut réceptionner'), findsWidgets);
    expect(_contient('Non lus 2'), findsWidgets);
    await tester.tap(_contient('Non lus 2').first);
    await tester.pumpAndSettle();
    expect(_contient('Le gardien peut réceptionner'), findsNothing);
    expect(_contient('Caulaincourt'), findsWidgets);
    await tester.tap(_contient('Pros').first);
    await tester.pumpAndSettle();
    expect(_contient('Réseau pro'), findsWidgets);
  });

  testWidgets('fil : étiquettes, Koji propose, réponse rapide, envoi', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const FilScreen(cle: 'devis:q1'), repo);
    expect(_contient('Livraison Cedeo ven. 20 · lieu à confirmer'), findsWidgets);
    expect(_contient('Le gardien est là'), findsWidgets);
    await tester.tap(find.text('Mettre à jour'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('suggestion devis:q1 appliquer'));
    await tester.tap(find.text("Merci, c'est noté."));
    await tester.pump();
    await tester.tap(find.text('Envoyer'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains("envoyer q1 Merci, c'est noté."));
  });
}
