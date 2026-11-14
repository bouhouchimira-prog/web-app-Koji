import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/apps/entreprise/visite/pro_visite_screen.dart';
import 'package:koji/apps/entreprise/visite/visite_mode.dart';
import 'package:koji/apps/entreprise/visite/visite_store.dart';

// Mode visite (maquette PRO-03.8, téléphone) : préparer, pièce par pièce,
// cote dictée, à vérifier, fin de visite ; hors ligne puis envoi au retour
// du réseau. Serveur simulé, rien n'est envoyé.

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

// Photo 2 × 2 grise (PNG valide).
final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGPYsGEFEDFAKAA5DgghoMiTQgAAAABJRU5ErkJggg==');

class _FauxServeur implements VisiteServeur {
  bool reseau = false;
  final recues = <Visite>[];
  final photos = <String>[];
  final resumes = <Map<String, dynamic>>[];

  @override
  Future<Map<String, dynamic>> enregistrer(Visite visite) async {
    if (!reseau) throw const SocketException('pas de réseau');
    recues.add(visite);
    return {'ecartSecondes': 3};
  }

  @override
  Future<void> photo({required String visiteId, required String photoId, required String pieceId, required List<int> octets, String pointId = '', String prisLe = ''}) async {
    if (!reseau) throw const SocketException('pas de réseau');
    photos.add(photoId);
  }

  @override
  Future<Map<String, dynamic>> resume(String id, {required String message, required String devisPromis, String email = '', bool envoyer = true}) async {
    if (!reseau) throw const SocketException('pas de réseau');
    resumes.add({'message': message, 'devisPromis': devisPromis, 'envoyer': envoyer});
    return {'emailEnvoye': envoyer};
  }
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('fr_FR');
    await _polices();
  });

  testWidgets('visite chez Mme Lefèvre : préparer, pièce, cote dictée, à vérifier, fin', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    var heure = DateTime.utc(2026, 10, 24, 8, 5);
    final serveur = _FauxServeur();
    final store = VisiteStore(compte: 'bilal', stockage: MemoireVisiteStockage(), serveur: serveur, surveillerReseau: false, maintenant: () => heure);
    await store.charger();
    final v = await store.creer(
      client: 'Mme Lefèvre',
      email: 's.lefevre.k@exemple.fr',
      adresse: '12 rue Exemple, Paris 10e',
      demande: "Douche à l'italienne à la place de la baignoire, faïence toute hauteur, WC suspendu, meuble vasque 80 cm. 4e sans ascenseur.",
      rdvLe: '2026-10-24T08:00:00Z',
    );
    Visite? ouvert;
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ProVisiteScreen(
        store: store,
        visiteId: '${v['id']}',
        auteur: 'Bilal A.',
        maintenant: () => heure,
        prendrePhoto: () async => _png,
        onOuvrirDevis: (x) async => ouvert = x,
      ),
    ));
    await tester.pumpAndSettle();

    // 1 · Préparer, hors ligne.
    expect(find.text('Visite · samedi 10 h'), findsOneWidget);
    expect(find.text('Support des murs, faïence à déposer'), findsOneWidget);
    await expectLater(find.byType(ProVisiteScreen), matchesGoldenFile('goldens/pro_visite_preparer.png'));
    await tester.tap(find.text('Commencer la visite'));
    await tester.pumpAndSettle();

    // 2 · Pièce par pièce : cotes (dont une dictée), question de Koji.
    for (final c in [
      {'libelle': 'Longueur', 'valeur': 2.4},
      {'libelle': 'Largeur', 'valeur': 2.42},
      {'libelle': 'Hauteur', 'valeur': 2.5},
      {'libelle': 'Porte', 'largeur': 0.83, 'hauteur': 2.04},
      {'libelle': 'Fenêtre', 'largeur': 0.6, 'hauteur': 0.8},
    ]) {
      ((store.lire('${v['id']}')!['pieces'] as List).first['cotes'] as List).add(<String, dynamic>{'id': '${c['libelle']}', ...c});
    }
    heure = heure.add(const Duration(minutes: 13));
    await tester.tap(find.text('Cote'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Mur de la vasque un mètre douze');
    await tester.pumpAndSettle();
    expect(find.text('Mur de la vasque · 1,12 m'), findsOneWidget);
    await expectLater(find.byType(BottomSheet), matchesGoldenFile('goldens/pro_visite_cote.png'));
    await tester.tap(find.text('Enregistrer la cote'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Photo'));
    await tester.pumpAndSettle();
    heure = heure.add(const Duration(minutes: 9));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('sol 5,81 m² · murs 21,93 m²'), findsOneWidget);
    expect(find.text('Mur de la vasque'), findsOneWidget);
    expect(find.text('83 × 204'), findsOneWidget);
    expect(find.text('Évacuations : quel diamètre ?'), findsOneWidget);
    // Pas de réseau : tout reste sur le téléphone.
    expect(store.horsLigne, isTrue);
    expect(find.textContaining('Hors ligne ·'), findsOneWidget);
    await expectLater(find.byType(ProVisiteScreen), matchesGoldenFile('goldens/pro_visite_piece.png'));

    for (final r in ['Ø 40', 'Cuivre', 'Plâtre sain', 'Oui', 'Escalier seulement']) {
      await tester.tap(find.text(r));
      await tester.pumpAndSettle();
    }
    expect(find.text('Ventilation : y a-t-il une VMC ?'), findsOneWidget);

    // 4 · À vérifier : la ventilation reste ; pas de VMC → extracteur.
    await tester.tap(find.text('À vérifier 5/6'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ne pas proposer'));
    await tester.pumpAndSettle();
    expect(find.text('Pas proposé'), findsOneWidget);
    await tester.tap(find.text('Non, fenêtre seulement'));
    await tester.pumpAndSettle();
    expect(find.textContaining("Pas de VMC : Koji propose un extracteur d'air dans la salle de bain"), findsOneWidget);
    await tester.tap(find.text('Ajouter extracteur en option'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Ajouté au devis, en option'), findsOneWidget);
    await expectLater(find.byType(ProVisiteScreen), matchesGoldenFile('goldens/pro_visite_verifier.png'));

    // 5 · Fin de visite, le réseau revient.
    heure = DateTime.utc(2026, 10, 24, 8, 43);
    serveur.reseau = true;
    await tester.tap(find.text('Terminer'));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Visite terminée'), findsOneWidget);
    expect(find.text('38 min · Mme Lefèvre'), findsOneWidget);
    expect(serveur.recues, isNotEmpty);
    expect(serveur.photos.length, 1);
    expect(find.textContaining('heure vérifiée'), findsOneWidget);
    expect(find.text('Lundi 26 oct.'), findsOneWidget);
    expect(find.text('Mercredi 28'), findsOneWidget);
    expect(find.textContaining("pas de VMC (extracteur proposé en option). Vous recevrez le devis d'ici lundi."), findsOneWidget);
    await expectLater(find.byType(ProVisiteScreen), matchesGoldenFile('goldens/pro_visite_fin.png'));
    await tester.tap(find.text('Mercredi 28'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ouvrir le Devis guidé'));
    await tester.pumpAndSettle();
    expect(serveur.resumes.single['devisPromis'], '2026-10-28');
    expect(serveur.resumes.single['message'], contains("Vous recevrez le devis d'ici mercredi."));
    expect(serveur.resumes.single['message'], isNot(contains('€')));
    expect(ouvert, isNotNull);
    expect(demandeDevisGuide(ouvert!), contains('Faïence toute hauteur 21,93 m²'));
    store.dispose();
  });
}
