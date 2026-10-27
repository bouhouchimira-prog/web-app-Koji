import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

/// Synchronization hub.
///
/// Two quick actions at the top — create/see worker profiles and see all
/// chantiers — followed by the live list of chantiers, each expanding to its
/// scheduled tasks. Every task shows its assigned worker, start–end time, and a
/// traffic-light dot:
///   • blue  = start time hasn't arrived yet
///   • green = worker started (status 'En cours'/'Terminé')
///   • red   = start time passed but worker hasn't started
class SynchronizationScreen extends ConsumerStatefulWidget {
  const SynchronizationScreen({super.key});

  @override
  ConsumerState<SynchronizationScreen> createState() =>
      _SynchronizationScreenState();
}

class _SynchronizationScreenState extends ConsumerState<SynchronizationScreen> {
  static const _darkText = Color(0xFF031229);
  static const _greyText = Color(0xFF8B95A5);
  static const _appBg = Color(0xFFFBFBFC);

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(allScheduledTasksProvider);

    return Scaffold(
      backgroundColor: _appBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/synchronization/plan-tasks');
          if (mounted) ref.invalidate(allScheduledTasksProvider);
        },
        backgroundColor: const Color(0xFF2E65F3),
        icon: const Icon(Icons.event_available, color: Colors.white),
        label: const Text(
          'Planifier une tâche',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
      body: Stack(
        children: [
          Positioned(
            top: -100,
            right: -50,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withOpacity(0.8),
                    const Color(0xFFFBE4D2).withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(allScheduledTasksProvider),
              child: ListView(
                padding: const EdgeInsets.symmetric(
                    horizontal: 24.0, vertical: 20.0),
                children: [
                  _buildHeader(context),
                  const SizedBox(height: 28),
                  Text(
                    "Synchronisation",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _darkText,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "Affectez vos ouvriers aux tâches et suivez l'avancement",
                    style: TextStyle(fontSize: 14, color: _greyText),
                  ),
                  const SizedBox(height: 20),
                  // Two quick actions
                  Row(
                    children: [
                      Expanded(
                        child: _buildActionCard(
                          title: "Profils\nOuvriers",
                          icon: Icons.person,
                          onTap: () async {
                            await context.push('/workers');
                            if (mounted) {
                              ref.invalidate(allScheduledTasksProvider);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildActionCard(
                          title: "Affectation\nChantiers",
                          icon: Icons.groups,
                          onTap: () => context.push('/projects'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  Text(
                    "Tâches par chantier",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _darkText,
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildLegend(),
                  const SizedBox(height: 16),
                  tasksAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => _buildEmpty(
                        "Erreur de chargement", e.toString()),
                    data: (tasks) {
                      if (tasks.isEmpty) {
                        return _buildEmpty(
                          "Aucune tâche planifiée",
                          "Appuyez sur « Planifier une tâche » pour assigner un ouvrier.",
                        );
                      }
                      return _buildChantierGroups(tasks);
                    },
                  ),
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Chantier groups ─────────────────────────────────────────────────────
  Widget _buildChantierGroups(List<ScheduledTask> tasks) {
    // Group by chantier, preserving first-seen order.
    final groups = <String, List<ScheduledTask>>{};
    final titles = <String, String>{};
    for (final t in tasks) {
      groups.putIfAbsent(t.chantierId, () => []).add(t);
      titles[t.chantierId] = t.chantierReference?.isNotEmpty == true
          ? t.chantierReference!
          : (t.chantierCity?.isNotEmpty == true ? t.chantierCity! : 'Chantier');
    }

    final now = DateTime.now();
    return Column(
      children: groups.entries.map((entry) {
        final chantierTasks = entry.value;
        return _ChantierGroupCard(
          title: titles[entry.key] ?? 'Chantier',
          tasks: chantierTasks,
          now: now,
          onChanged: () => ref.invalidate(allScheduledTasksProvider),
        );
      }).toList(),
    );
  }

  Widget _buildLegend() {
    Widget dot(Color c, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(color: c, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
            Text(label,
                style: const TextStyle(fontSize: 11, color: _greyText)),
          ],
        );
    return Wrap(
      spacing: 16,
      runSpacing: 4,
      children: [
        dot(ScheduleState.upcoming.color, "À venir"),
        dot(ScheduleState.active.color, "En cours"),
        dot(ScheduleState.overdue.color, "En retard"),
      ],
    );
  }

  Widget _buildEmpty(String title, String subtitle) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEEF2F6), width: 1.5),
      ),
      child: Column(
        children: [
          Icon(Icons.event_busy, size: 40, color: _greyText.withOpacity(0.6)),
          const SizedBox(height: 12),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: _darkText)),
          const SizedBox(height: 6),
          Text(subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: _greyText)),
        ],
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────────────────
  Widget _buildHeader(BuildContext context) {
    return Row(
      children: [
        GestureDetector(
          onTap: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: _darkText.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.chevron_left, color: _darkText, size: 28),
          ),
        ),
        const Expanded(
          child: Text(
            "Synchronisation",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: _darkText,
            ),
          ),
        ),
        const SizedBox(width: 44),
      ],
    );
  }

  Widget _buildActionCard({
    required String title,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: _darkText.withOpacity(0.03),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
              ),
              child: Icon(icon, size: 30, color: _darkText),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: _darkText,
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One chantier card containing its list of scheduled tasks.
class _ChantierGroupCard extends ConsumerWidget {
  final String title;
  final List<ScheduledTask> tasks;
  final DateTime now;
  final VoidCallback onChanged;

  const _ChantierGroupCard({
    required this.title,
    required this.tasks,
    required this.now,
    required this.onChanged,
  });

  static const _darkText = Color(0xFF031229);
  static const _greyText = Color(0xFF8B95A5);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _darkText.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 18),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
          initiallyExpanded: true,
          shape: const Border(),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.handyman_outlined,
                size: 20, color: _darkText),
          ),
          title: Text(
            title,
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: _darkText),
          ),
          subtitle: Text(
            "${tasks.length} tâche${tasks.length > 1 ? 's' : ''}",
            style: const TextStyle(fontSize: 12, color: _greyText),
          ),
          children: tasks
              .map((t) => _TaskRow(
                    task: t,
                    now: now,
                    onChanged: onChanged,
                  ))
              .toList(),
        ),
      ),
    );
  }
}

/// A single scheduled task row: colour dot, worker, time, and actions.
class _TaskRow extends ConsumerWidget {
  final ScheduledTask task;
  final DateTime now;
  final VoidCallback onChanged;

  const _TaskRow({
    required this.task,
    required this.now,
    required this.onChanged,
  });

  static const _darkText = Color(0xFF031229);
  static const _greyText = Color(0xFF8B95A5);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = task.stateAt(now);

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: state.color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: state.color.withOpacity(0.25), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 11,
                height: 11,
                decoration:
                    BoxDecoration(color: state.color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  task.title,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: _darkText),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: state.color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  state.label,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: state.color),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.people_outline, size: 15, color: _greyText),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  task.workersLabel,
                  style: const TextStyle(fontSize: 13, color: _darkText),
                ),
              ),
              const Icon(Icons.schedule, size: 15, color: _greyText),
              const SizedBox(width: 5),
              Text(
                "${task.startTime} – ${task.endTime}",
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: _darkText),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (!task.isStarted)
                _actionButton(
                  label: "Démarrer",
                  icon: Icons.play_arrow_rounded,
                  color: ScheduleState.active.color,
                  onTap: () => _setStatus(ref, 'En cours'),
                )
              else if (task.status != 'Terminé')
                _actionButton(
                  label: "Terminer",
                  icon: Icons.check_rounded,
                  color: const Color(0xFF0A1227),
                  onTap: () => _setStatus(ref, 'Terminé'),
                )
              else
                _actionButton(
                  label: "Rouvrir",
                  icon: Icons.refresh_rounded,
                  color: _greyText,
                  onTap: () => _setStatus(ref, 'À faire'),
                ),
              const SizedBox(width: 8),
              _iconButton(
                icon: Icons.swap_horiz,
                tooltip: "Changer l'ouvrier",
                onTap: () => _reassign(context, ref),
              ),
              const SizedBox(width: 8),
              _iconButton(
                icon: Icons.edit_outlined,
                tooltip: "Modifier",
                onTap: () async {
                  await context.push('/synchronization/schedule-task',
                      extra: {'editingTaskId': task.id});
                  onChanged();
                },
              ),
              const Spacer(),
              _iconButton(
                icon: Icons.delete_outline,
                tooltip: "Supprimer",
                color: ScheduleState.overdue.color,
                onTap: () => _confirmDelete(context, ref),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _setStatus(WidgetRef ref, String status) async {
    await ref.read(scheduledTaskRepositoryProvider).updateStatus(task.id, status);
    onChanged();
  }

  Future<void> _reassign(BuildContext context, WidgetRef ref) async {
    final workers = await WorkerRepository().getWorkers();
    if (!context.mounted) return;
    if (workers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text("Aucun ouvrier. Créez un profil d'abord.")));
      return;
    }
    final selectedIds = task.workerIds.toSet();
    final result = await showModalBottomSheet<Set<String>>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text("Choisir les ouvriers",
                    style: TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: workers.map((w) {
                    final checked = selectedIds.contains(w.id);
                    return CheckboxListTile(
                      value: checked,
                      activeColor: const Color(0xFF2E65F3),
                      controlAffinity: ListTileControlAffinity.leading,
                      secondary: const CircleAvatar(
                        backgroundColor: Color(0xFFF1F5F9),
                        child: Icon(Icons.person, color: _darkText),
                      ),
                      title: Text('${w.firstName} ${w.lastName}'.trim()),
                      subtitle: Text(w.profession),
                      onChanged: (v) => setSheet(() {
                        if (v == true) {
                          selectedIds.add(w.id);
                        } else {
                          selectedIds.remove(w.id);
                        }
                      }),
                    );
                  }).toList(),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: selectedIds.isEmpty
                        ? null
                        : () => Navigator.pop(ctx, selectedIds),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2E65F3),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Text('Valider',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (result != null && result.isNotEmpty) {
      await ref
          .read(scheduledTaskRepositoryProvider)
          .updateWorkers(task.id, result.toList());
      onChanged();
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer la tâche ?"),
        content: Text('« ${task.title} » sera définitivement supprimée.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text("Annuler")),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Supprimer",
                style: TextStyle(color: Color(0xFFE5484D))),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(scheduledTaskRepositoryProvider).delete(task.id);
      onChanged();
    }
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: Colors.white),
            const SizedBox(width: 4),
            Text(label,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ],
        ),
      ),
    );
  }

  Widget _iconButton({
    required IconData icon,
    required VoidCallback onTap,
    String? tooltip,
    Color color = _greyText,
  }) {
    final btn = GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(7),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icon, size: 17, color: color),
      ),
    );
    return tooltip != null ? Tooltip(message: tooltip, child: btn) : btn;
  }
}
