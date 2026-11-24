import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart';
import 'package:koji/apps/entreprise/devis/pro_devis_guide_view.dart';
import 'package:koji/features/bibliotheque/bibliotheque_logic.dart';
import 'package:koji/features/quote/model/devis_line.dart';
import 'package:koji/features/quote/services/devis_pdf_service.dart';

// Retours du build 64, sprint 3 : cohérence des devis. Les frais visibles et
// retirables dans le devis guidé, les taux du compte, les montants du PDF, le
// taux de la bibliothèque et le libellé de confiance.

DevisGuideDonnees _devis() => DevisGuideDonnees(
      linesByRoom: {
        'lot1': [
          DevisLine(taskId: 'l1', label: 'Peindre un plafond en 2 couches', unite: 'm²', qty: 10, tempsHU: 0.26, tauxHoraire: 75),
        ],
      },
      roomOrder: ['lot1'],
      lotMeta: {
        'lot1': {'number': 1, 'title': 'Peinture'}
      },
      tauxHoraire: () => 75,
      nouvelId: (p) => '$p-1',
      nomPiece: (r) => r,
    );

List<FraisDevis> _frais(double coord, double aleas, double decennale) => [
      FraisDevis(id: 'coord', label: 'Coordination de chantier', pct: coord, montant: 195 * coord / 100, pctParDefaut: 10),
      FraisDevis(id: 'aleas', label: 'Provision aléas de chantier', pct: aleas, montant: 195 * aleas / 100, pctParDefaut: 5),
      FraisDevis(id: 'decennale', label: 'Assurance décennale', pct: decennale, montant: 195 * decennale / 100, pctParDefaut: 8),
    ];

void main() {
  test('frais du compte : ceux réglés dans « Mes prix », comme sur le site', () {
    expect(fraisDuCompte(null), isNull, reason: "rien de réglé : l'app garde ses taux");
    expect(fraisDuCompte('x'), isNull);
    // Aléas seulement, facturés au client ; déplacement au forfait (non repris).
    final f = fraisDuCompte([
      {'id': 'sc-alea', 'label': 'Provision aléas de chantier', 'percent': 5, 'mode': 'client'},
      {'id': 'sc-dep', 'label': 'Déplacement', 'kind': 'fixe', 'montant': 40, 'mode': 'client'},
    ])!;
    expect((f.coord, f.aleas, f.decennale), (0, 5, 0));
    // Un frais non facturé au client ne s'ajoute pas au devis.
    final g = fraisDuCompte([
      {'id': 'sc-coord', 'label': 'Coordination de chantier', 'percent': 10, 'mode': 'excluded'},
      {'id': 'x1', 'label': 'Assurance décennale', 'percent': 7.5, 'mode': 'internal'},
    ])!;
    expect((g.coord, g.aleas, g.decennale), (0, 0, 7.5));
    expect(fraisDuCompte(const [])!.coord, 0);
  });

  test('libellés des frais et montants à la française', () {
    final [coord, aleas, _] = _frais(10, 0, 8);
    expect(coord.titre, 'Coordination de chantier 10 %');
    expect(coord.actif, isTrue);
    expect(aleas.actif, isFalse);
    expect(aleas.titre, 'Provision aléas de chantier 5 %', reason: 'retiré : le taux qui serait remis');
    expect(pourcent(5.5), '5,5 %');
    expect(montantPdf(1866.22), '1 866,22 €');
    expect(montantPdf(239.85), '239,85 €');
    expect(montantPdf(19.5), '19,50 €');
    expect(montantPdf(1234567), '1 234 567,00 €');
    expect(montantPdf(-40), '-40,00 €');
  });

  test('bibliothèque : taux du profil avant la référence de la famille, confiance en clair', () {
    // « Peindre un plafond en 2 couches » : 0,26 h. 13,00 € à 50 €/h dans la
    // bibliothèque, 19,50 € à 75 €/h dans le devis : un seul taux désormais.
    final o = {'normativeTime': 0.26, 'coefficient': 1};
    final taux = tauxOuvrage(o, tauxDefaut: tauxParDefaut(tauxProfil: 75, defautFamille: 50));
    expect(taux, 75);
    expect(moOuvrage(o, taux).parUnite, 19.5);
    expect(tauxParDefaut(tauxProfil: 0, defautFamille: 50), 50);
    expect(tauxOuvrage({...o, 'hourlyRate': 60}, tauxFamille: 55, tauxDefaut: 75), 60, reason: "le taux propre à l'ouvrage passe d'abord");
    expect(tauxOuvrage(o, tauxFamille: 55, tauxDefaut: 75), 55, reason: 'puis le taux du métier');
    expect(libelleConfiance('A'), 'temps chronométré');
    expect(libelleConfiance('B'), 'temps recalé');
    expect(libelleConfiance('C'), 'temps estimé');
    expect(libelleConfiance(null), 'temps estimé');
  });

  testWidgets('le résumé du devis montre les frais, et permet de les retirer', (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final d = _devis();
    var frais = _frais(10, 5, 8);
    final demandes = <(String, bool)>[];
    double total() => 195 + frais.fold<double>(0, (s, f) => s + f.montant);
    final c = DevisGuideConversation(
      flux: (_) => const Stream.empty(),
      instantane: () => d.instantane(client: const {}, sousTotal: 195, majorations: const [], totalHt: total(), totalTtc: total() * 1.1),
      appliquer: d.appliquer,
      enregistrer: () async => (id: 'q1', le: '2026-11-24T10:00:00Z'),
      resultat: d.resultat,
    );
    late StateSetter maj;
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: StatefulBuilder(builder: (context, setState) {
        maj = setState;
        return ProDevisGuideView(
          titre: 'Devis 2026-0002',
          sousTitre: 'Brouillon',
          conversation: c,
          donnees: d,
          totalHt: total(),
          totalTtc: total() * 1.1,
          sousTotal: 195,
          frais: frais,
          onFrais: (id, actif) {
            demandes.add((id, actif));
            maj(() => frais = _frais(id == 'coord' && !actif ? 0 : 10, 5, 8));
          },
          onRetour: () {},
          onEnvoyer: () {},
          onChange: () {},
          onAjouterOuvrage: (_) async {},
          onAjouterFourniture: (_, {String parentTaskId = ''}) async {},
          onAjouterLot: () async {},
          onSupprimer: (_, __) {},
          onEditionDetaillee: () {},
          feuilleOuverte: true,
          tauxTva: 'TVA 10 %',
        );
      }),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sous-total des lignes'), findsOneWidget);
    expect(find.text('Coordination de chantier 10 %'), findsOneWidget);
    expect(find.text('Provision aléas de chantier 5 %'), findsOneWidget);
    expect(find.text('Assurance décennale 8 %'), findsOneWidget);
    expect(find.text('Retirer'), findsNWidgets(3));

    await tester.ensureVisible(find.text('Retirer').first);
    await tester.tap(find.text('Retirer').first);
    await tester.pumpAndSettle();
    expect(demandes, [('coord', false)]);
    expect(find.text('Remettre'), findsOneWidget);
    expect(find.text('retiré'), findsOneWidget);
    expect(find.text('Retirer'), findsNWidgets(2));
  });
}
