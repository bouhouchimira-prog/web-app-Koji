import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';

class BudgetHistoryScreen extends ConsumerWidget {
  final Map<String, dynamic> data;
  const BudgetHistoryScreen({super.key, required this.data});

  static const _kDark = Color(0xFF0F172A);

  String get _chantierId => data['id'] as String;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(chantierBudgetHistoryProvider(_chantierId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: historyAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator(color: _kDark)),
                error: (e, _) => Center(child: Text('Erreur: $e')),
                data: (history) {
                  if (history.isEmpty) {
                    return _buildEmpty();
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    itemCount: history.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _buildHistoryTile(history[i]),
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
          const Text(
            'Historique',
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

  Widget _buildEmpty() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Text(
          'Aucun historique pour le moment.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
        ),
      ),
    );
  }

  Widget _buildHistoryTile(Map<String, dynamic> item) {
    final action = item['action'] as String;
    final category = item['category'] as String;
    final label = item['label'] as String? ?? '';
    final amountDelta =
        num.tryParse(item['amount_delta']?.toString() ?? '0')?.toDouble() ?? 0;
    
    IconData icon;
    Color color;

    if (action == 'add_line') {
      icon = Icons.add_circle_outline;
      color = const Color(0xFF22C55E); // Green
    } else if (action == 'delete_line') {
      icon = Icons.remove_circle_outline;
      color = const Color(0xFFEF4444); // Red
    } else {
      icon = Icons.edit_outlined;
      color = const Color(0xFF3B82F6); // Blue
    }

    String categoryLabel = '';
    if (category == 'main_oeuvre') categoryLabel = "Main d'œuvre";
    else if (category == 'fourniture') categoryLabel = "Fourniture";
    else if (category == 'divers') categoryLabel = "Divers";

    return Container(
      padding: const EdgeInsets.all(16),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  categoryLabel,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: _kDark,
                  ),
                ),
              ],
            ),
          ),
          if (amountDelta != 0)
            Text(
              '${amountDelta > 0 ? '+' : ''}${amountDelta.toStringAsFixed(0)} €',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
        ],
      ),
    );
  }
}
