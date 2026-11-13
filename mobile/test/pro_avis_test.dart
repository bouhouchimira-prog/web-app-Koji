import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/chantiers/avis.dart';
import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/chantiers/pro_avis_screen.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Avis du client Koji Pro (maquette PRO-02.6) : mêmes règles que le site
// (tests/unit/avis.test.js), écran et réponse publiée.
const _avis = {
  'id': 'a1',
  'auteur': 'Karine L.',
  'note': 5,
  'criteres': {'ponctualite': 5, 'proprete': 5, 'communication': 4, 'prix': 5},
  'texte':
      "Équipe ponctuelle et propre, chantier tenu dans les temps. La douche à l'italienne est superbe.",
  'verifie': true,
  'creeLe': '2026-12-12T12:00:00Z',
};

class _FauxServeur extends ProKojiWebClient {
  _FauxServeur() : super(accessToken: () => 'jeton-test');
  final appels = <String>[];

  @override
  Future<Map<String, dynamic>> avis(String projectId) async => {
        'avis': Map<String, dynamic>.from(_avis),
        'stats': {'moyenne': 4.8, 'nombre': 27, 'recommandent': 96},
        'accesClient': true,
      };

  @override
  Future<Map<String, dynamic>> actionAvis(String projectId, String action,
      [Map<String, dynamic> extra = const {}]) async {
    appels.add('$action ${extra['texte'] ?? ''}');
    return {};
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
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _chargerDmSans();
  });

  test('réponse proposée, moyenne, étape de clôture', () {
    expect(reponseProposee(client: 'Mme Lefèvre', note: 5),
        "Merci Mme Lefèvre pour votre confiance et votre accueil pendant les travaux. Ravis que le résultat vous plaise ; n'hésitez pas à nous écrire dans Koji Client si besoin.");
    expect(reponseProposee(note: 2), contains('désolés'));
    expect(moyenneTexte(4.8), '4,8');

    final solde = montantsSolde(devis: {'totalHt': 100, 'totalTtc': 110});
    EtapeCloture avis({Map<String, dynamic>? cloture, Map<String, dynamic>? recu, Map<String, dynamic>? facture}) =>
        etapesCloture(cloture: cloture, solde: solde, factureSolde: facture, avisRecu: recu)[4];
    expect(avis().action, "Programmer la demande d'avis");
    expect(avis(facture: {'status': 'Emise', 'amountTtc': 110}).action, "Demander l'avis");
    expect(avis(cloture: {'avis': {'demandeLe': '2026-12-08T10:00:00Z'}}).court, 'demandé');
    final recu = avis(recu: Map<String, dynamic>.from(_avis));
    expect(recu.court, '5 sur 5 · à répondre');
    expect(recu.action, "Répondre à l'avis");
  });

  testWidgets('avis, réponse proposée par Koji publiée', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final serveur = _FauxServeur();
    await tester.pumpWidget(ProviderScope(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)],
      child: const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: ProAvisScreen(
            projectId: 'c1',
            titreChantier: 'Salle de bain, Paris 10e',
            client: 'Mme Lefèvre'),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Avis de Mme Lefèvre'), findsOneWidget);
    expect(find.text('5 sur 5'), findsOneWidget);
    expect(find.text('4,8'), findsOneWidget);
    await expectLater(find.byType(ProAvisScreen),
        matchesGoldenFile('goldens/pro_avis.png'));
    await tester.tap(find.text('Publier ma réponse'));
    await tester.pumpAndSettle();
    expect(serveur.appels.single, startsWith('repondre Merci Mme Lefèvre'));
  });
}
