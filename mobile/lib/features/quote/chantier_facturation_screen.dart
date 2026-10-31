import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/providers/invoice_provider.dart';
import 'package:koji/features/quote/repositories/invoice_repository.dart';
import 'package:koji/features/quote/services/invoice_pdf_service.dart';

/// Facturation — invoices for one chantier.
///
/// Shows a billing summary (total devis signé / déjà facturé / restant) plus the
/// list of invoices already created. New invoices are created against the
/// signed devis of this chantier via the create screen.
class ChantierFacturationScreen extends ConsumerWidget {
  final Map<String, dynamic> data;
  const ChantierFacturationScreen({super.key, required this.data});

  static const _kDark = Color(0xFF0F172A);
  static const _kBg = Color(0xFFF5F0EB);

  bool _isSigned(String? status) {
    final s = (status ?? '').toLowerCase();
    return s == 'signed' || s == 'signé' || s == 'accepted' || s == 'accepté';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chantierId = data['id'] as String?;
    if (chantierId == null) {
      return const Scaffold(body: Center(child: Text('ID Chantier manquant')));
    }

    final quotesAsync = ref.watch(chantierQuotesProvider(chantierId));
    final invoicesAsync = ref.watch(chantierInvoicesProvider(chantierId));

    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: quotesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Erreur: $e')),
                data: (quotes) {
                  final signed =
                      quotes.where((q) => _isSigned(q['status'] as String?)).toList();
                  // Total of the signed devis (TTC). If several signed quotes
                  // exist, we bill against their combined total.
                  final double signedTotal = signed.fold<double>(
                    0,
                    (sum, q) => sum + ((q['total_ttc'] as num?)?.toDouble() ?? 0),
                  );

                  return invoicesAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => Center(child: Text('Erreur: $e')),
                    data: (invoices) {
                      final double invoiced = invoices.fold<double>(
                        0,
                        (sum, inv) =>
                            sum + ((inv['amount'] as num?)?.toDouble() ?? 0),
                      );
                      final double collected = invoices.fold<double>(
                        0,
                        (sum, inv) =>
                            sum +
                            ((inv['paid_amount'] as num?)?.toDouble() ?? 0),
                      );
                      final double remaining =
                          (signedTotal - invoiced).clamp(-double.infinity, double.infinity);

                      return _buildBody(
                        context,
                        ref,
                        chantierId: chantierId,
                        signed: signed,
                        signedTotal: signedTotal,
                        invoiced: invoiced,
                        collected: collected,
                        remaining: remaining,
                        invoices: invoices,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref, {
    required String chantierId,
    required List<Map<String, dynamic>> signed,
    required double signedTotal,
    required double invoiced,
    required double collected,
    required double remaining,
    required List<Map<String, dynamic>> invoices,
  }) {
    final hasSigned = signed.isNotEmpty;

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 110),
          children: [
            _buildSummaryCard(
              signedTotal: signedTotal,
              invoiced: invoiced,
              collected: collected,
              remaining: remaining,
              hasSigned: hasSigned,
            ),
            const SizedBox(height: 20),
            const Text(
              'Factures',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: _kDark,
              ),
            ),
            const SizedBox(height: 12),
            if (invoices.isEmpty)
              _emptyInvoices()
            else
              ...invoices.map((inv) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _buildInvoiceTile(context, ref, inv, invoices),
                  )),
          ],
        ),
        Positioned(
          bottom: 20,
          left: 20,
          right: 20,
          child: _buildCreateButton(context, ref, chantierId, signed,
              signedTotal, invoiced, remaining),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  Widget _buildSummaryCard({
    required double signedTotal,
    required double invoiced,
    required double collected,
    required double remaining,
    required bool hasSigned,
  }) {
    final double resteAEncaisser = invoiced - collected;
    final double progress =
        signedTotal > 0 ? (invoiced / signedTotal).clamp(0.0, 1.0) : 0.0;

    String etat;
    Color etatColor;
    if (!hasSigned) {
      etat = 'Aucun devis signé';
      etatColor = const Color(0xFF94A3B8);
    } else if (invoiced <= 0) {
      etat = 'Non facturé';
      etatColor = const Color(0xFF3B82F6);
    } else if (remaining <= 0.01) {
      etat = 'Entièrement facturé';
      etatColor = const Color(0xFF22C55E);
    } else {
      etat = 'Facturation partielle';
      etatColor = const Color(0xFFF59E0B);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _kDark,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'État de la facturation',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white70,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: etatColor.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  etat,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: etatColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _summaryRow('Total devis signé', signedTotal, Colors.white),
          const SizedBox(height: 10),
          _summaryRow('Déjà facturé', invoiced, const Color(0xFF60A5FA)),
          const SizedBox(height: 10),
          _summaryRow('Restant à facturer', remaining, const Color(0xFF34D399)),
          const Divider(height: 22, color: Colors.white24),
          _summaryRow('Encaissé', collected, const Color(0xFF22C55E)),
          const SizedBox(height: 10),
          _summaryRow('Reste à encaisser', resteAEncaisser,
              const Color(0xFFFBBF24)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 7,
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Color(0xFF34D399)),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${(progress * 100).toStringAsFixed(0)} % facturé',
            style: const TextStyle(fontSize: 11, color: Colors.white54),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, double value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: Colors.white70),
        ),
        Text(
          '${_fmt(value)} €',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  Widget _buildInvoiceTile(BuildContext context, WidgetRef ref,
      Map<String, dynamic> inv, List<Map<String, dynamic>> allInvoices) {
    final reference = inv['reference'] as String? ?? 'FAC-????';
    final amount = (inv['amount'] as num?)?.toDouble() ?? 0;
    final type = inv['type'] as String? ?? 'intermediaire';
    final issuedAt = inv['issued_at'] as String? ?? '';
    final dueDate = inv['due_date'] as String? ?? '';

    final typeLabel = _typeLabel(type);
    final percent = (inv['percent'] as num?)?.toDouble();

    // Derived status + remaining balance (per the facturation spec).
    final status = invoiceDisplayStatus(inv);
    final reste = invoiceReste(inv);
    final paid = (inv['paid_amount'] as num?)?.toDouble() ?? 0;
    final statusColor = _statusColor(status);
    final statusLabel = status.label;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color:
                Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.receipt_long_outlined,
                color: _kDark, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      reference,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: _kDark,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        typeLabel,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    '${_fmt(amount)} € TTC',
                    if (percent != null) '${percent.toStringAsFixed(0)} %',
                    if (issuedAt.isNotEmpty) _fmtDate(issuedAt),
                    if (dueDate.isNotEmpty) 'éch. ${_fmtDate(dueDate)}',
                  ].join('  ·  '),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                  ),
                ),
                if (paid > 0 || reste > 0) ...[
                  const SizedBox(height: 6),
                  Text(
                    reste <= 0.009
                        ? 'Réglée : ${_fmt(paid)} €'
                        : 'Réglé ${_fmt(paid)} €  ·  Reste à payer ${_fmt(reste)} €',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: reste <= 0.009
                          ? const Color(0xFF22C55E)
                          : const Color(0xFFB45309),
                    ),
                  ),
                ],
                if (reste > 0.009) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _openPaymentSheet(context, ref, inv),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.payments_outlined,
                              size: 15, color: Colors.white),
                          SizedBox(width: 6),
                          Text('Encaisser',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white)),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Derived status chip (En attente / Partiellement payée / Payée /
          // En retard) — read-only; payment progress drives it.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              statusLabel,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: statusColor,
              ),
            ),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert,
                size: 20, color: Color(0xFF94A3B8)),
            onSelected: (value) {
              switch (value) {
                case 'preview':
                  _previewPdf(context, inv, allInvoices);
                  break;
                case 'share':
                  _sharePdf(context, inv, allInvoices);
                  break;
                case 'delete':
                  _confirmDelete(context, ref, inv['id'] as String);
                  break;
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'preview',
                child: Row(children: [
                  Icon(Icons.visibility_outlined, size: 18, color: _kDark),
                  SizedBox(width: 10),
                  Text('Aperçu PDF'),
                ]),
              ),
              PopupMenuItem(
                value: 'share',
                child: Row(children: [
                  Icon(Icons.ios_share, size: 18, color: _kDark),
                  SizedBox(width: 10),
                  Text('Partager'),
                ]),
              ),
              PopupMenuItem(
                value: 'delete',
                child: Row(children: [
                  Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                  SizedBox(width: 10),
                  Text('Supprimer',
                      style: TextStyle(color: Color(0xFFEF4444))),
                ]),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _previewPdf(BuildContext context, Map<String, dynamic> inv,
      List<Map<String, dynamic>> allInvoices) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await InvoicePdfService()
          .preview(invoice: inv, priorInvoices: allInvoices);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erreur PDF : $e')));
    }
  }

  Future<void> _sharePdf(BuildContext context, Map<String, dynamic> inv,
      List<Map<String, dynamic>> allInvoices) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await InvoicePdfService()
          .share(invoice: inv, priorInvoices: allInvoices);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erreur PDF : $e')));
    }
  }

  /// Bottom sheet to view payment history and record a new (partial) payment.
  void _openPaymentSheet(
      BuildContext context, WidgetRef ref, Map<String, dynamic> inv) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _PaymentSheet(invoice: inv),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, String invoiceId) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer la facture ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () {
              ref.read(invoiceRepositoryProvider).deleteInvoice(invoiceId);
              Navigator.of(ctx).pop();
            },
            child: const Text('Supprimer',
                style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildCreateButton(
    BuildContext context,
    WidgetRef ref,
    String chantierId,
    List<Map<String, dynamic>> signed,
    double signedTotal,
    double invoiced,
    double remaining,
  ) {
    final enabled = signed.isNotEmpty;
    return GestureDetector(
      onTap: enabled
          ? () => context.push('/chantier/facturation/create', extra: {
                'chantierData': data,
                'signed': signed,
                'signedTotal': signedTotal,
                'invoiced': invoiced,
                'remaining': remaining,
              })
          : () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                      'Aucun devis signé. Une facture nécessite un devis signé.'),
                ),
              ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: enabled ? _kDark : const Color(0xFFCBD5E1),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add,
                color: Theme.of(context).colorScheme.surface, size: 20),
            const SizedBox(width: 8),
            Text(
              'Créer une facture',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.surface,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyInvoices() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Center(
        child: Text(
          'Aucune facture',
          style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: _kBg,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () => context.pop(),
              child: const Icon(Icons.chevron_left_rounded,
                  color: _kDark, size: 30),
            ),
          ),
          const Text(
            'Facturation',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  static String _typeLabel(String type) {
    switch (type) {
      case 'acompte':
        return 'Acompte';
      case 'finale':
        return 'Solde';
      case 'complementaire':
        return 'Complémentaire';
      default:
        return 'Intermédiaire';
    }
  }

  static Color _statusColor(InvoiceStatus s) {
    switch (s) {
      case InvoiceStatus.payee:
        return const Color(0xFF22C55E);
      case InvoiceStatus.partiellement:
        return const Color(0xFFF59E0B);
      case InvoiceStatus.enRetard:
        return const Color(0xFFEF4444);
      case InvoiceStatus.enAttente:
        return const Color(0xFF3B82F6);
    }
  }

  static String _fmt(double v) {
    return v.toStringAsFixed(2).replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+\.)'),
          (m) => '${m[1]} ',
        );
  }

  static String _fmtDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return DateFormat('dd/MM/yyyy').format(dt);
  }
}

/// Bottom sheet: payment history of one invoice + form to record a règlement.
class _PaymentSheet extends ConsumerStatefulWidget {
  final Map<String, dynamic> invoice;
  const _PaymentSheet({required this.invoice});

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  static const _kDark = Color(0xFF0F172A);
  final _amountCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  bool _saving = false;

  String get _invoiceId => widget.invoice['id'] as String;

  @override
  void initState() {
    super.initState();
    // Prefill with the remaining balance for a one-tap full settlement.
    final reste = invoiceReste(widget.invoice);
    if (reste > 0) _amountCtrl.text = reste.toStringAsFixed(2);
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final amount =
        double.tryParse(_amountCtrl.text.replaceAll(',', '.')) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(invoiceRepositoryProvider).recordPayment(
            invoiceId: _invoiceId,
            amount: amount,
            paidAt: _date,
          );
      ref.invalidate(invoicePaymentsProvider(_invoiceId));
      // A payment may clear an overdue flag — refresh the overdue alert.
      unawaited(NotificationService.instance.notifyOverdueInvoices());
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      messenger.showSnackBar(SnackBar(content: Text('Erreur : $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final paymentsAsync = ref.watch(invoicePaymentsProvider(_invoiceId));
    final amount = (widget.invoice['amount'] as num?)?.toDouble() ?? 0;
    final paid = (widget.invoice['paid_amount'] as num?)?.toDouble() ?? 0;
    final reste = invoiceReste(widget.invoice);

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Encaisser — ${widget.invoice['reference'] ?? ''}',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.bold, color: _kDark),
          ),
          const SizedBox(height: 4),
          Text(
            'Montant ${_money(amount)} €  ·  Réglé ${_money(paid)} €  ·  Reste ${_money(reste)} €',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),

          // ── Record a payment ──
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    hintText: 'Montant',
                    suffixText: '€',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: _kDark),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime(2020),
                      lastDate:
                          DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setState(() => _date = picked);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 13),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.event, size: 16, color: _kDark),
                        const SizedBox(width: 6),
                        Text(
                          '${_date.day.toString().padLeft(2, '0')}/${_date.month.toString().padLeft(2, '0')}',
                          style: const TextStyle(
                              fontSize: 13, color: _kDark),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: GestureDetector(
              onTap: _saving ? null : _save,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _saving ? const Color(0xFFCBD5E1) : _kDark,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Enregistrer le paiement',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 14)),
              ),
            ),
          ),

          const SizedBox(height: 20),
          const Text('Historique des paiements',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: _kDark)),
          const SizedBox(height: 8),
          paymentsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Text('Erreur : $e',
                style: const TextStyle(color: Color(0xFFEF4444))),
            data: (payments) {
              if (payments.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('Aucun paiement enregistré.',
                      style:
                          TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                );
              }
              return Column(
                children: payments.map((p) {
                  final pa = (p['amount'] as num?)?.toDouble() ?? 0;
                  final pd = p['paid_at'] as String? ?? '';
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: const Icon(Icons.check_circle,
                        color: Color(0xFF22C55E), size: 20),
                    title: Text('${_money(pa)} €',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, color: _kDark)),
                    subtitle: Text(_fmtDate(pd),
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF64748B))),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline,
                          size: 18, color: Color(0xFFEF4444)),
                      onPressed: () async {
                        await ref
                            .read(invoiceRepositoryProvider)
                            .deletePayment(p['id'] as String);
                        ref.invalidate(invoicePaymentsProvider(_invoiceId));
                      },
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  static String _money(double v) => v.toStringAsFixed(2).replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+\.)'),
        (m) => '${m[1]} ',
      );

  static String _fmtDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return DateFormat('dd/MM/yyyy').format(dt);
  }
}
