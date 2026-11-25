import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/chantiers/chantiers_liste.dart';
import 'package:koji/apps/entreprise/chantiers/fiche_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/nouveau_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/pro_chantiers_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_fiche_chantier_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_nouveau_chantier_screen.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Retours du build 64, sprint 2 : Nouveau chantier (nom et téléphone du
// client, adresses proposées, erreur sous le champ), ce que la fiche montre
// du chantier saisi, et son ouverture sans attente.

class _FauxSite extends ProKojiWebClient {
  _FauxSite({this.echec = false}) : super(accessToken: () => 'jeton-test');
  final bool echec;
  final recus = <Map<String, dynamic>>[];

  @override
  Future<Map<String, dynamic>> creerChantier(Map<String, dynamic> corps) async {
    recus.add(corps);
    if (echec) {
      throw Exception('PostgrestException(message: relation "public.chantiers" violates row-level security)');
    }
    return {'id': 'ch-1', 'title': corps['title']};
  }
}

const _montreuil = AdresseSuggeree(
    libelle: '12 Rue de Paris 93100 Montreuil',
    rue: '12 Rue de Paris',
    codePostal: '93100',
    ville: 'Montreuil');

Future<_FauxSite> _monter(WidgetTester tester, {bool echec = false}) async {
  tester.view.physicalSize = const Size(390 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final site = _FauxSite(echec: echec);
  final router = GoRouter(initialLocation: '/chantier/create', routes: [
    GoRoute(
        path: '/chantier/create',
        builder: (_, __) => ProNouveauChantierScreen(
            suggerer: (saisie) async =>
                saisie.toLowerCase().contains('12 rue') ? [_montreuil] : [])),
    GoRoute(
        path: '/chantier/dashboard',
        builder: (_, state) {
          final e = state.extra as Map;
          return Scaffold(body: Text('fiche ${e['id']} ${e['titre']} ${e['client']}'));
        }),
  ]);
  addTearDown(router.dispose);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      proKojiWebProvider.overrideWithValue(site),
      proChantiersProvider.overrideWith((ref) async => const <LigneChantier>[]),
    ],
    child: MaterialApp.router(debugShowCheckedModeBanner: false, routerConfig: router),
  ));
  await tester.pumpAndSettle();
  return site;
}

Finder _champ(String label) => find.descendant(
    of: find.ancestor(of: find.text(label), matching: find.byType(Column)).first,
    matching: find.byType(TextField));


Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(_chargerDmSans);

  test('vérifie la saisie, champ par champ', () {
    expect(erreursNouveauChantier(reference: '  '), {'reference': 'Donnez un nom à ce chantier.'});
    expect(erreursNouveauChantier(reference: 'TEST 2', email: 'imed@', telephone: '06 12'), {
      'email': "Cette adresse e-mail n'est pas valide.",
      'telephone': 'Ce numéro est trop court.',
    });
    expect(erreursNouveauChantier(reference: 'TEST 2', email: ' imed@exemple.fr ', telephone: '06 12 34 56 78'), isEmpty);
    expect(erreursNouveauChantier(reference: 'TEST 2'), isEmpty, reason: 'le client est facultatif');
  });

  test("lit les adresses proposées et prépare l'envoi", () {
    final a = adressesBan({
      'features': [
        {'properties': {'label': '12 Rue de Paris 93100 Montreuil', 'name': '12 Rue de Paris', 'postcode': '93100', 'city': 'Montreuil'}},
        {'properties': {'label': '12 Rue de Paris 93100 Montreuil', 'name': '12 Rue de Paris', 'postcode': '93100', 'city': 'Montreuil'}},
        {'properties': {'label': ''}},
        'bruit',
      ]
    });
    expect(a.map((x) => [x.rue, x.codePostal, x.ville]), [['12 Rue de Paris', '93100', 'Montreuil']]);
    expect(adressesBan(null), isEmpty);
    expect(
        corpsNouveauChantier(reference: ' TEST 2 ', rue: '12 rue de Paris', codePostal: '93100', ville: 'Montreuil', typeDeBien: 'Maison', clientNom: 'Marie Lefèvre', clientTelephone: '06 12 34 56 78', clientEmail: ' Marie@Exemple.fr '),
        {'title': 'TEST 2', 'address': '12 rue de Paris', 'postalCode': '93100', 'city': 'Montreuil', 'propertyType': 'Maison', 'clientName': 'Marie Lefèvre', 'clientPhone': '06 12 34 56 78', 'clientEmail': 'marie@exemple.fr'});
  });

  test('nom du client : devis, contact du chantier, e-mail entier, jamais son début', () {
    expect(nomClientChantier({'clientName': 'Marie Lefèvre', 'clientEmail': 'm@x.fr', 'client': 'm'}), 'Marie Lefèvre');
    expect(nomClientChantier({'clientName': '', 'clientEmail': 'imed.lachiheb@exemple.fr', 'client': 'imed.lachiheb'}), 'imed.lachiheb@exemple.fr');
    expect(nomClientChantier({'clientName': '', 'clientEmail': '', 'client': 'Client'}), '');
    expect(nomClientChantier({'clientName': 'Marie Lefèvre'}, {'client': 'Client'}), 'Marie Lefèvre', reason: '« Client » est la valeur par défaut du devis');
    expect(nomClientChantier({'clientName': 'Marie Lefèvre'}, {'client': 'Mme Lefèvre'}), 'Mme Lefèvre');
    expect(nomClientChantier({'client': 'Mme Lefèvre'}), 'Mme Lefèvre', reason: 'ancienne réponse du site');
  });

  test('la fiche montre ce qui a été saisi, et le donne aux outils du chantier', () {
    final p = {
      'id': 'ch-1', 'title': 'TEST 2', 'address': '12 rue de Paris, 93100, Montreuil', 'street': '12 rue de Paris', 'postalCode': '93100', 'city': 'Montreuil',
      'propertyType': 'Maison', 'clientName': 'Marie Lefèvre', 'clientPhone': '06 12 34 56 78', 'clientEmail': 'marie@exemple.fr', 'status': 'En attente',
    };
    expect(infosChantier(p), [
      ('Adresse', '12 rue de Paris, 93100, Montreuil'),
      ('Client', 'Marie Lefèvre · 06 12 34 56 78 · marie@exemple.fr'),
      ('Bien', 'Maison'),
    ]);
    // Le nom seul est déjà dans le bandeau.
    expect(infosChantier({'title': 'Salle de bain', 'client': 'Mme Lefèvre'}), isEmpty);
    expect(infosChantier({'clientName': '', 'clientEmail': 'imed@exemple.fr'}), isEmpty);
    expect(donneesOutils(p, 'ch-1'), {
      'id': 'ch-1', 'reference': 'TEST 2', 'street': '12 rue de Paris', 'postalCode': '93100', 'city': 'Montreuil', 'propertyType': 'Maison',
      'clientName': 'Marie Lefèvre', 'clientPhone': '06 12 34 56 78', 'clientEmail': 'marie@exemple.fr', 'status': 'En attente',
    });
    expect(sousTitreTaches([]), 'aucune tâche');
    expect(sousTitreTaches([{'done': true}]), '1 tâche faite sur 1');
    expect(sousTitreTaches([{'done': true}, {'done': true}, {}]), '2 tâches faites sur 3');
    final r = resumeFiche(devis: null, lots: const [], taches: [{'done': true}], factures: const []);
    expect((r.avancement, r.sousAvancement), (100, '1 tâche faite sur 1'));
  });

  test('aperçu de la fiche : ce que la liste a déjà lu, sans attendre', () {
    const liste = DonneesChantiers(
      projects: [{'id': 'ch-1', 'title': 'TEST 2'}, {'id': 'ch-2', 'title': 'loft durant test'}],
      quotes: [{'id': 'q1', 'projectId': 'ch-2'}],
      tasks: [{'id': 't1', 'projectId': 'ch-1', 'label': 'Peindre les murs'}, {'id': 't2', 'projectId': 'ch-2'}],
    );
    final a = apercuFiche(liste, 'ch-1')!;
    expect(a.projet['title'], 'TEST 2');
    expect(a.devis, isNull);
    expect(a.taches.map((t) => t['id']), ['t1']);
    expect(apercuFiche(liste, 'ch-2')!.devis?['id'], 'q1');
    expect(apercuFiche(liste, 'inconnu'), isNull);
    expect(apercuFiche(null, 'ch-1'), isNull);
  });

  testWidgets("l'erreur s'affiche sous le champ concerné, et rien n'est envoyé", (tester) async {
    final site = await _monter(tester);
    await tester.enterText(_champ('Adresse e-mail'), 'imed@');
    await tester.tap(find.text('Créer le chantier'));
    await tester.pumpAndSettle();
    expect(find.text('Donnez un nom à ce chantier.'), findsOneWidget);
    expect(find.text("Cette adresse e-mail n'est pas valide."), findsOneWidget);
    expect(site.recus, isEmpty);
    await expectLater(find.byType(ProNouveauChantierScreen), matchesGoldenFile('goldens/pro_nouveau_chantier.png'));
    // Corriger le champ retire son erreur.
    await tester.enterText(_champ('Référence du chantier'), 'TEST 2');
    await tester.pump();
    expect(find.text('Donnez un nom à ce chantier.'), findsNothing);
  });

  testWidgets('adresse proposée, puis création : la fiche remplace le formulaire', (tester) async {
    final site = await _monter(tester);
    await tester.enterText(_champ('Référence du chantier'), 'TEST 2');
    await tester.enterText(_champ('Numéro et rue'), '12 rue');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('12 Rue de Paris 93100 Montreuil'));
    await tester.pumpAndSettle();
    await tester.enterText(_champ('Nom du client'), 'Marie Lefèvre');
    await tester.enterText(_champ('Téléphone'), '06 12 34 56 78');
    await tester.tap(find.text('Appartement'));
    await tester.tap(find.text('Créer le chantier'));
    await tester.pumpAndSettle();
    expect(site.recus.single, {
      'title': 'TEST 2', 'address': '12 Rue de Paris', 'postalCode': '93100', 'city': 'Montreuil', 'propertyType': 'Appartement',
      'clientName': 'Marie Lefèvre', 'clientPhone': '06 12 34 56 78', 'clientEmail': '',
    });
    expect(find.text('fiche ch-1 TEST 2 Marie Lefèvre'), findsOneWidget);
    expect(find.text('Créer le chantier'), findsNothing, reason: 'le formulaire ne reste pas sous la fiche');
  });

  testWidgets("création impossible : une phrase claire, jamais l'erreur brute", (tester) async {
    await _monter(tester, echec: true);
    await tester.enterText(_champ('Référence du chantier'), 'TEST 2');
    await tester.tap(find.text('Créer le chantier'));
    await tester.pumpAndSettle();
    expect(find.text("Le chantier n'a pas pu être créé. Vérifiez la connexion et réessayez."), findsOneWidget);
    expect(find.textContaining('Postgrest'), findsNothing);
    expect(find.text('Créer le chantier'), findsOneWidget, reason: 'on peut réessayer');
  });
}
