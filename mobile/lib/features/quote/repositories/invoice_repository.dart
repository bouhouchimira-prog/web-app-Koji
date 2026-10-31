import 'package:supabase_flutter/supabase_flutter.dart';

/// Repository for chantier invoices (Facturation).
///
/// An invoice is always tied to a chantier and (normally) to the signed devis
/// it bills against. The billed [amount] is stored as a concrete € value; the
/// UI may compute it from a percentage / deposit / remaining balance but the
/// authoritative figure is `amount`. Summing a chantier's invoice amounts gives
/// the "déjà facturé" total used to compute the remaining balance.
class InvoiceRepository {
  final SupabaseClient _client = Supabase.instance.client;

  /// All invoices for a chantier, newest first.
  Future<List<Map<String, dynamic>>> getInvoices(String chantierId) async {
    final response = await _client
        .from('invoices')
        .select()
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Stream invoices for a chantier (real-time).
  Stream<List<Map<String, dynamic>>> streamInvoices(String chantierId) {
    return _client
        .from('invoices')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  /// Sum of every invoice amount already created for this chantier.
  Future<double> totalInvoiced(String chantierId) async {
    final rows = await _client
        .from('invoices')
        .select('amount')
        .eq('chantier_id', chantierId);
    double sum = 0;
    for (final r in rows) {
      sum += num.tryParse(r['amount']?.toString() ?? '0')?.toDouble() ?? 0;
    }
    return sum;
  }

  /// Generate the next sequential invoice number, scoped per user and year.
  /// Format: FAC-YYYY-NNNN (e.g. FAC-2026-0001).
  Future<String> generateNextInvoiceNumber(String userId) async {
    final year = DateTime.now().year;
    final prefix = 'FAC-$year-';
    try {
      final rows = await _client
          .from('invoices')
          .select('reference')
          .eq('user_id', userId)
          .like('reference', '$prefix%');

      int maxSeq = 0;
      for (final r in rows) {
        final ref = (r['reference'] as String?) ?? '';
        final tail = ref.substring(ref.lastIndexOf('-') + 1);
        final n = int.tryParse(tail) ?? 0;
        if (n > maxSeq) maxSeq = n;
      }
      final next = (maxSeq + 1).toString().padLeft(4, '0');
      return '$prefix$next';
    } catch (_) {
      return '$prefix${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    }
  }

  /// Create an invoice for a chantier.
  ///
  /// [amount] is the concrete € amount billed. [type] is one of
  /// 'acompte' | 'intermediaire' | 'finale'. [amountMode] records how the user
  /// picked the amount ('fixed' | 'percent' | 'deposit' | 'balance').
  Future<Map<String, dynamic>> createInvoice({
    required String chantierId,
    String? quoteId,
    required double quoteTotal,
    required String type,
    required double amount,
    String? amountMode,
    double? percent,
    String? note,
    String? clientName,
    String? clientEmail,
    DateTime? dueDate,
    String status = 'draft',
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final reference = await generateNextInvoiceNumber(userId);

    final inserted = await _client.from('invoices').insert({
      'user_id': userId,
      'chantier_id': chantierId,
      if (quoteId != null) 'quote_id': quoteId,
      'quote_total': quoteTotal,
      'reference': reference,
      'type': type,
      if (amountMode != null) 'amount_mode': amountMode,
      'amount': amount,
      if (percent != null) 'percent': percent,
      'status': status,
      if (note != null && note.isNotEmpty) 'note': note,
      if (clientName != null) 'client_name': clientName,
      if (clientEmail != null) 'client_email': clientEmail,
      if (dueDate != null)
        'due_date': dueDate.toIso8601String().substring(0, 10),
    }).select().single();

    return Map<String, dynamic>.from(inserted as Map);
  }

  /// Update an invoice's status ('draft' | 'sent' | 'paid'). Stamps `paid_at`
  /// when moving to 'paid', clears it otherwise.
  Future<void> updateStatus(String invoiceId, String status) async {
    await _client.from('invoices').update({
      'status': status,
      'paid_at':
          status == 'paid' ? DateTime.now().toIso8601String() : null,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', invoiceId);
  }

  /// Permanently delete an invoice.
  Future<void> deleteInvoice(String invoiceId) async {
    await _client.from('invoices').delete().eq('id', invoiceId);
  }

  // ── Paiements ──────────────────────────────────────────────────────────────

  /// All payments recorded against an invoice, newest first.
  Future<List<Map<String, dynamic>>> getPayments(String invoiceId) async {
    final response = await _client
        .from('invoice_payments')
        .select()
        .eq('invoice_id', invoiceId)
        .order('paid_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Record a (possibly partial) payment on an invoice. A DB trigger keeps
  /// invoices.paid_amount and status in sync, so the caller only inserts here.
  Future<void> recordPayment({
    required String invoiceId,
    required double amount,
    DateTime? paidAt,
    String? method,
    String? note,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    await _client.from('invoice_payments').insert({
      'user_id': userId,
      'invoice_id': invoiceId,
      'amount': amount,
      'paid_at': (paidAt ?? DateTime.now()).toIso8601String().substring(0, 10),
      if (method != null && method.isNotEmpty) 'method': method,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  /// Delete one payment (the DB trigger recomputes the invoice's paid_amount).
  Future<void> deletePayment(String paymentId) async {
    await _client.from('invoice_payments').delete().eq('id', paymentId);
  }
}

/// Derived display status for an invoice, per the facturation spec.
enum InvoiceStatus { enAttente, partiellement, payee, enRetard }

extension InvoiceStatusX on InvoiceStatus {
  String get label {
    switch (this) {
      case InvoiceStatus.enAttente:
        return 'En attente';
      case InvoiceStatus.partiellement:
        return 'Partiellement payée';
      case InvoiceStatus.payee:
        return 'Payée';
      case InvoiceStatus.enRetard:
        return 'En retard';
    }
  }
}

/// Computes the display status of an invoice from its amount, what's been paid
/// and its échéance (due_date):
///   reste <= 0                    → Payée
///   paid > 0 && reste > 0         → Partiellement payée
///   paid == 0 && past échéance    → En retard
///   otherwise                     → En attente
InvoiceStatus invoiceDisplayStatus(Map<String, dynamic> inv) {
  final amount = (inv['amount'] as num?)?.toDouble() ?? 0;
  final paid = (inv['paid_amount'] as num?)?.toDouble() ?? 0;
  final reste = amount - paid;

  if (amount > 0 && reste <= 0.009) return InvoiceStatus.payee;
  if (paid > 0) return InvoiceStatus.partiellement;

  final dueRaw = inv['due_date'] as String?;
  if (dueRaw != null && dueRaw.isNotEmpty) {
    final due = DateTime.tryParse(dueRaw);
    if (due != null) {
      final today = DateTime.now();
      final endOfDue = DateTime(due.year, due.month, due.day, 23, 59, 59);
      if (today.isAfter(endOfDue)) return InvoiceStatus.enRetard;
    }
  }
  return InvoiceStatus.enAttente;
}

/// Remaining amount due on an invoice (never negative).
double invoiceReste(Map<String, dynamic> inv) {
  final amount = (inv['amount'] as num?)?.toDouble() ?? 0;
  final paid = (inv['paid_amount'] as num?)?.toDouble() ?? 0;
  final reste = amount - paid;
  return reste < 0 ? 0 : reste;
}
