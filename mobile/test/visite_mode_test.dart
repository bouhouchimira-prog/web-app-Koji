import 'package:flutter_test/flutter_test.dart';
import 'package:koji/apps/entreprise/visite/visite_mode.dart';

// Mode visite (maquette PRO-03.8) : mêmes exemples que le site
// (tests/unit/visite-mode.test.js).
const _demande = "Douche à l'italienne à la place de la baignoire, faïence toute hauteur, WC suspendu, meuble vasque 80 cm. 4e sans ascenseur.";
final _cotes = <Map<String, dynamic>>[
  {'libelle': 'Longueur', 'valeur': 2.4},
  {'libelle': 'Largeur', 'valeur': 2.42},
  {'libelle': 'Hauteur', 'valeur': 2.5},
  {'libelle': 'Porte', 'largeur': 0.83, 'hauteur': 2.04},
  {'libelle': 'Fenêtre', 'largeur': 0.6, 'hauteur': 0.8},
  {'libelle': 'Mur vasque', 'valeur': 1.12},
];

void main() {
  test("prépare la liste à vérifier d'après la demande", () {
    final points = listeAVerifier(_demande);
    expect(points.map((p) => p['libelle']), [
      'Évacuations : diamètre et pente',
      "Arrivées d'eau et robinet d'arrêt",
      'Support des murs, faïence à déposer',
      'Différentiel 30 mA au tableau',
      'Accès, stockage et évacuation des gravats',
      'Ventilation existante',
    ]);
    expect(listeAVerifier('Peindre le salon').map((p) => p['id']), ['support', 'acces']);
    expect(prochaineQuestion(points)!['question'], 'Évacuations : quel diamètre ?');
    expect(points.firstWhere((p) => p['id'] == 'ventilation')['choix'], ['Oui', 'Non, fenêtre seulement', 'Je ne sais pas']);
  });

  test('comprend les cotes dictées', () {
    expect(comprendreCote('Mur du fond deux mètres quarante'), {'libelle': 'Mur du fond', 'valeur': 2.4});
    expect(comprendreCote('Porte quatre-vingt-trois par deux cent quatre'), {'libelle': 'Porte', 'largeur': 0.83, 'hauteur': 2.04});
    expect(comprendreCote('Fenêtre 60 x 80'), {'libelle': 'Fenêtre', 'largeur': 0.6, 'hauteur': 0.8});
    expect(comprendreCote('hauteur deux cinquante'), {'libelle': 'Hauteur', 'valeur': 2.5});
    expect(comprendreCote('Mur de la vasque un mètre douze'), {'libelle': 'Mur de la vasque', 'valeur': 1.12});
    expect(comprendreCote('longueur 2,40'), {'libelle': 'Longueur', 'valeur': 2.4});
    expect(comprendreCote('Largeur 2 m 42'), {'libelle': 'Largeur', 'valeur': 2.42});
    expect(comprendreCote('Allège 110'), {'libelle': 'Allège', 'valeur': 1.1});
    expect(comprendreCote('deux mètres cinq'), {'libelle': '', 'valeur': 2.05});
    expect(comprendreCote('Placard quatre-vingt-dix centimètres'), {'libelle': 'Placard', 'valeur': 0.9});
    expect(comprendreCote('pas de nombre ici'), isNull);
  });

  test('calcule sol, murs et quantités depuis les cotes, avec la formule', () {
    final s = surfaces(_cotes);
    expect(s.sol, 5.81);
    expect(s.murs, 21.93);
    expect(s.bande, 8.81);
    expect(resumeSurfaces(_cotes), 'sol 5,81 m² · murs 21,93 m²');
    expect(texteCote(_cotes[3]), '0,83 × 2,04 m');
    expect(texteCoteCourt(_cotes[3]), '83 × 204');
    expect(quantitesCalculees({'cotes': _cotes}, _demande).map((q) => [q['libelle'], q['formule'], q['valeur'], q['unite']]), [
      ['Sol à carreler', '2,40 × 2,42', 5.81, 'm²'],
      ['Faïence toute hauteur', 'périmètre 9,64 × 2,50 − porte − fenêtre', 21.93, 'm²'],
      ["Bande d'angle d'étanchéité", 'périmètre − porte', 8.81, 'ml'],
      ['Dépose faïence existante', 'même surface', 21.93, 'm²'],
    ]);
  });

  test("propose ce qu'une vérification change, et le résumé sans prix", () {
    final points = [
      for (final p in listeAVerifier(_demande)) {...p, 'reponse': {'evacuations': 'Ø 40', 'ventilation': 'Non, fenêtre seulement'}[p['id']] ?? ''},
    ];
    final props = propositions(points, 'Salle de bain');
    expect(props.length, 1);
    expect(props.first['texte'], "Pas de VMC : Koji propose un extracteur d'air dans la salle de bain, en option sur le devis. Une photo de la fenêtre suffit.");
    final visite = <String, dynamic>{
      'client': 'Mme Lefèvre',
      'pieces': [
        {
          'nom': 'Salle de bain',
          'points': points,
          'cotes': _cotes,
          'photos': [{'id': 'a'}, {'id': 'b', 'envoye': true}],
          'notes': [{'texte': 'Cliente veut garder le radiateur.'}],
        }
      ],
      'propositions': {'extracteur': 'acceptee'},
    };
    expect(resumeClient(visite, '2026-10-26'),
        'Bonjour Mme Lefèvre,\n\nMerci pour la visite. Points vus : évacuation Ø 40, pas de VMC (extracteur proposé en option). Vous recevrez le devis d\'ici lundi.');
    expect(compteVisite(visite).texte, '2 photos, 6 cotes, 2 vérifications, 1 note');
    expect(questionsRestantes(visite), 4);
    expect(enAttente(visite), 1 + 6 + 1 + 2);
    final demande = demandeDevisGuide({...visite, 'demande': _demande, 'adresse': '12 rue Exemple, Paris 10e'});
    expect(demande, contains('Quantités : Sol à carreler 5,81 m² ; Faïence toute hauteur 21,93 m²'));
    expect(demande, contains("À ajouter : Fourniture et pose d'un extracteur d'air (en option)."));
    expect(demande.contains('€'), isFalse);
  });

  test('propose la date promise du devis et le rappel la veille', () {
    expect(datesPromises('2026-10-24').map((d) => [d.jour, d.label]), [
      ['2026-10-26', 'Lundi 26 oct.'],
      ['2026-10-28', 'Mercredi 28'],
    ]);
    expect(datesPromises('2026-10-29').map((d) => d.label), ['Vendredi 30 oct.', 'Mardi 3 nov.']);
    expect(veille('2026-10-26'), '2026-10-25');
    expect(dureeVisite('2026-10-24T08:05:00Z', '2026-10-24T08:43:00Z'), '38 min');
  });
}
