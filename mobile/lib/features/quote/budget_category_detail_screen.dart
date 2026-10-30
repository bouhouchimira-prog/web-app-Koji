import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';

/// Full-screen list of every budget line for ONE category, with the running
/// total pinned at the bottom. Reached by tapping a row on the Budget screen.
class BudgetCategoryDetailScreen extends ConsumerWidget {
  /// Expects: { 'chantierId': String, 'category': String, 'label': String }
  final Map<String, dynamic> data;
  const BudgetCategoryDetailScreen({super.key, required this.data});

  static const _kDark = Color(0xFF0F172A);

  String get _chantierId => data['chantierId'] as String;
  String get _category => data['category'] as String;
  String get _label => data['label'] as String;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final linesAsync = ref.watch(chantierBudgetLinesProvider(_chantierId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: linesAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator(color: _kDark)),
                error: (e, _) => Center(child: Text('Erreur: $e')),
                data: (allLines) {
                  final lines = allLines
                      .where((l) => l['category'] == _category)
                      .toList();
                  final total = lines.fold<double>(
                    0,
                    (s, l) =>
                        s +
                        (num.tryParse(l['amount']?.toString() ?? '0')
                                ?.toDouble() ??
                            0),
                  );
                  return Column(
                    children: [
                      Expanded(
                        child: lines.isEmpty
                            ? _buildEmpty()
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    20, 16, 20, 16),
                                itemCount: lines.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (_, i) =>
                                    _buildLineTile(context, ref, lines[i]),
                              ),
                      ),
                      _buildTotalBar(total),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F0EB),
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
          Text(
            _label,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Text(
          'Aucune ligne pour le moment.\nUtilisez « + Ajouter » sur l\'écran Budget.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
        ),
      ),
    );
  }

  Widget _buildLineTile(
      BuildContext context, WidgetRef ref, Map<String, dynamic> line) {
    final amount =
        num.tryParse(line['amount']?.toString() ?? '0')?.toDouble() ?? 0;
    final qty =
        num.tryParse(line['quantity']?.toString() ?? '0')?.toDouble() ?? 0;
    final unit =
        num.tryParse(line['unit_price']?.toString() ?? '0')?.toDouble() ?? 0;
    final hasBreakdown = qty > 0 && unit > 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line['label'] as String? ?? 'Sans nom',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _kDark,
                  ),
                ),
                if (hasBreakdown) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${_fmtNum(qty)} × ${_fmtNum(unit)} €',
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${_fmt(amount)} €',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => _confirmDelete(context, ref, line),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.delete_outline,
                  size: 20, color: Color(0xFFEF4444)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalBar(double total) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
      decoration: const BoxDecoration(
        color: _kDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Total',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          Text(
            '${_fmt(total)} €',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, WidgetRef ref, Map<String, dynamic> line) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Supprimer la ligne',
            style: TextStyle(fontWeight: FontWeight.bold, color: _kDark)),
        content: Text(
            'Supprimer « ${line['label']} » ? Le total sera recalculé.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler',
                style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final chantierId = line['chantier_id'] as String;
                await ref
                    .read(chantierRepositoryProvider)
                    .deleteBudgetLine(line);
                
                ref.invalidate(chantierBudgetProvider(chantierId));
                ref.invalidate(chantierBudgetLinesProvider(chantierId));
                ref.invalidate(chantierBudgetHistoryProvider(chantierId));
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Erreur: $e'),
                      backgroundColor: const Color(0xFFEF4444),
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Supprimer',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  static String _fmt(double v) {
    return v.toStringAsFixed(0).replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+$)'),
          (m) => '${m[1]} ',
        );
  }

  static String _fmtNum(double v) {
    if (v == v.roundToDouble()) return v.toStringAsFixed(0);
    return v.toString();
  }
}
