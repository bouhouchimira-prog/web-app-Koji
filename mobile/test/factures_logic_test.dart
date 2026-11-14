import 'package:flutter_test/flutter_test.dart';
import 'package:koji/features/factures/factures_logic.dart';

void main() {
  final now = DateTime(2026, 11, 20);

  test('bucket : retard calculé, avoir jamais en retard', () {
    expect(invoiceBucket({'status': 'Emise', 'dueDate': '2026-11-10'}, now: now), 'Retard');
    expect(invoiceBucket({'status': 'Emise', 'dueDate': '2026-11-20'}, now: now), 'Emise');
    expect(invoiceBucket({'status': 'Emise', 'dueDate': '2026-11-01', 'kind': 'avoir'}, now: now), 'Avoir');
    expect(invoiceBucket({'status': 'Payee', 'dueDate': '2026-10-01'}, now: now), 'Payee');
  });

  test('niveau de relance selon le retard (3 / 15 / 30 jours)', () {
    expect(suggestedLevel({'dueDate': '2026-11-17'}, now: now), 'aimable');
    expect(suggestedLevel({'dueDate': '2026-11-05'}, now: now), 'ferme');
    expect(suggestedLevel({'dueDate': '2026-10-21'}, now: now), 'demeure');
    expect(daysLate({'dueDate': '2026-10-21'}, now: now), 30);
  });

  test('avoirs : montant couvert et possibilité d\'en créer un autre', () {
    final facture = {'id': 'f1', 'status': 'Emise', 'amountTtc': 1000};
    final all = [
      facture,
      {'id': 'a1', 'kind': 'avoir', 'refInvoiceId': 'f1', 'status': 'Emise', 'amountTtc': -400},
      {'id': 'a2', 'kind': 'avoir', 'refInvoiceId': 'f1', 'status': 'Annulee', 'amountTtc': -600},
    ];
    expect(creditedOn(facture, all), 400);
    expect(canCreditNote(facture, all), isTrue);
    all.add({'id': 'a3', 'kind': 'avoir', 'refInvoiceId': 'f1', 'status': 'Emise', 'amountTtc': -600});
    expect(canCreditNote(facture, all), isFalse);
    expect(canCreditNote({'id': 'b', 'status': 'Brouillon', 'amountTtc': 10}, all), isFalse);
  });

  test('résumé de facturation : un avoir rend le montant facturable', () {
    final summary = billingSummary(5798.54, [
      {'status': 'Emise', 'amountTtc': 1739.56},
      {'status': 'Emise', 'amountTtc': -239.56, 'kind': 'avoir'},
      {'status': 'Annulee', 'amountTtc': 999},
    ]);
    expect(summary.already, closeTo(1500, 0.001));
    expect(summary.remaining, closeTo(4298.54, 0.001));
    expect(summary.state, 'Partielle');
    expect(billingSummary(100, [{'status': 'Payee', 'amountTtc': 100}]).state, 'Soldée');
  });

  test('indicateurs : en retard et à échéance séparés, avoirs exclus', () {
    final stats = facturesStats([
      {'status': 'Emise', 'dueDate': '2026-11-01', 'amountTtc': 300},
      {'status': 'Emise', 'dueDate': '2026-12-01', 'amountTtc': 200},
      {'status': 'Emise', 'dueDate': '2026-11-01', 'amountTtc': -50, 'kind': 'avoir'},
      {'status': 'Payee', 'paidAt': '2026-11-03T10:00:00Z', 'amountTtc': 1000},
      {'status': 'Brouillon', 'amountTtc': 80},
    ], now: now);
    expect(stats.late, 300);
    expect(stats.pending, 200);
    expect(stats.paidThisMonth, 1000);
    expect(stats.draftCount, 1);
  });

  test('devis facturables : signés ou transformés, chantier archivé exclu', () {
    final quotes = [
      {'id': 'q1', 'status': 'Signe', 'projectId': 'c1', 'quoteNumber': '2026_1050', 'totalTtc': 1200},
      {'id': 'q2', 'status': 'Envoye', 'signatureStatus': 'Signe', 'projectId': '', 'project': 'Cuisine', 'totalTtc': 0, 'totalHt': 800},
      {'id': 'q3', 'status': 'Brouillon', 'projectId': 'c1'},
      {'id': 'q4', 'status': 'Envoye', 'projectId': 'c2'},
      {'id': 'q5', 'status': 'Signe', 'projectId': 'c3'},
    ];
    final projects = [
      {'id': 'c1', 'title': 'Rénovation Martin', 'client': 'martin', 'status': 'En cours'},
      {'id': 'c3', 'title': 'Vieux chantier', 'status': 'Archive'},
    ];
    final invoices = [
      {'id': 'f1', 'quoteId': 'q4', 'sourceType': 'quote-transform', 'status': 'Brouillon', 'amountTtc': 10},
      {'id': 'f2', 'quoteId': 'q1', 'projectId': 'c1', 'status': 'Emise', 'amountTtc': 360},
    ];
    final billable = billableQuotes(quotes, projects, invoices);
    expect(billable.map((b) => b.id), ['q1', 'q2', 'q4']);
    expect(billable[0].title, 'Rénovation Martin');
    expect(billable[0].summary(invoices).remaining, 840);
    expect(billable[1].projectId, 'quote-q2');
    expect(billable[1].title, 'Cuisine');
    expect(billable[1].total, 800);
    final summary = billable[0].summary(invoices);
    expect(previewAmount('deposit', summary, deposit: 30), 360);
    expect(previewAmount('remaining', summary), 840);
    expect(previewAmount('fixed', summary, fixed: 99.5), 99.5);
  });

  test('textes de relance identiques au site', () {
    final invoice = {
      'invoiceNumber': 'FAC-2026-0121',
      'client': 'Mme Lefèvre',
      'amountTtc': 2515,
      'dueDate': '2026-10-21',
      'reminders': [{'level': 'aimable', 'at': '2026-10-25T09:00:00Z'}],
    };
    final ferme = reminderText('ferme', invoice, company: 'ABL Expert Renov', now: now);
    expect(ferme, contains('Malgré notre précédent rappel du 25 octobre'));
    expect(ferme, contains('(30 jours de retard)'));
    expect(ferme, endsWith('Cordialement,\nABL Expert Renov'));
    final demeure = reminderText('demeure', invoice, now: now);
    expect(demeure, startsWith('Objet : mise en demeure de payer, facture FAC-2026-0121'));
    expect(demeure, contains('échue le 21 octobre 2026, malgré nos relances du 25 octobre'));
    // Espaces insécables comme toLocaleString('fr-FR') côté site.
    expect(euro(2515).replaceAll(RegExp('[  ]'), ' '), '2 515,00 €');
  });

  test("avoir au taux d'origine et facture corrigée à 10 % (maquette PRO-06.1)", () {
    final a = avoirCorrige(2743.63, 20, 10);
    expect((a.ht, a.tva, a.ttc, a.nouveauTtc), (2286.36, 457.27, 2743.63, 2515.0));
    expect(tauxFacture({'tauxTva': 10}), 10);
    expect(tauxFacture({'situation': {'tauxTva': 5.5}}), 5.5);
    expect(tauxFacture({'quoteId': 'q1'}, [{'id': 'q1', 'vatRate': 10}]), 10);
    expect(tauxFacture({}), 20);
    expect(tauxTexte(5.5), '5,5');
  });
}
