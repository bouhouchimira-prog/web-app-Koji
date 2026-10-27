import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/features/quote/providers/invoice_provider.dart';

/// Create a facture against the signed devis of a chantier.
///
/// The user picks:
///  • the invoice type      (acompte / intermédiaire / finale)
///  • which signed devis     (if several)
///  • how to set the amount  (montant fixe / % du devis / acompte prédéfini /
///                            solde restant)
/// A live preview shows the resulting € amount and the new "restant à facturer".
class FacturationCreateScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> args;
  const FacturationCreateScreen({super.key, required this.args});

  @override
  ConsumerState<FacturationCreateScreen> createState() =>
      _FacturationCreateScreenState();
}

enum _AmountMode { fixed, percent, deposit, balance }

class _FacturationCreateScreenState
    extends ConsumerState<FacturationCreateScreen> {
  static const _kDark = Color(0xFF0F172A);
  static const _kBg = Color(0xFFF5F0EB);

  late final String _chantierId;
  late final List<Map<String, dynamic>> _signed;
  late final double _signedTotal;
  late final double _invoiced;
  late final double _remaining;

  String _type = 'acompte';
  _AmountMode _mode = _AmountMode.percent;
  Map<String, dynamic>? _selectedQuote;
  // Échéance (due date) — default 30 days out, used to flag overdue invoices.
  DateTime _dueDate = DateTime.now().add(const Duration(days: 30));

  final _fixedCtrl = TextEditingController();
  final _percentCtrl = TextEditingController(text: '30');
  final _depositCtrl = TextEditingController(text: '30');
  final _noteCtrl = TextEditingController();

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final a = widget.args;
    final chantierData = a['chantierData'] as Map<String, dynamic>? ?? {};
    _chantierId = chantierData['id'] as String? ?? '';
    _signed = (a['signed'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    _signedTotal = (a['signedTotal'] as num?)?.toDouble() ?? 0;
    _invoiced = (a['invoiced'] as num?)?.toDouble() ?? 0;
    _remaining = (a['remaining'] as num?)?.toDouble() ?? 0;
    _selectedQuote = _signed.isNotEmpty ? _signed.first : null;

    for (final c in [_fixedCtrl, _percentCtrl, _depositCtrl]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _fixedCtrl.dispose();
    _percentCtrl.dispose();
    _depositCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  /// Computed € amount from the current mode/inputs.
  double get _computedAmount {
    switch (_mode) {
      case _AmountMode.fixed:
        return double.tryParse(_fixedCtrl.text.replaceAll(',', '.')) ?? 0;
      case _AmountMode.percent:
        final p = double.tryParse(_percentCtrl.text.replaceAll(',', '.')) ?? 0;
        return _signedTotal * p / 100;
      case _AmountMode.deposit:
        final p = double.tryParse(_depositCtrl.text.replaceAll(',', '.')) ?? 0;
        return _signedTotal * p / 100;
      case _AmountMode.balance:
        return _remaining > 0 ? _remaining : 0;
    }
  }

  double? get _computedPercent {
    if (_signedTotal <= 0) return null;
    return _computedAmount / _signedTotal * 100;
  }

  String get _modeKey {
    switch (_mode) {
      case _AmountMode.fixed:
        return 'fixed';
      case _AmountMode.percent:
        return 'percent';
      case _AmountMode.deposit:
        return 'deposit';
      case _AmountMode.balance:
        return 'balance';
    }
  }

  @override
  Widget build(BuildContext context) {
    // Hard guard: no signed devis ⇒ no facturation possible.
    if (_signed.isEmpty) {
      return Scaffold(
        backgroundColor: _kBg,
        body: SafeArea(
          child: Column(
            children: [
              _buildAppBar(context),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.receipt_long_outlined,
                          size: 56, color: Color(0xFFCBD5E1)),
                      const SizedBox(height: 16),
                      const Text(
                        'Aucun devis signé',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: _kDark),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Une facture ne peut être créée qu’à partir d’un devis '
                        'signé. Faites d’abord signer un devis pour ce chantier.',
                        textAlign: TextAlign.center,
                        style:
                            TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 24),
                      GestureDetector(
                        onTap: () => context.pop(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 28, vertical: 14),
                          decoration: BoxDecoration(
                            color: _kDark,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('Retour',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final amount = _computedAmount;
    final newRemaining = _remaining - amount;
    final overBilling = amount > _remaining + 0.01;

    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  _sectionLabel('Type de facture'),
                  const SizedBox(height: 10),
                  _buildTypeSelector(),
                  const SizedBox(height: 22),
                  if (_signed.length > 1) ...[
                    _sectionLabel('Devis signé'),
                    const SizedBox(height: 10),
                    _buildQuoteSelector(),
                    const SizedBox(height: 22),
                  ],
                  _sectionLabel('Montant à facturer'),
                  const SizedBox(height: 10),
                  _buildModeSelector(),
                  const SizedBox(height: 14),
                  _buildModeInput(),
                  const SizedBox(height: 22),
                  _sectionLabel('Date d\'échéance'),
                  const SizedBox(height: 10),
                  _buildDueDateField(),
                  const SizedBox(height: 22),
                  _sectionLabel('Note (optionnel)'),
                  const SizedBox(height: 10),
                  _buildNoteField(),
                  const SizedBox(height: 22),
                  _buildPreview(amount, newRemaining, overBilling),
                ],
              ),
            ),
            _buildBottomBar(context, amount, overBilling),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildTypeSelector() {
    const types = [
      ('acompte', 'Acompte'),
      ('intermediaire', 'Intermédiaire'),
      ('finale', 'Solde'),
      ('complementaire', 'Complémentaire'),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: types.map((t) {
        final selected = _type == t.$1;
        return GestureDetector(
          onTap: () => setState(() => _type = t.$1),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? _kDark : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: selected ? _kDark : const Color(0xFFE2E8F0),
              ),
            ),
            child: Text(
              t.$2,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : _kDark,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDueDateField() {
    final label =
        '${_dueDate.day.toString().padLeft(2, '0')}/${_dueDate.month.toString().padLeft(2, '0')}/${_dueDate.year}';
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _dueDate,
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
        );
        if (picked != null) setState(() => _dueDate = picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            const Icon(Icons.event_outlined, size: 20, color: _kDark),
            const SizedBox(width: 10),
            Text(label,
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600, color: _kDark)),
            const Spacer(),
            const Icon(Icons.edit_calendar_outlined,
                size: 18, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuoteSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Map<String, dynamic>>(
          isExpanded: true,
          value: _selectedQuote,
          items: _signed.map((q) {
            final ref = q['reference'] as String? ?? 'Devis';
            final ttc = (q['total_ttc'] as num?)?.toDouble() ?? 0;
            return DropdownMenuItem(
              value: q,
              child: Text('$ref — ${_fmt(ttc)} € TTC',
                  style: const TextStyle(fontSize: 14, color: _kDark)),
            );
          }).toList(),
          onChanged: (v) => setState(() => _selectedQuote = v),
        ),
      ),
    );
  }

  Widget _buildModeSelector() {
    const modes = [
      (_AmountMode.fixed, 'Montant fixe'),
      (_AmountMode.percent, '% du devis'),
      (_AmountMode.deposit, 'Acompte prédéfini'),
      (_AmountMode.balance, 'Solde restant'),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: modes.map((m) {
        final selected = _mode == m.$1;
        return GestureDetector(
          onTap: () => setState(() => _mode = m.$1),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: selected ? _kDark : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: selected ? _kDark : const Color(0xFFE2E8F0),
              ),
            ),
            child: Text(
              m.$2,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : _kDark,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildModeInput() {
    switch (_mode) {
      case _AmountMode.fixed:
        return _numberField(
          controller: _fixedCtrl,
          suffix: '€',
          hint: 'Saisir le montant',
        );
      case _AmountMode.percent:
        return _numberField(
          controller: _percentCtrl,
          suffix: '%',
          hint: 'Pourcentage du devis',
        );
      case _AmountMode.deposit:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              children: [10, 30, 40, 50].map((p) {
                return GestureDetector(
                  onTap: () =>
                      setState(() => _depositCtrl.text = p.toString()),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('$p %',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF3B82F6),
                        )),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 10),
            _numberField(
              controller: _depositCtrl,
              suffix: '%',
              hint: 'Acompte (%)',
            ),
          ],
        );
      case _AmountMode.balance:
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined,
                  color: Color(0xFF059669), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Solde restant à facturer : ${_fmt(_remaining > 0 ? _remaining : 0)} €',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF065F46),
                  ),
                ),
              ),
            ],
          ),
        );
    }
  }

  Widget _numberField({
    required TextEditingController controller,
    required String suffix,
    required String hint,
  }) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
      ],
      decoration: InputDecoration(
        hintText: hint,
        suffixText: suffix,
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDark),
        ),
      ),
    );
  }

  Widget _buildNoteField() {
    return TextField(
      controller: _noteCtrl,
      maxLines: 2,
      decoration: InputDecoration(
        hintText: 'Ex : Acompte à la commande',
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDark),
        ),
      ),
    );
  }

  Widget _buildPreview(double amount, double newRemaining, bool over) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kDark,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          _previewRow('Montant à facturer', '${_fmt(amount)} €',
              valueColor: const Color(0xFF34D399), big: true),
          const SizedBox(height: 10),
          _previewRow('Total devis signé', '${_fmt(_signedTotal)} €'),
          const SizedBox(height: 6),
          _previewRow('Déjà facturé', '${_fmt(_invoiced)} €'),
          const SizedBox(height: 6),
          _previewRow(
            'Restant après cette facture',
            '${_fmt(newRemaining)} €',
            valueColor:
                over ? const Color(0xFFF87171) : const Color(0xFF60A5FA),
          ),
          if (over) ...[
            const SizedBox(height: 10),
            const Text(
              '⚠ Ce montant dépasse le solde restant à facturer.',
              style: TextStyle(fontSize: 12, color: Color(0xFFFCA5A5)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _previewRow(String label, String value,
      {Color valueColor = Colors.white, bool big = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 13, color: Colors.white70)),
        Text(value,
            style: TextStyle(
              fontSize: big ? 18 : 14,
              fontWeight: FontWeight.bold,
              color: valueColor,
            )),
      ],
    );
  }

  Widget _buildBottomBar(BuildContext context, double amount, bool over) {
    final valid = amount > 0 && !_saving;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: const BoxDecoration(color: _kBg),
      child: GestureDetector(
        onTap: valid ? () => _save(context) : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: valid ? _kDark : const Color(0xFFCBD5E1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: _saving
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Text(
                  'Créer la facture',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }

  Future<void> _save(BuildContext context) async {
    // A facture can only be issued against a signed devis. Refuse otherwise.
    if (_signed.isEmpty || _selectedQuote == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Aucun devis signé : impossible de créer une facture sans devis signé.'),
        ),
      );
      return;
    }
    final amount = _computedAmount;
    if (amount <= 0) return;

    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);

    try {
      final quote = _selectedQuote;
      final client = (quote?['client'] as Map?)?.cast<String, dynamic>() ?? {};
      await ref.read(invoiceRepositoryProvider).createInvoice(
            chantierId: _chantierId,
            quoteId: quote?['id'] as String?,
            quoteTotal: _signedTotal,
            type: _type,
            amount: amount,
            amountMode: _modeKey,
            percent: _computedPercent,
            note: _noteCtrl.text.trim(),
            clientName: client['name'] as String?,
            clientEmail: client['email'] as String?,
            dueDate: _dueDate,
          );
      // Re-evaluate overdue invoices so any new échéance is reflected.
      unawaited(NotificationService.instance.notifyOverdueInvoices());
      messenger.showSnackBar(
        const SnackBar(content: Text('Facture créée')),
      );
      router.pop();
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      messenger.showSnackBar(
        SnackBar(content: Text('Erreur : $e')),
      );
    }
  }

  // ──────────────────────────────────────────
  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: _kDark,
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
            'Nouvelle facture',
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

  static String _fmt(double v) {
    return v.toStringAsFixed(2).replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+\.)'),
          (m) => '${m[1]} ',
        );
  }
}
