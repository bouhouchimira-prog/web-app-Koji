import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/factures/factures_logic.dart';

// Factures de Koji Pro : lues et écrites par l'API du site (app/api/invoices),
// la même base que /facturation sur le web. Aucune facture n'est plus stockée
// dans les tables Supabase `invoices` / `invoice_payments` de l'app.

final facturesRepositoryProvider = Provider<FacturesRepository>(
  (ref) => FacturesRepository(ref.watch(kojiProApiProvider)),
);

/// Tout ce que montrent les écrans Factures, chargé d'un coup (les mêmes
/// listes que la page /facturation du site).
final facturesProvider = FutureProvider.autoDispose<FacturesData>(
  (ref) => ref.watch(facturesRepositoryProvider).load(),
);

class FacturesData {
  const FacturesData({
    required this.invoices,
    required this.quotes,
    required this.projects,
    this.company = '',
  });

  final List<Invoice> invoices;
  final List<Map<String, dynamic>> quotes;
  final List<Map<String, dynamic>> projects;

  /// Raison sociale, signée en bas des relances.
  final String company;

  /// Factures affichées : les annulées disparaissent de la liste, comme sur
  /// le site ; les plus récentes d'abord.
  List<Invoice> get shown => invoices.where(isActive).toList()
    ..sort((a, b) => '${b['createdAt'] ?? ''}'.compareTo('${a['createdAt'] ?? ''}'));

  List<BillableQuote> get billable => billableQuotes(quotes, projects, invoices);
}

class FacturesRepository {
  FacturesRepository(this._api);
  final KojiProApi _api;

  Future<FacturesData> load() async {
    final company = _company();
    final lists = await Future.wait([
      _api.list('/api/invoices', 'invoices'),
      _api.list('/api/quotes', 'quotes'),
      _api.list('/api/projects', 'projects'),
    ]);
    return FacturesData(invoices: lists[0], quotes: lists[1], projects: lists[2], company: await company);
  }

  Future<String> _company() async {
    try {
      final body = await _api.get('/api/auth/profile');
      final user = body['user'];
      final business = user is Map ? user['business'] : null;
      return business is Map ? '${business['raisonSociale'] ?? ''}'.trim() : '';
    } catch (_) {
      return '';
    }
  }

  Invoice _invoice(Map<String, dynamic> body) => Map<String, dynamic>.from(body['invoice'] as Map);

  /// Nouvelle facture depuis un devis signé (mêmes modes que le site).
  Future<Invoice> create({
    required BillableQuote quote,
    required String type,
    required String amountMode,
    double fixedAmount = 0,
    double percent = 30,
    double depositPercent = 30,
    required String dueDate,
    String notes = '',
  }) async =>
      _invoice(await _api.post('/api/invoices', {
        'projectId': quote.projectId,
        'quoteId': quote.id,
        'type': type,
        'amountMode': amountMode,
        'fixedAmount': fixedAmount,
        'percent': percent,
        'depositPercent': depositPercent,
        'dueDate': dueDate,
        'notes': notes,
      }));

  /// issue, pay, cancel, delete (corbeille), reminders-off, reminders-on.
  Future<Invoice> update(String id, String action) async =>
      _invoice(await _api.patch('/api/invoices', {'id': id, 'action': action}));

  /// Avoir total (amount null) ou partiel sur une facture envoyée.
  Future<Invoice> creditNote(Invoice original, {required String reason, double? amount, String notes = ''}) async =>
      _invoice(await _api.post('/api/invoices', {
        'creditNoteFor': original['id'],
        'reason': reason,
        if (amount != null) 'amountTtc': amount,
        'notes': notes,
      }));

  /// Facture refaite après un avoir (PRO-06.1) : même HT, nouveau taux.
  Future<Invoice> correctedInvoice(Invoice original, Invoice avoir, {required double amountTtc, required double tauxTva}) async =>
      _invoice(await _api.post('/api/invoices', {
        'quoteId': original['quoteId'],
        'projectId': original['projectId'],
        'type': original['type'] ?? 'Facture',
        'amountMode': 'fixed',
        'fixedAmount': amountTtc,
        'tauxTva': tauxTva,
        'remplace': {'avoirId': avoir['id'], 'factureNumero': original['invoiceNumber']},
        'notes': 'Remplace la facture ${original['invoiceNumber']} (avoir ${avoir['invoiceNumber']}). TVA ${tauxTexte(tauxTva)} %.',
      }));

  /// Avoir + facture corrigée dans un seul message au client.
  Future<Invoice> sendWithCreditNote(Invoice invoice, Invoice avoir, {required String to, required String message}) async =>
      _invoice(await _api.patch('/api/invoices', {
        'id': invoice['id'],
        'action': 'send',
        'email': true,
        'to': to,
        'avoirId': avoir['id'],
        'message': message,
      }));

  /// channel « email » : envoyée au client avec la facture jointe ; « manuel » :
  /// seulement notée (la mise en demeure part toujours en recommandé).
  Future<Invoice> remind(Invoice invoice, {required String level, required String channel, required String text}) async =>
      _invoice(await _api.patch('/api/invoices', {
        'id': invoice['id'],
        'action': 'remind',
        'level': level,
        'channel': channel,
        'text': text,
      }));

  /// Le PDF généré par le site (un devis transformé garde le PDF du devis
  /// en version facture).
  Future<Uint8List> pdf(Invoice invoice) {
    final quoteId = '${invoice['quoteId'] ?? ''}';
    if (invoice['sourceType'] == 'quote-transform' && quoteId.isNotEmpty) {
      return _api.getBytes('/api/quotes/$quoteId/documents', query: {'type': 'facture', 'format': 'pdf'});
    }
    return _api.getBytes('/api/invoices/pdf', query: {'id': invoice['id']});
  }
}

String invoicePdfFilename(Invoice invoice) {
  final number = '${invoice['invoiceNumber'] ?? 'facture'}'.replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '_');
  return '${isCreditNote(invoice) ? 'Avoir' : 'Facture'}_$number.pdf';
}
