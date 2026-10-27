import 'package:printing/printing.dart';

import 'package:koji/features/quote/repository/quote_task_repository.dart';
import 'package:koji/features/quote/services/devis_pdf_service.dart';

/// Rebuilds the full `quoteData` of a client-side devis (summary fields from
/// the quotes list + rooms / tasks loaded here) so the PDF the client reviews
/// is the same document the entreprise sent. Shared by the signature screen
/// and the client "Devis reçus" page.
Future<Map<String, dynamic>> loadClientDevisData(
    Map<String, dynamic> quote) async {
  final quoteId = quote['id'] as String;
  final repo = QuoteTaskRepository();
  final rooms = await repo.getQuoteRooms(quoteId);
  final expenses = <String, List<Map<String, dynamic>>>{};
  // Per-lot HT so the client PDF récapitulatif matches the contractor's.
  final lotTotals = <String, double>{};

  for (final room in rooms) {
    final roomName = (room['name'] as String?) ?? '';
    if (roomName.isEmpty) continue;
    final tasks = await repo.getQuoteTasks(room['id'] as String);
    final items = <Map<String, dynamic>>[];
    double lotHT = 0;
    for (final t in tasks) {
      final inputs = (t['inputs'] is Map)
          ? Map<String, dynamic>.from(t['inputs'] as Map)
          : <String, dynamic>{};
      final qty = (inputs['quantity'] as num?)?.toDouble() ?? 1.0;
      final materialQty = (inputs['fournituresQty'] as num?)?.toDouble() ?? qty;
      // hideFournitures folds the material cost into labor so the client
      // PDF shows a single combined unit price without itemising fournitures.
      final hide = inputs['hideFournitures'] == true;
      final labor = (t['unit_price_ht'] as num?)?.toDouble() ?? 0.0;
      final material = (t['total_price_ht'] as num?)?.toDouble() ?? 0.0;
      final materialTotal = materialQty * material;
      final hiddenMaterialUnit = hide && qty > 0 ? materialTotal / qty : 0.0;
      final taskId = (t['task_id'] as String?) ?? '';
      final lineType = inputs['lineType']?.toString() ?? 'normal';
      final isComment =
          taskId.startsWith('comment_') || inputs['isComment'] == true;
      items.add({
        'title': (t['label'] as String?) ?? 'Prestation',
        'quantity': qty,
        'materialQuantity': materialQty,
        'laborCost': hide ? labor + hiddenMaterialUnit : labor,
        'materialCost': hide ? 0.0 : material,
        'isFourniture': taskId.startsWith('fourniture_'),
        'isComment': isComment,
        'commentaire':
            inputs['commentaire']?.toString() ?? (t['label'] as String?) ?? '',
        'lineType': lineType,
      });
      // Une note ne contribue pas au total HT du lot.
      if (lineType == 'normal' && !isComment) {
        lotHT += qty * labor + materialQty * material;
      }
    }
    if (items.isNotEmpty) {
      expenses[roomName] = items;
      lotTotals[roomName] = lotHT;
    }
  }

  // Rebuild the récapitulatif totals from the stored global % (recap) and the
  // summed lot HT, so the client PDF shows the same provision lines + TVA.
  final recap = (quote['recap'] is Map)
      ? Map<String, dynamic>.from(quote['recap'] as Map)
      : <String, dynamic>{};
  double pct(String k, double dflt) => (recap[k] as num?)?.toDouble() ?? dflt;
  final subtotalLots = lotTotals.values.fold<double>(0, (s, v) => s + v);
  final coordPct = pct('coordPct', 10);
  final aleasPct = pct('aleasPct', 5);
  final decennalePct = pct('decennalePct', 8);
  final coordAmount = subtotalLots * coordPct / 100;
  final aleasAmount = subtotalLots * aleasPct / 100;
  final decennaleAmount = subtotalLots * decennalePct / 100;
  final generalHT = subtotalLots + coordAmount + aleasAmount + decennaleAmount;
  final tvaRate = (recap['tvaRate'] as num?)?.toInt() ??
      ((quote['totals'] is Map
              ? (quote['totals'] as Map)['tvaRate'] as num?
              : null)
          ?.toInt()) ??
      20;
  final tva = generalHT * tvaRate / 100;

  final quoteData = <String, dynamic>{
    ...quote,
    'expenses': expenses,
    'lotTotals': lotTotals,
    'totals': {
      'subtotalLots': subtotalLots,
      'coordPct': coordPct,
      'coordAmount': coordAmount,
      'aleasPct': aleasPct,
      'aleasAmount': aleasAmount,
      'decennalePct': decennalePct,
      'decennaleAmount': decennaleAmount,
      'ht': generalHT,
      'tvaRate': tvaRate,
      'tva': tva,
      'ttc': generalHT + tva,
    },
    // 'lots' (lot labels) rides through from quote (metadata).
  };

  return quoteData;
}

/// Opens the system PDF viewer / print dialog on the devis.
Future<void> previewClientDevis(Map<String, dynamic> quote) async {
  final quoteData = await loadClientDevisData(quote);
  final pdf = await DevisPdfService().generate(quoteData: quoteData);
  await Printing.layoutPdf(onLayout: (format) async => pdf.save());
}
