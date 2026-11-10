import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/pro_home/chiffres_du_mois.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// Mêmes cas que tests/unit/chiffres-du-mois.test.js côté site : les deux
// accueils doivent afficher les mêmes chiffres.
void main() {
  final aujourdhui = DateTime(2026, 11, 9, 12);
  final periodes = periodesDisponibles(aujourdhui);
  final octobre = periodes[0], novembre = periodes[1], annee = periodes[2];
  String d(int m, int j) => DateTime(2026, m, j, 10).toUtc().toIso8601String();

  final quotes = <Map<String, dynamic>>[
    {
      'id': 'q1',
      'projectId': 'p1',
      'status': 'Signe',
      'totalHt': 1000,
      'totalTtc': 1100
    },
    {
      'id': 'q2',
      'projectId': 'p2',
      'status': 'Envoye',
      'totalHt': 500,
      'totalTtc': 600
    },
  ];

  test('périodes : mois précédent, mois en cours, année', () {
    expect(periodes.map((p) => p.label), ['Octobre', 'Novembre', 'Année']);
    expect(novembre.titre, 'Novembre 2026');
    expect(periodesDisponibles(DateTime(2027, 1, 15)).first.titre,
        'Décembre 2026');
  });

  test('facturé HT : émises du mois, avoirs déduits, brouillons ignorés', () {
    final invoices = <Map<String, dynamic>>[
      {
        'id': 'f1',
        'amountTtc': 1100,
        'quoteId': 'q1',
        'status': 'Emise',
        'issuedAt': d(11, 3)
      },
      {
        'id': 'f2',
        'amountTtc': 600,
        'quoteId': 'q2',
        'status': 'Payee',
        'issuedAt': d(11, 4),
        'paidAt': d(11, 6)
      },
      {
        'id': 'av1',
        'kind': 'avoir',
        'amountTtc': -110,
        'quoteId': 'q1',
        'refInvoiceId': 'f1',
        'status': 'Emise',
        'issuedAt': d(11, 5)
      },
      {'id': 'f3', 'amountTtc': 999, 'status': 'Brouillon', 'issuedAt': ''},
      {'id': 'f4', 'amountTtc': 999, 'status': 'Annulee', 'issuedAt': d(11, 2)},
      {'id': 'f5', 'amountTtc': 240, 'status': 'Emise', 'issuedAt': d(10, 20)},
    ];
    final r = chiffresDuMois(
        invoices: invoices,
        quotes: quotes,
        periode: novembre,
        aujourdhui: aujourdhui);
    expect(r.facture.total.round(), 1400);
    expect(r.facture.factures, 2);
    expect(r.facture.avoirs, 1);
    expect(r.facture.htEstimes, 0);
    expect(resumeFacture(r.facture), '2 factures, 1 avoir');

    final oct = chiffresDuMois(
        invoices: invoices,
        quotes: quotes,
        periode: octobre,
        aujourdhui: aujourdhui);
    expect(oct.facture.total.round(), 200);
    expect(oct.facture.htEstimes, 1);
    expect(r.depuisJanvier.round(), 1600);
  });

  test('encaissé TTC à la date de paiement', () {
    final invoices = <Map<String, dynamic>>[
      {
        'id': 'f1',
        'amountTtc': 600,
        'status': 'Payee',
        'issuedAt': d(10, 28),
        'paidAt': d(11, 2)
      },
      {
        'id': 'f2',
        'amountTtc': 300,
        'status': 'Payee',
        'issuedAt': d(10, 1),
        'paidAt': d(10, 5)
      },
    ];
    final r = chiffresDuMois(
        invoices: invoices,
        quotes: quotes,
        periode: novembre,
        aujourdhui: aujourdhui);
    expect((r.encaisse, r.paiements), (600.0, 1));
    final an = chiffresDuMois(
        invoices: invoices,
        quotes: quotes,
        periode: annee,
        aujourdhui: aujourdhui);
    expect((an.encaisse, an.paiements), (900.0, 2));
  });

  test('reste à encaisser : avoirs déduits, retard le plus long', () {
    final invoices = <Map<String, dynamic>>[
      {
        'id': 'f1',
        'amountTtc': 1100,
        'status': 'Emise',
        'dueDate': '2026-11-01',
        'client': 'SCI Auteuil'
      },
      {
        'id': 'av1',
        'kind': 'avoir',
        'amountTtc': -100,
        'refInvoiceId': 'f1',
        'status': 'Emise'
      },
      {
        'id': 'f2',
        'amountTtc': 500,
        'status': 'Emise',
        'dueDate': '2026-12-01'
      },
      {
        'id': 'f3',
        'amountTtc': 200,
        'status': 'Emise',
        'dueDate': '2026-10-20',
        'archived': true
      },
      {
        'id': 'f4',
        'amountTtc': 300,
        'status': 'Payee',
        'dueDate': '2026-10-01'
      },
    ];
    final r = chiffresDuMois(
        invoices: invoices,
        quotes: quotes,
        periode: octobre,
        aujourdhui: aujourdhui);
    expect(r.reste.total, 1500);
    expect((r.reste.impayees, r.reste.echues, r.reste.retardMax), (2, 1, 8));
    expect(r.reste.premiereEchue?['client'], 'SCI Auteuil');
    expect(resumeReste(r.reste), '2 factures, 1 échue de 8 jours');
  });

  test('marge moyenne pondérée, chantiers sans dépense ignorés', () {
    final projects = [
      {'id': 'p1'},
      {'id': 'p2'},
      {'id': 'p3'}
    ];
    final expenses = [
      {'projectId': 'p1', 'amount': 600},
      {'projectId': 'p2', 'amount': 100},
      {'projectId': 'p2', 'amount': 100},
    ];
    final marge =
        margeMoyenne(projects: projects, quotes: quotes, expenses: expenses)!;
    expect(marge.chantiers, 2);
    expect((marge.taux * 100).round(), 47);
    expect(margeMoyenne(projects: projects, quotes: quotes, expenses: const []),
        isNull);
  });

  test('prix recommandé du Radar : montant arrondi, ou « À chiffrer »', () {
    const avecPrix = RadarOffre(data: {
      'id': 'o1',
      'prixRecommande': {
        'ttc': 6000,
        'ht': 5454.55,
        'chiffres': 4,
        'manquants': 1,
        'postes': 5
      },
    });
    const sansPrix = RadarOffre(data: {
      'id': 'o2',
      'prixRecommande': {
        'ttc': null,
        'chiffres': 0,
        'manquants': 3,
        'postes': 3
      },
    });
    expect(avecPrix.prixTtc, 6000);
    expect(prixCourt(avecPrix).replaceAll(' ', ' ').replaceAll(' ', ' '),
        '6 000 €');
    expect(notePrix(avecPrix),
        '1 poste sur 5 sans prix dans votre bibliothèque : il n\'est pas compté.');
    expect(sansPrix.prixTtc, isNull);
    expect(prixCourt(sansPrix), 'À chiffrer');
    expect(notePrix(sansPrix), contains("Koji n'invente pas de montant"));
    expect(avecPrix.prixPartiel, isTrue);
    const sansTaux = RadarOffre(data: {
      'id': 'o3',
      'prixRecommande': {
        'ttc': null,
        'chiffres': 0,
        'manquants': 2,
        'postes': 2,
        'tauxManquant': true
      },
    });
    expect(notePrix(sansTaux), contains("taux de main-d'œuvre"));
    final tries = [sansPrix, avecPrix]..sort(comparerPrix);
    expect(tries.first.id, 'o1');
  });
}
