import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/features/demarrage/demarrage_logic.dart';
import 'package:koji/features/demarrage/demarrage_screen.dart';

// Démarrage guidé Koji Pro (maquette PRO-01.1) : logique partagée avec le
// site, et parcours des étapes 1 à 3 avec un faux serveur getkoji.io.
class _FauxServeur extends ProKojiWebClient {
  _FauxServeur(this.user) : super(accessToken: () => 'jeton-test');

  Map<String, dynamic> user;
  final envois = <Map<String, dynamic>>[];
  Map<String, num?>? tauxEnvoyes;

  @override
  Future<Map<String, dynamic>> profil() async => user;

  @override
  Future<Map<String, dynamic>> majProfil(Map<String, dynamic> body) async {
    envois.add(body);
    user = {
      ...user,
      if (body['professions'] != null) 'professions': body['professions'],
      'business': {
        ...Map<String, dynamic>.from(user['business'] as Map),
        ...Map<String, dynamic>.from(body['business'] as Map? ?? {}),
      },
    };
    return user;
  }

  @override
  Future<Map<String, dynamic>> ficheSiren(String siren) async => {
        'raisonSociale': 'ABL Expert Renov',
        'siren': siren,
        'siret': '${siren}00018',
        'formeJuridique': 'SAS',
        'addressLine1': '12 Rue des Vinaigriers',
        'postalCode': '75010',
        'city': 'Paris',
      };

  @override
  Future<Map<String, num>> tauxMetiers() async => const {};

  @override
  Future<Map<String, num>> enregistrerTaux(Map<String, num?> taux) async {
    tauxEnvoyes = taux;
    return {
      for (final e in taux.entries)
        if ((e.value ?? 0) > 0) e.key: e.value!
    };
  }
}

Future<void> _chargerDmSans() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf')
        .readAsBytes()
        .then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
}

void main() {
  setUpAll(_chargerDmSans);

  group('logique (comme lib/demarrage.js)', () {
    test('taux minimum en 4 questions', () {
      expect(
          tauxMinimum(
              charges: 18000,
              revenu: 36000,
              heuresParSemaine: 30,
              semaines: 44),
          41);
      expect(
          tauxMinimum(
              charges: null, revenu: 36000, heuresParSemaine: 30, semaines: 44),
          28);
      expect(
          tauxMinimum(
              charges: 18000, revenu: 36000, heuresParSemaine: 0, semaines: 44),
          isNull);
    });

    test('SIREN, IBAN, saisies', () {
      expect(sirenValide('356 000 000'), isTrue);
      expect(sirenValide('356000001'), isFalse);
      expect(masquerSiren('992651123'), '992 ••• 123');
      expect(ibanValide('FR76 3000 6000 0112 3456 7890 189'), isTrue);
      expect(ibanValide('FR76 3000 6000 0112 3456 7890 188'), isFalse);
      expect(formaterIban('fr7630006000011234567890189'),
          'FR76 3000 6000 0112 3456 7890 189');
      expect(nombre('41,5'), 41.5);
      expect(tauxTexte(60), '60');
    });

    test('les étapes se lisent dans la ligne Supabase', () {
      expect(essentielsFaitsDepuisLigne(null), isFalse);
      final ligne = {
        'profession': 'Electricien',
        'business_info': {
          'raisonSociale': 'ABL Expert Renov',
          'siren': '992651123',
          '_professions': ['Electricien', 'Peintre'],
          'zoneAddress': '12 Rue des Vinaigriers 75010 Paris',
          'zoneRadiusKm': 8,
          'dailyRate': 420,
        },
      };
      expect(essentielsFaitsDepuisLigne(ligne), isTrue);
      final etapes = etapesDemarrage({
        'business': ligne['business_info'],
        'professions': ['Electricien', 'Peintre'],
      }, taux: {
        'Electricien': 60
      });
      expect(etapes[1].resume, '2 métiers · 8 km autour de votre adresse');
      expect(etapes[2].resume, '60 €/h électricité · 60 €/h autres postes');
      expect(etapes.skip(3).every((e) => !e.faite), isTrue);
    });
  });

  testWidgets('étapes 1 à 3 : SIREN, métiers et zone, prix', (tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur({
      'email': 'bilal@exemple.fr',
      'professions': <String>[],
      'business': <String, dynamic>{},
    });
    var fini = false;
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: DemarrageScreen(
          geocodeur: (adresse) async => (
            label: '12 Rue des Vinaigriers 75010 Paris',
            lat: 48.873,
            lon: 2.36
          ),
          surFin: () => fini = true,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    // Étape 1 : le SIREN trouve la fiche, « C'est bien moi » l'enregistre.
    expect(find.text('étape 1 sur 6'), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, '356000000');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('ABL Expert Renov'), findsOneWidget);
    await expectLater(find.byType(DemarrageScreen),
        matchesGoldenFile('goldens/demarrage_siren.png'));
    await tester.tap(find.text("C'est bien moi"));
    await tester.pumpAndSettle();
    expect((serveur.envois.last['business'] as Map)['raisonSociale'],
        'ABL Expert Renov');

    // Étape 2 : deux métiers, 8 km n'existe pas → 10 km par défaut.
    expect(find.text('étape 2 sur 6'), findsOneWidget);
    await tester.tap(find.text('+ Électricité'));
    await tester.tap(find.text('+ Plomberie'));
    await tester.pumpAndSettle();
    expect(find.text('12 Rue des Vinaigriers, 75010 Paris'), findsOneWidget);
    await expectLater(find.byType(DemarrageScreen),
        matchesGoldenFile('goldens/demarrage_metiers.png'));
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();
    final zone = serveur.envois.last;
    expect(zone['professions'], ['Electricien', 'Plombier']);
    expect((zone['business'] as Map)['zoneRadiusKm'], 10);

    // Étape 3 : calcul du taux, puis validation.
    expect(find.text('étape 3 sur 6'), findsOneWidget);
    await tester.tap(find.text('Calculer mon taux'));
    await tester.pumpAndSettle();
    final champs = find.byType(TextField);
    for (final (i, v) in ['18000', '36000', '30', '44'].indexed) {
      await tester.enterText(champs.at(i), v);
    }
    await tester.pumpAndSettle();
    expect(find.text('41 € HT/h'), findsOneWidget);
    await expectLater(find.byType(DemarrageScreen),
        matchesGoldenFile('goldens/demarrage_calcul.png'));
    await tester.tap(find.text('Utiliser ce calcul'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, '60');
    await tester.tap(find.text('Valider mes prix'));
    await tester.pumpAndSettle();
    expect(serveur.tauxEnvoyes, {'Electricien': 60, 'Plombier': 41});
    // Autres postes à 41 €/h, journée de 7 h.
    expect((serveur.envois.last['business'] as Map)['dailyRate'], 287);
    expect(find.text('étape 4 sur 6'), findsOneWidget);

    // « Plus tard » sort du démarrage.
    await tester.tap(find.text('Plus tard'));
    await tester.pumpAndSettle();
    expect(fini, isTrue);
  });
}
