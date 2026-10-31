import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final availabilityServiceProvider = Provider<AvailabilityService>((ref) {
  return AvailabilityService(
    SupabaseConfig.client,
    ref.watch(scheduledTaskRepositoryProvider),
  );
});

/// A block of time where a worker is already occupied — either by a
/// [ScheduledTask] or by an [Rdv]. Returned by [AvailabilityService.findConflict].
class WorkerBusyBlock {
  final String source; // 'scheduled_task' | 'rdv'
  final String title;
  final String startTime; // "HH:mm"
  final String endTime;   // "HH:mm"

  const WorkerBusyBlock({
    required this.source,
    required this.title,
    required this.startTime,
    required this.endTime,
  });
}

/// Unified conflict detection across both the scheduling table
/// ([scheduled_tasks]) and the appointment table ([rdvs]).
class AvailabilityService {
  final SupabaseClient _client;
  final ScheduledTaskRepository _scheduledRepo;

  AvailabilityService(this._client, this._scheduledRepo);

  /// Returns the first existing busy block that overlaps with the proposed
  /// slot, or `null` if the worker is free.
  Future<WorkerBusyBlock?> findConflict({
    required String workerId,
    required DateTime date,
    required String startTime,
    required int durationMinutes,
    String? excludeScheduledTaskId,
    String? excludeRdvId,
  }) async {
    final proposedStart = _toMinutes(startTime);
    final proposedEnd = proposedStart + durationMinutes;

    // 1. Scheduled tasks.
    final existingTask = await _scheduledRepo.checkConflict(
      workerId: workerId,
      date: date,
      startTime: startTime,
      durationMinutes: durationMinutes,
      excludeTaskId: excludeScheduledTaskId,
    );
    if (existingTask != null) {
      return WorkerBusyBlock(
        source: 'scheduled_task',
        title: existingTask.title,
        startTime: existingTask.startTime,
        endTime: existingTask.endTime,
      );
    }

    // 2. Appointments (rdvs) for the same worker on the same day.
    final rows = await _client
        .from('rdvs')
        .select('id, title, scheduled_at, duration')
        .eq('worker_id', workerId);

    for (final raw in rows as List) {
      final m = raw as Map<String, dynamic>;
      if (excludeRdvId != null && m['id'] == excludeRdvId) continue;

      final scheduledAt = DateTime.tryParse(m['scheduled_at'] as String? ?? '');
      if (scheduledAt == null) continue;
      if (scheduledAt.year != date.year ||
          scheduledAt.month != date.month ||
          scheduledAt.day != date.day) {
        continue;
      }

      final rdvStart = scheduledAt.hour * 60 + scheduledAt.minute;
      final rdvDuration = _durationLabelToMinutes(m['duration'] as String?);
      final rdvEnd = rdvStart + rdvDuration;

      if (proposedStart < rdvEnd && rdvStart < proposedEnd) {
        return WorkerBusyBlock(
          source: 'rdv',
          title: (m['title'] as String?) ?? 'RDV',
          startTime: _fmt(rdvStart),
          endTime: _fmt(rdvEnd),
        );
      }
    }

    return null;
  }

  /// Maps the textual duration field used on the `rdvs` table
  /// ("30 min", "1h", "2h", "½ journée", "Journée") to minutes.
  static int _durationLabelToMinutes(String? label) {
    switch (label) {
      case '30 min':
        return 30;
      case '1h':
        return 60;
      case '2h':
        return 120;
      case '½ journée':
        return 240;
      case 'Journée':
        return 480;
      default:
        return 60;
    }
  }

  static int _toMinutes(String hhmm) {
    final p = hhmm.split(':');
    return int.parse(p[0]) * 60 + int.parse(p[1]);
  }

  static String _fmt(int totalMinutes) {
    final h = (totalMinutes ~/ 60).clamp(0, 23);
    final m = (totalMinutes % 60).clamp(0, 59);
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
  }
}
