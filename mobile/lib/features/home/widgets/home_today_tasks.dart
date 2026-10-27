import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/home/widgets/dashboard_section.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';

/// Home "À faire maintenant" content: every scheduled task that is due today
/// OR overdue (its start time has passed but it was never started), grouped by
/// chantier — mirroring the synchronization planning view. Each task shows its
/// assigned workers, time window, a status dot, and a "Démarrer" action.
class HomeTodayTasks extends ConsumerWidget {
  const HomeTodayTasks({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(allScheduledTasksProvider);

    return tasksAsync.when(
      loading: () => const Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      error: (err, _) => DashboardEmptyState(
        title: 'Erreur de chargement',
        subtitle: err.toString(),
      ),
      data: (tasks) {
        final now = DateTime.now();
        final endOfToday = DateTime(now.year, now.month, now.day)
            .add(const Duration(days: 1));

        // Keep tasks that are due today or earlier and not yet finished. A task
        // already started/finished is dropped (it's no longer "à faire"); a
        // future task (tomorrow+) is dropped too.
        final relevant = tasks.where((t) {
          if (t.isStarted) return false; // En cours / Terminé
          return t.startDateTime.isBefore(endOfToday);
        }).toList();

        if (relevant.isEmpty) {
          return const DashboardEmptyState(
            title: 'Aucune tâche pour aujourd\'hui',
            subtitle: 'Vous êtes à jour !',
          );
        }

        // Group by chantier, preserving first-seen order.
        final groups = <String, List<ScheduledTask>>{};
        final titles = <String, String>{};
        for (final t in relevant) {
          groups.putIfAbsent(t.chantierId, () => []).add(t);
          titles[t.chantierId] = t.chantierReference?.isNotEmpty == true
              ? t.chantierReference!
              : (t.chantierCity?.isNotEmpty == true
                  ? t.chantierCity!
                  : 'Chantier');
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final entry in groups.entries) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8, top: 4),
                child: Row(
                  children: [
                    Icon(Icons.handyman_outlined,
                        size: 16, color: AppTheme.textSecondary(context)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        titles[entry.key] ?? 'Chantier',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                    ),
                    Text(
                      '${entry.value.length} tâche${entry.value.length > 1 ? 's' : ''}',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              ),
              ...entry.value.map(
                (t) => _HomeTaskCard(
                  task: t,
                  now: now,
                  onChanged: () =>
                      ref.invalidate(allScheduledTasksProvider),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ],
        );
      },
    );
  }
}

class _HomeTaskCard extends ConsumerWidget {
  final ScheduledTask task;
  final DateTime now;
  final VoidCallback onChanged;

  const _HomeTaskCard({
    required this.task,
    required this.now,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = task.stateAt(now);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: state.color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: state.color.withValues(alpha: 0.25), width: 1.2),
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
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary(context),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: state.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  state.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: state.color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.people_outline,
                  size: 15, color: AppTheme.textSecondary(context)),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  task.workersLabel,
                  style: TextStyle(
                      fontSize: 13, color: AppTheme.textPrimary(context)),
                ),
              ),
              Icon(Icons.schedule,
                  size: 15, color: AppTheme.textSecondary(context)),
              const SizedBox(width: 5),
              Text(
                '${task.startTime} – ${task.endTime}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textPrimary(context),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () async {
                await ref
                    .read(scheduledTaskRepositoryProvider)
                    .updateStatus(task.id, 'En cours');
                onChanged();
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: ScheduleState.active.color,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.play_arrow_rounded, size: 16, color: Colors.white),
                    SizedBox(width: 4),
                    Text('Démarrer',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
