import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/repositories/invoice_repository.dart';

final invoiceRepositoryProvider = Provider<InvoiceRepository>((ref) {
  return InvoiceRepository();
});

/// Real-time list of invoices for a chantier (newest first).
final chantierInvoicesProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(invoiceRepositoryProvider).streamInvoices(chantierId);
});

/// Payments recorded against a single invoice (newest first).
final invoicePaymentsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, invoiceId) {
  return ref.watch(invoiceRepositoryProvider).getPayments(invoiceId);
});
