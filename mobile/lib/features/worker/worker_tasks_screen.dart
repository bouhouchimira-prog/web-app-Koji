import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';

/// Worker (ouvrier) space — opened from the "Espace Particulier" login when the
/// entered Identifiant + Mot de passe belong to a worker. Shows the tasks
/// assigned to that worker (across chantiers), grouped by chantier, with a
/// per-task "Terminé / À faire" toggle. Sessionless: everything goes through the
/// worker RPCs (get_worker_tasks / set_worker_task_status).
class WorkerTasksScreen extends ConsumerStatefulWidget {
  final String workerId;
  final String? workerName;

  const WorkerTasksScreen({
    super.key,
    required this.workerId,
    this.workerName,
  });

  @override
  ConsumerState<WorkerTasksScreen> createState() => _WorkerTasksScreenState();
}

class _WorkerTasksScreenState extends ConsumerState<WorkerTasksScreen> {
  static const _navy = Color(0xFF1F2937);
  static const _green = Color(0xFF22C55E);

  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  String? _error;
  final Set<String> _updating = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tasks =
          await ref.read(authRepositoryProvider).getWorkerTasks(widget.workerId);
      if (mounted) setState(() => _tasks = tasks);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isDone(String? status) {
    final s = (status ?? '').toLowerCase();
    return s.contains('termin') || s == 'done' || s == 'fait';
  }

  Future<void> _toggle(Map<String, dynamic> task) async {
    final id = task['id']?.toString();
    if (id == null || _updating.contains(id)) return;
    final nextStatus = _isDone(task['status'] as String?) ? 'À faire' : 'Terminé';

    setState(() => _updating.add(id));
    try {
      final ok = await ref.read(authRepositoryProvider).setWorkerTaskStatus(
            workerId: widget.workerId,
            taskId: id,
            status: nextStatus,
          );
      if (ok && mounted) {
        setState(() => task['status'] = nextStatus);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mise à jour impossible.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    } finally {
      if (mounted) setState(() => _updating.remove(id));
    }
  }

  /// Group tasks by chantier reference (fallback "Chantier").
  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final t in _tasks) {
      final key = (t['chantier_reference'] as String?)?.trim();
      final label = (key != null && key.isNotEmpty) ? key : 'Chantier';
      (map[label] ??= []).add(t);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final doneCount = _tasks.where((t) => _isDone(t['status'] as String?)).length;
    final total = _tasks.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: _navy,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mes tâches',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            if (widget.workerName != null && widget.workerName!.isNotEmpty)
              Text(widget.workerName!,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _tasks.isEmpty
                      ? _emptyView()
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                          children: [
                            _progressCard(doneCount, total),
                            const SizedBox(height: 16),
                            ..._grouped.entries.expand((e) => [
                                  Padding(
                                    padding:
                                        const EdgeInsets.fromLTRB(4, 12, 4, 8),
                                    child: Text(
                                      e.key,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          color: _navy),
                                    ),
                                  ),
                                  ...e.value.map(_taskTile),
                                ]),
                          ],
                        ),
                ),
    );
  }

  Widget _progressCard(int done, int total) {
    final pct = total == 0 ? 0.0 : done / total;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Avancement',
                  style: TextStyle(fontWeight: FontWeight.bold, color: _navy)),
              Text('$done / $total',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, color: _green)),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: const Color(0xFFE5E7EB),
              valueColor: const AlwaysStoppedAnimation(_green),
            ),
          ),
          const SizedBox(height: 6),
          Text('${(pct * 100).round()}% terminé',
              style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
        ],
      ),
    );
  }

  Widget _taskTile(Map<String, dynamic> task) {
    final id = task['id']?.toString() ?? '';
    final done = _isDone(task['status'] as String?);
    final busy = _updating.contains(id);
    final title = (task['title'] as String?)?.trim();
    final date = (task['scheduled_date'] as String?) ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF0F3)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        onTap: busy ? null : () => _toggle(task),
        leading: busy
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2))
            : Icon(
                done ? Icons.check_circle : Icons.radio_button_unchecked,
                color: done ? _green : const Color(0xFFCBD5E1),
                size: 28,
              ),
        title: Text(
          (title != null && title.isNotEmpty) ? title : 'Tâche',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: done ? const Color(0xFF94A3B8) : _navy,
            decoration: done ? TextDecoration.lineThrough : null,
          ),
        ),
        subtitle: date.isNotEmpty
            ? Text(date,
                style:
                    const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)))
            : null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: done ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            done ? 'Terminé' : 'À faire',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: done ? const Color(0xFF166534) : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }

  Widget _emptyView() {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Icon(Icons.assignment_outlined, size: 56, color: Color(0xFFCBD5E1)),
        SizedBox(height: 16),
        Center(
          child: Text('Aucune tâche assignée',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B))),
        ),
        SizedBox(height: 6),
        Center(
          child: Text('Vos tâches apparaîtront ici dès qu\'elles seront planifiées.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
        ),
      ],
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
            const SizedBox(height: 12),
            Text(_error ?? 'Erreur',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}
