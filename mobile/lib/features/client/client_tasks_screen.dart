import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/client/repository/client_repository.dart';
import 'package:koji/features/worker/models/urgent_alert_type.dart';

/// "Suivi des travaux" — a read-only view of the works (chantier_tasks) for the
/// client's chantiers, grouped by chantier with a completion bar so they can
/// follow progress. The client cannot edit tasks; only the entreprise does.
class ClientTasksScreen extends ConsumerWidget {
  const ClientTasksScreen({super.key});

  static const _darkNavy = Color(0xFF0F172A);
  static const _green = Color(0xFF10B981);
  static const _slate = Color(0xFF64748B);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(clientTasksProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Suivi des travaux',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkNavy)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _darkNavy, size: 20),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/client-home');
            }
          },
        ),
      ),
      body: tasksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Impossible de charger le suivi.\n$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _slate)),
          ),
        ),
        data: (tasks) {
          if (tasks.isEmpty) return _empty();

          // Group tasks by their chantier reference.
          final groups = <String, List<Map<String, dynamic>>>{};
          for (final t in tasks) {
            final ref = (t['chantier_reference'] as String?) ?? 'Chantier';
            groups.putIfAbsent(ref, () => []).add(t);
          }
          final refs = groups.keys.toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(clientTasksProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: refs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, i) => _chantierGroup(
                  context, ref, refs[i], groups[refs[i]]!),
            ),
          );
        },
      ),
    );
  }

  Widget _chantierGroup(BuildContext context, WidgetRef ref, String reference,
      List<Map<String, dynamic>> tasks) {
    final done = tasks.where((t) => t['is_done'] == true).length;
    final total = tasks.length;
    final progress = total == 0 ? 0.0 : done / total;
    final chantierId = tasks.isNotEmpty
        ? tasks.first['chantier_id'] as String?
        : null;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.home_work_outlined,
                    color: Color(0xFF1D74FF), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(reference,
                    style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: _darkNavy)),
              ),
              Text('$done/$total',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: _slate)),
              if (chantierId != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.warning_amber_rounded,
                      color: Color(0xFFDC2626), size: 22),
                  tooltip: 'Signaler une urgence',
                  onPressed: () => _showUrgentAlertSheet(context, ref, chantierId),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation(_green),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            progress >= 1.0
                ? 'Travaux terminés 🎉'
                : '${(progress * 100).round()}% réalisé',
            style: const TextStyle(fontSize: 11, color: _slate),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 4),
          ...tasks.map(_taskRow),
        ],
      ),
    );
  }

  Widget _taskRow(Map<String, dynamic> task) {
    final isDone = task['is_done'] == true;
    final label = (task['label'] as String?) ?? 'Tâche';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(
            isDone ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            size: 20,
            color: isDone ? _green : const Color(0xFFCBD5E1),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: isDone ? _slate : _darkNavy,
                decoration: isDone ? TextDecoration.lineThrough : null,
                decorationColor: _slate,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showUrgentAlertSheet(
      BuildContext context, WidgetRef ref, String chantierId) async {
    final type = await showModalBottomSheet<UrgentAlertType>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text('Signaler une urgence',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            for (final t in UrgentAlertType.values)
              ListTile(
                leading: Icon(t.icon, color: const Color(0xFFDC2626)),
                title: Text(t.label),
                onTap: () => Navigator.pop(ctx, t),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (type == null || !context.mounted) return;

    final controller = TextEditingController();
    final message = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(type.label),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Décrivez la situation…',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Envoyer l\'alerte')),
        ],
      ),
    );
    if (message == null || message.trim().isEmpty || !context.mounted) return;

    try {
      await ref.read(clientRepositoryProvider).sendUrgentAlert(
            chantierId: chantierId,
            type: type.value,
            message: message.trim(),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Alerte envoyée à l\'entreprise')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur : $e')),
        );
      }
    }
  }

  Widget _empty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.construction_outlined, size: 72, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('Aucun travaux en cours',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          const Text(
            'Le suivi de vos travaux apparaîtra ici\ndès que votre artisan l\'aura démarré.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFFCBD5E1)),
          ),
        ],
      ),
    );
  }
}
