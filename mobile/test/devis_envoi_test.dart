import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/devis/devis_envoi.dart';
import 'package:koji/apps/entreprise/devis/pro_envoi_devis_screen.dart';

// Envoyer le devis (maquette PRO-03.2) : mêmes exemples que le site
// (tests/unit/devis-envoi.test.js) et l'écran du téléphone.

Future<void> _polices() async {
  final loader = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    loader.addFont(File('assets/fonts/DMSans-$f.ttf').readAsBytes().then((b) => ByteData.view(b.buffer)));
  }
  await loader.load();
  final racine = Platform.environment['FLUTTER_ROOT'];
  final icones = File('$racine/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (racine != null && icones.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(icones.readAsBytes().then((b) => ByteData.view(b.buffer)))).load();
  }
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  test('réglages, PDF, message, canaux et SMS (règles du site)', () {
    expect(libelleValidite(30, DateTime(2026, 10, 28)), "30 jours · jusqu'au 27 nov.");
    expect(libelleAcompte(30, 5798.54), '30 % · 1 739,56 € TTC');
    expect(libelleAcompte(0, 5798.54), 'Sans acompte');
    expect(libelleReglement('Solde — par situations mensuelles, à 30 jours'), 'Situation mensuelle, 30 jours');
    expect(libelleReglement('Solde — à la réception des travaux'), 'Solde à la réception');
    expect(libelleReglement('Solde — à la livraison du mobilier'), 'Solde à la livraison du mobilier');
    expect(soldeDe(''), 'à la réception des travaux');
    expect(libelleTva(10), '10 % · mention certifiée par le client');
    expect(libelleTva(5.5), '5,5 % · mention certifiée par le client');
    expect(libelleTva(20), '20 % · taux normal');
    expect(joursDe('30 Jours'), 30);

    expect(nomFichierDevis('2026-041', 'Mme Lefèvre'), 'Devis_2026-041_Lefèvre.pdf');
    expect(nomFichierDevis('2026-042', ''), 'Devis_2026-042.pdf');
    expect(
      messageEnvoi(client: 'Mme Lefèvre', projet: 'Salle de bain, Paris 10e', debut: DateTime(2026, 11, 12)),
      'Bonjour Mme Lefèvre, voici le devis pour « Salle de bain, Paris 10e ». Je reste disponible pour en parler, et je peux démarrer le 12 novembre.',
    );
    expect(messageEnvoi(), 'Bonjour, voici le devis. Je reste disponible pour en parler.');
    expect(resumePdf(9, 4), '9 lignes · 4 lots · mentions légales et conditions de paiement');
    expect(resumePdf(1, 1), '1 ligne · 1 lot · mentions légales et conditions de paiement');

    expect(erreurEnvoi(kojiClient: true, email: true, sms: false, adresse: 's.lefevre@exemple.fr'), '');
    expect(erreurEnvoi(kojiClient: false, email: false, sms: false), "Choisis au moins une façon d'envoyer le devis.");
    expect(erreurEnvoi(kojiClient: true, email: true, sms: false, adresse: ' '), "Ajoute l'e-mail du client pour l'envoi par e-mail.");
    expect(erreurEnvoi(kojiClient: true, email: false, sms: true), 'Ajoute le téléphone du client pour le SMS.');
    expect(erreurEnvoi(kojiClient: true, email: false, sms: false), "Le lien de signature part par e-mail ou par SMS : coche l'un des deux.");
    expect(
      texteSms(message: 'Bonjour, voici le devis.', lien: 'https://getkoji.io/s/abc', identifiant: 'KJ-4821', motDePasse: 'x7Q2'),
      'Bonjour, voici le devis.\nLien : https://getkoji.io/s/abc\nIdentifiant : KJ-4821 · Mot de passe : x7Q2',
    );
    expect(texteSms(message: 'Bonjour.', lien: 'https://getkoji.io/s/abc', kojiClient: false), 'Bonjour.');

    const mentions = "Modalités de paiement : 30 % à la signature, solde à la réception.\nDélai d'exécution : à convenir avec le client.";
    expect(mentionsAvecPaiement(mentions, 40, 'par situations mensuelles, à 30 jours'),
        "Modalités de paiement : 40 % à la signature, solde par situations mensuelles, à 30 jours.\nDélai d'exécution : à convenir avec le client.");
    expect(mentionsAvecPaiement('Devis valable 30 jours.', 0, 'à la réception des travaux'),
        'Modalités de paiement : solde à la réception des travaux.\nDevis valable 30 jours.');
  });

  testWidgets('écran Envoyer le devis (maquette, téléphone), envoi', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final envois = <EnvoiDevisChoix>[];
    var reponse = 'Session expirée. Reconnectez-vous.';
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ProEnvoiDevisScreen(
        numero: '2026-041',
        client: 'Mme Lefèvre',
        email: 's.lefevre@exemple.fr',
        telephone: '06 12 34 56 78',
        projet: 'Salle de bain, Paris 10e',
        debut: DateTime(2026, 11, 12),
        totalHt: 5271.40,
        tva: 10,
        validite: 30,
        acompte: 30,
        solde: 'Solde — par situations mensuelles, à 30 jours',
        lignes: 9,
        lots: 4,
        maintenant: () => DateTime(2026, 10, 28),
        onEnvoyer: (c) async {
          envois.add(c);
          return reponse.isEmpty ? null : reponse;
        },
        onApercu: (_) async {},
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('5 271,40 € HT'), findsOneWidget);
    expect(find.text('TVA 10 % 527,14 € · 5 798,54 € TTC'), findsOneWidget);
    expect(find.text("30 jours · jusqu'au 27 nov."), findsOneWidget);
    expect(find.text('30 % · 1 739,56 € TTC'), findsOneWidget);
    expect(find.text('Situation mensuelle, 30 jours'), findsOneWidget);
    expect(find.text('10 % · mention certifiée par le client'), findsOneWidget);
    await expectLater(find.byType(ProEnvoiDevisScreen), matchesGoldenFile('goldens/pro_envoi_devis.png'));

    await tester.dragUntilVisible(find.text('SMS de notification'), find.byType(ListView), const Offset(0, -200));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SMS de notification'));
    await tester.dragUntilVisible(find.text('Devis_2026-041_Lefèvre.pdf'), find.byType(ListView), const Offset(0, -200));
    expect(find.text('9 lignes · 4 lots · mentions légales et conditions de paiement'), findsOneWidget);
    await tester.pump();
    await tester.dragUntilVisible(find.descendant(of: find.byType(ListView), matching: find.text('Envoyer le devis')), find.byType(ListView), const Offset(0, -200));
    await tester.tap(find.descendant(of: find.byType(ListView), matching: find.text('Envoyer le devis')));
    await tester.pumpAndSettle();
    expect(envois.single.sms, isTrue);
    expect(envois.single.email, isTrue);
    expect(envois.single.solde, 'par situations mensuelles, à 30 jours');
    expect(envois.single.adresse, 's.lefevre@exemple.fr');
    expect(find.text('Session expirée. Reconnectez-vous.'), findsOneWidget);
  });
}
