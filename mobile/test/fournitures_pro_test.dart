import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/fournitures/pro/fournitures_chantier_screen.dart';
import 'package:koji/features/fournitures/pro/fournitures_extra_screens.dart';
import 'package:koji/features/fournitures/pro/fournitures_logic.dart';
import 'package:koji/features/fournitures/pro/fournitures_pro_screen.dart';
import 'package:koji/features/fournitures/pro/fournitures_repository.dart';

// Maquettes PRO-07 à 07.6 : mêmes chiffres que tests/unit/fournitures.test.js.
Json four(Json o) => {'supplierId': 'pdb', 'supplierName': 'Plateforme du Bâtiment', 'prefere': true, ...o};
final colle = <String, dynamic>{'id': 'a2', 'name': 'Colle C2S1, sac 25 kg', 'unit': 'sac', 'uniteCond': 'sac', 'contenance': 1, 'prixPublic': 26.9, 'modePrix': 'manuel', 'prixManuel': 24, 'vente': 24, 'fournisseurs': [four({'achat': 18})]};
final gres = <String, dynamic>{'id': 'a1', 'name': 'Grès cérame 60 × 60 rectifié', 'unit': 'm²', 'uniteCond': 'boîte', 'contenance': 1.44, 'prixPublic': 64.9, 'modePrix': 'public', 'vente': 64.9, 'fournisseurs': [four({'achat': 48})]};
final colonne = <String, dynamic>{'id': 'a3', 'name': 'Colonne de douche thermostatique', 'unit': 'u', 'prixPublic': 399, 'modePrix': 'coefficient', 'coef': 1.3, 'fournisseurs': [four({'supplierId': 'ce', 'supplierName': 'Cedeo', 'achat': 289})]};
final sacs = <String, dynamic>{'id': 'a4', 'name': 'Sacs à gravats renforcés', 'unit': 'u', 'achat': 1.2, 'modePrix': 'public', 'fournisseurs': <Json>[]};

Json bon({String etat = 'partiel'}) => {
      'id': 'bc31', 'numero': 'BC-2026-031', 'supplierName': 'Leroy Pro (exemple)', 'supplierEmail': 'pro@exemple.invalid', 'projectTitle': 'Appartement Caulaincourt', 'lot': 'lot 03',
      'envoyeLe': etat == 'brouillon' ? '' : '2026-10-28T08:14:00Z', 'etat': etat, 'livraisonLe': '2026-10-30', 'livraisonHeure': '10 h',
      'lignes': [
        {'id': 'l1', 'name': 'Faïence 30 × 60 blanc mat', 'unit': 'm²', 'quantite': 16, 'prixHt': 25.75, 'livre': etat == 'brouillon' ? 0 : 16},
        {'id': 'l2', 'name': 'Colle C2 gris · sac 25 kg', 'unit': 'u', 'quantite': 4, 'prixHt': 17.1, 'livre': etat == 'brouillon' ? 0 : 4},
        {'id': 'l3', 'name': 'Joint 2 mm gris clair', 'unit': 'u', 'quantite': 3, 'prixHt': 9.6, 'livre': 0},
        {'id': 'l4', 'name': 'Silicone sanitaire gris', 'unit': 'u', 'quantite': 2, 'prixHt': 7.2, 'livre': 0},
        {'id': 'l5', 'name': 'Receveur extra-plat 90 × 120', 'unit': 'u', 'quantite': 1, 'prixHt': 369, 'livre': 0},
      ],
    };

class _FakeRepo extends FournituresProRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <List<Object?>>[];

  @override
  Future<Json> actionBon(String id, String action, [Json extra = const {}]) async {
    appels.add(['bon', id, action, extra]);
    return {'bon': bon(etat: 'envoye')};
  }

  @override
  Future<Json> lireLivraison(String bonId, String photo) async {
    appels.add(['lire', bonId, photo.startsWith('data:image/jpeg;base64,')]);
    return {
      'numeroBl': 'BL-55102',
      'date': '2026-11-20',
      'ecarts': [
        {'ligneId': 'a', 'name': 'Grès cérame 60 × 60, gris', 'commande': 42, 'livre': 42, 'etat': 'conforme'},
        {'ligneId': 'c', 'name': 'Receveur extra-plat 90 × 120', 'commande': 1, 'livre': 1, 'etat': 'casse', 'defaut': 'un coin cassé'},
        {'ligneId': 'd', 'name': 'Siphon de douche', 'commande': 1, 'livre': 0, 'etat': 'manquant'},
      ],
    };
  }

  @override
  Future<Json> validerLivraison(Json corps) async {
    appels.add(['valider', corps['reclamer'], (corps['ecarts'] as List).length]);
    return {'message': 'Livraison enregistrée, réclamation envoyée à Cedeo.'};
  }

  @override
  Future<List<Json>> creerBons(Json corps) async {
    appels.add(['creer', corps]);
    return [bon(etat: 'brouillon')];
  }
}

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));
List<String> _textes(WidgetTester t) => t.widgetList<Text>(find.byType(Text)).map((x) => _n(x.data ?? x.textSpan?.toPlainText() ?? '')).toList();

Future<void> _pump(WidgetTester tester, Widget home, List<Override> overrides) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: overrides, child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('prix, marge, conditionnement et bon (comme le site)', () {
    final m = marge(colle);
    expect((m.vente, m.euros, m.pct, m.ecartPublic), (24.0, 6.0, 25, -2.9));
    expect(marge(gres).pct, 26);
    expect(prixVente(colonne), 375.7);
    expect(libelleMode(colonne), '× 1,30');
    expect(modeEffectif(sacs), 'coefficient');
    expect(manquesArticle(sacs), ['fournisseur']);
    expect(achatParUnite(69.12, 1.44), 48);
    expect(avecPerte(5.8, 5), 6.1);
    final a = arrondiConditionnement(6.1, 1.44);
    expect((a.paquets, a.quantite, a.ecart), (5, 7.2, 1.1));
    final t = totauxBon(lignesDe(bon()));
    expect((t.ht, t.tva, t.ttc), (892.6, 178.52, 1071.12));
    expect(_n(quantiteBon({'paquets': 5, 'contenance': 1.44, 'uniteCond': 'boîte', 'quantite': 7.2, 'unit': 'm²'})), '5 boîtes · 7,2 m²');
    final r = resteACommander({'reste': 14.2, 'contenance': 1.44, 'prixHt': 48}, pris: 1.1);
    expect(r.paquets, 10);
  });

  testWidgets('catalogue : vente, mode et marge ; article incomplet signalé', (tester) async {
    await _pump(tester, const FournituresProScreen(), [
      catalogueProvider.overrideWith((ref) async => {
            'articles': [gres, colle, colonne, sacs],
            'fournisseurs': [{'id': 'pdb', 'name': 'Plateforme du Bâtiment'}],
            'reglage': {'coef': 1.3},
            'chiffres': {'aCommander': 2, 'incomplets': 7},
            'commandesParChantier': [{'projectId': 'p1', 'title': 'Salle de bain, Paris 10e', 'statut': 'a_completer', 'aCompleter': 2, 'totalHt': 2122.7, 'fournisseurs': ['Cedeo', 'Plateforme du Bâtiment', 'Rexel']}],
          }),
    ]);
    final t = _textes(tester);
    expect(t, contains('2 chantiers à commander · 7 articles incomplets'));
    expect(t, contains('Vente : Manuel · marge 25 %'));
    expect(t, contains('Vente : Public · marge 26 %'));
    expect(t, contains('Vente : × 1,30 · marge 23 %'));
    expect(t, contains('375,70 €'));
    expect(t, contains('À compléter : fournisseur manquant'));
    await tester.tap(find.text('Commandes 1'));
    await tester.pumpAndSettle();
    expect(_textes(tester), contains('À compléter 2'));
  });

  testWidgets('bon : totaux, reste à livrer ; envoi avec le montant dit avant', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const BonScreen(bonId: 'bc31'), [
      bonsProvider.overrideWith((ref) async => {'bons': [bon(etat: 'brouillon')], 'chiffres': {}}),
      fournituresProRepositoryProvider.overrideWithValue(repo),
    ]);
    expect(_textes(tester), containsAll(['892,60 €', '178,52 €', '1 071,12 €']));
    await tester.tap(find.text('Envoyer le bon'));
    await tester.pumpAndSettle();
    expect(_contient('Vous commandez pour 892,60 € HT'), findsWidgets);
    await tester.tap(find.text('Envoyer le bon').last);
    await tester.pumpAndSettle();
    expect(repo.appels.single, ['bon', 'bc31', 'envoyer', {'canal': 'email', 'to': 'pro@exemple.invalid', 'confirme': true}]);
  });

  testWidgets('livraison : photo lue par Koji, écarts, réclamation', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, LivraisonScreen(bonId: 'bc31', prisePhoto: () async => [1, 2, 3]), [fournituresProRepositoryProvider.overrideWithValue(repo)]);
    await tester.tap(find.text('Photo du bon de livraison'));
    await tester.pumpAndSettle();
    final t = _textes(tester);
    expect(t, contains('Koji a lu 3 lignes · 2 écarts'));
    expect(t, containsAll(['cassé', 'manquant', 'conforme']));
    await tester.tap(find.text('Signaler au fournisseur'));
    await tester.pump();
    expect(repo.appels, [['lire', 'bc31', true], ['valider', true, 3]]);
  });

  testWidgets('fournitures du chantier : groupes par fournisseur, préparer avec le stock', (tester) async {
    final repo = _FakeRepo();
    Json besoin(Json o) => {'manques': <String>[], 'lots': ['Lot 03'], 'contenance': 1, 'venteUnite': false, 'uniteCond': '', ...o};
    final besoins = [
      besoin({'cle': 'a2', 'articleId': 'a2', 'name': 'Colle C2S1, sac 25 kg', 'unit': 'sac', 'quantite': 4, 'reste': 4, 'prixHt': 18, 'supplierId': 'pdb', 'supplierName': 'Plateforme du Bâtiment'}),
      besoin({'cle': 'a1', 'articleId': 'a1', 'name': 'Grès cérame 60 × 60 rectifié', 'unit': 'm²', 'quantite': 14.2, 'reste': 14.2, 'prixHt': 48, 'contenance': 1.44, 'uniteCond': 'boîte', 'supplierId': 'pdb', 'supplierName': 'Plateforme du Bâtiment'}),
      besoin({'cle': 'x', 'name': 'Sacs à gravats renforcés', 'unit': 'u', 'quantite': 20, 'reste': 20, 'prixHt': 1.2, 'manques': ['fournisseur']}),
    ];
    await _pump(tester, const ChantierFournituresScreen(projectId: 'p1'), [
      fournituresProRepositoryProvider.overrideWithValue(repo),
      chantierFournituresProvider('p1').overrideWith((ref) async => {
            'business': true,
            'stock': [{'cle': 'a2', 'enStock': 3, 'utiliser': 3, 'coche': true, 'teinte': false, 'ids': [{'id': 's1', 'quantite': 3}]}],
            'chantier': {
              'projectId': 'p1', 'title': 'Salle de bain, Paris 16e', 'address': '12 rue Exemple', 'quote': {'signe': true, 'startDate': '2026-11-24'},
              'besoins': besoins, 'bons': <Json>[],
              'ranges': {'totalHt': 753.6, 'aCompleter': [besoins[2]], 'fournisseurs': [{'supplierName': 'Plateforme du Bâtiment', 'totalHt': 753.6, 'lignes': besoins.take(2).toList()}]},
            },
          }),
    ]);
    expect(_textes(tester), containsAll(['Salle de bain, Paris 16e · devis signé', 'Plateforme du Bâtiment', '753,60 €']));
    expect(_contient('1 article à compléter'), findsWidgets);
    await tester.tap(find.text('Préparer les commandes'));
    await tester.pumpAndSettle();
    expect(_contient('− 54,00 €'), findsWidgets);
    await tester.tap(find.text('Continuer vers les bons de commande'));
    await tester.pumpAndSettle();
    final corps = repo.appels.first[1] as Json;
    expect(corps['stock'], [{'id': 's1', 'quantite': 3.0}]);
    final lignes = (corps['lignes'] as List).cast<Json>();
    expect(lignes.map((l) => [l['name'], l['quantite'], l['paquets']]).toList(), [['Colle C2S1, sac 25 kg', 1.0, 1], ['Grès cérame 60 × 60 rectifié', 14.4, 10]]);
  });
}
