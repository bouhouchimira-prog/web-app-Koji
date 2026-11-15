import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/contacts/contacts_pro.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;

// Maquettes PRO-10 à 10.2 (téléphone).
final carnet = <String, dynamic>{
  'compteurs': {'tous': 3, 'aFaire': 2, 'clients': 1, 'pros': 2},
  'contacts': [
    {'id': 'pp', 'nom': 'Point P · Paris 19', 'initiales': 'PP', 'type': 'fournisseur', 'pro': true, 'sousTitre': 'Fournisseur · commande BC-0417', 'flag': '', 'aFaire': false, 'dernier': '2026-10-29'},
    {'id': 'lef', 'nom': 'Mme Lefèvre', 'initiales': 'LE', 'type': 'client', 'pro': false, 'sousTitre': 'Client · Salle de bain, Paris 10e', 'flag': 'acompte échu', 'aFaire': true, 'dernier': '2026-11-06'},
    {'id': 'rh', 'nom': 'Rénov Horizon Carrelage', 'initiales': 'RH', 'type': 'sous_traitant', 'pro': true, 'sousTitre': 'Sous-traitant · Caulaincourt · carrelage', 'flag': 'URSSAF manquante', 'aFaire': true, 'dernier': '2026-11-02'},
  ],
};
final ficheRh = <String, dynamic>{
  'nom': 'Rénov Horizon', 'type': 'sous_traitant', 'typeLabel': 'Sous-traitant', 'genre': '',
  'contact': {'id': 'rh', 'companyName': 'Rénov Horizon', 'contactPerson': 'Tarik L. · gérant', 'phone': '06 00 00 00 41', 'metier': 'carrelage', 'roles': ['sous_traitant']},
  'action': {'cle': 'vigilance', 'urgent': true, 'label': "Demander l'attestation", 'doc': 'urssaf'},
  'vigilance': {'bloquant': {'cle': 'urssaf', 'nom': 'Attestation de vigilance URSSAF'}, 'docs': [
    {'cle': 'urssaf', 'nom': 'Attestation URSSAF', 'etat': 'manquant', 'texte': 'manquante · demandée le 2 nov.'},
    {'cle': 'kbis', 'nom': 'Kbis', 'etat': 'ok', 'texte': 'reçu le 14 oct.'},
    {'cle': 'decennale', 'nom': 'Décennale', 'etat': 'echeance', 'texte': 'expire le 15 nov. · dans 16 jours'},
  ]},
  'pro': {'chantiers': [{'title': 'Appartement Caulaincourt', 'lot': 'lot 03 carrelage', 'ht': 9800}], 'cumulAnnee': 14200},
  'historique': <Json>[],
};

class _FakeRepo extends ContactsRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <Json>[];

  @override
  Future<Json> poster(Json corps) async {
    appels.add(corps);
    if (corps['action'] == 'carte') {
      return {'proposition': {'companyName': 'Électricité Benarab', 'contactPerson': 'Yassine B. · gérant', 'phone': '06 12 00 00 77', 'siret': '912345538 00012', 'roles': ['sous_traitant']}, 'doublon': {'id': 'eb', 'nom': 'Électricité Benarab', 'par': 'même SIREN'}};
    }
    return {'envoye': true, 'id': 'eb'};
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, List<Override> overrides) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: overrides, child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('liste : à faire d\'abord, onglet À faire', (tester) async {
    await _pump(tester, const ContactsScreen(), [carnetProvider.overrideWith((ref) async => carnet)]);
    expect(_contient('3 contacts · 2 à faire'), findsWidgets);
    double y(String s) => tester.getTopLeft(find.text(s)).dy;
    expect(y('Mme Lefèvre') < y('Point P · Paris 19'), isTrue);
    expect(y('Rénov Horizon Carrelage') < y('Point P · Paris 19'), isTrue);
    await tester.tap(find.text('À faire 2'));
    await tester.pumpAndSettle();
    expect(find.text('Point P · Paris 19'), findsNothing);
    expect(find.text('URSSAF manquante'), findsOneWidget);
  });

  testWidgets('fiche sous-traitant : documents et « Demander l\'attestation »', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const FicheContactScreen(id: 'rh'), [
      contactsRepositoryProvider.overrideWithValue(repo),
      ficheContactProvider('rh').overrideWith((ref) async => ficheRh),
    ]);
    expect(_contient('Attestation de vigilance URSSAF manquante'), findsWidgets);
    expect(find.text('Bloquant'), findsOneWidget);
    expect(find.text('Échéance'), findsOneWidget);
    expect(_contient('14 200,00 € HT'), findsWidgets);
    await tester.tap(find.text("Demander l'attestation"));
    await tester.pumpAndSettle();
    expect(repo.appels.single, {'action': 'demander', 'id': 'rh', 'docs': ['urssaf']});
  });

  testWidgets('ajouter : carte lue par Koji, fiche existante complétée', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, AjouterContactScreen(prisePhoto: () async => [1, 2, 3]), [contactsRepositoryProvider.overrideWithValue(repo)]);
    await tester.tap(find.text('Photo de la carte ou du devis reçu'));
    await tester.pumpAndSettle();
    expect(_contient('Lu par Koji depuis la carte de visite'), findsWidgets);
    expect(_contient('Ce contact existe déjà : Électricité Benarab'), findsWidgets);
    expect(find.text('Compléter la fiche'), findsOneWidget);
    expect(repo.appels.first['action'], 'carte');
  });
}
