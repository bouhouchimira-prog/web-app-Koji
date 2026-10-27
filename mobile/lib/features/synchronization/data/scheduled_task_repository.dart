import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final scheduledTaskRepositoryProvider = Provider<ScheduledTaskRepository>(
  (ref) => ScheduledTaskRepository(SupabaseConfig.client),
);

/// Fetches every scheduled task for the current user on a given day, with
/// worker + chantier fields joined for display.
final scheduledTasksForDayProvider =
    FutureProvider.family<List<ScheduledTask>, DateTime>((ref, day) async {
  final repo = ref.watch(scheduledTaskRepositoryProvider);
  return repo.fetchForDate(day);
});

final scheduledTasksForChantierProvider =
    FutureProvider.family<List<ScheduledTask>, String>((ref, chantierId) async {
  final repo = ref.watch(scheduledTaskRepositoryProvider);
  return repo.fetchForChantier(chantierId);
});

/// All scheduled tasks for the current user — feeds the synchronization hub
/// where tasks are grouped under their chantier.
final allScheduledTasksProvider =
    FutureProvider<List<ScheduledTask>>((ref) async {
  final repo = ref.watch(scheduledTaskRepositoryProvider);
  return repo.fetchAll();
});

class ScheduledTaskRepository {
  final SupabaseClient _client;

  ScheduledTaskRepository(this._client);

  /// Select with nested reads on the worker and chantier FKs so the UI gets
  /// everything it needs in one round-trip (same pattern as
  /// lib/features/calendar/data/calendar_repository.dart).
  static const _selectWithJoins = '''
*,
workers ( first_name, last_name, profession ),
chantiers ( reference, city ),
scheduled_task_workers ( worker_id, workers ( first_name, last_name, profession ) )
''';

  /// Create a task. [workerIds] is the full set of assigned workers; the first
  /// becomes the row's primary worker_id (legacy column) and all are written to
  /// the scheduled_task_workers join table. Falls back to the task's single
  /// workerId when [workerIds] is null/empty.
  Future<ScheduledTask> create(ScheduledTask task, {List<String>? workerIds}) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final ids = _resolveWorkerIds(task, workerIds);

    final payload = task.toInsertJson();
    payload['user_id'] = userId;
    payload['worker_id'] = ids.first;

    final row = await _client
        .from('scheduled_tasks')
        .insert(payload)
        .select('id')
        .single();
    final id = row['id'] as String;

    await _syncWorkers(id, ids);
    return (await fetchById(id))!;
  }

  Future<ScheduledTask> update(ScheduledTask task, {List<String>? workerIds}) async {
    final ids = _resolveWorkerIds(task, workerIds);

    final payload = task.toInsertJson()
      ..remove('user_id'); // immutable after insert
    payload['worker_id'] = ids.first;

    await _client
        .from('scheduled_tasks')
        .update(payload)
        .eq('id', task.id);

    await _syncWorkers(task.id, ids);
    return (await fetchById(task.id))!;
  }

  /// Replace the join-table workers for a task with [ids] (deduped, non-empty).
  Future<void> _syncWorkers(String taskId, List<String> ids) async {
    await _client
        .from('scheduled_task_workers')
        .delete()
        .eq('scheduled_task_id', taskId);
    if (ids.isEmpty) return;
    await _client.from('scheduled_task_workers').insert([
      for (final w in ids) {'scheduled_task_id': taskId, 'worker_id': w},
    ]);
  }

  /// Dedupe + non-empty worker id list, primary worker first.
  List<String> _resolveWorkerIds(ScheduledTask task, List<String>? workerIds) {
    final source = (workerIds != null && workerIds.isNotEmpty)
        ? workerIds
        : <String>[task.workerId];
    final seen = <String>[];
    for (final id in source) {
      if (id.isNotEmpty && !seen.contains(id)) seen.add(id);
    }
    if (seen.isEmpty) seen.add(task.workerId);
    return seen;
  }

  Future<void> delete(String id) async {
    await _client.from('scheduled_tasks').delete().eq('id', id);
  }

  /// Update only the status (used by the green/red start/finish buttons in the
  /// synchronization view). Status drives the task colour: 'À faire' = pending,
  /// 'En cours'/'Terminé' = started (green), overdue 'À faire' = red.
  Future<void> updateStatus(String id, String status) async {
    await _client
        .from('scheduled_tasks')
        .update({'status': status, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id);
  }

  /// Reassign a task to a different worker (single worker — replaces the set).
  Future<void> updateWorker(String id, String workerId) async {
    await updateWorkers(id, [workerId]);
  }

  /// Replace the full set of workers assigned to a task. The first id is also
  /// written to the legacy worker_id column.
  Future<void> updateWorkers(String id, List<String> workerIds) async {
    final ids = <String>[];
    for (final w in workerIds) {
      if (w.isNotEmpty && !ids.contains(w)) ids.add(w);
    }
    if (ids.isEmpty) return;
    await _client
        .from('scheduled_tasks')
        .update({'worker_id': ids.first, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', id);
    await _syncWorkers(id, ids);
  }

  /// Every scheduled task for the current user, grouped-friendly (ordered by
  /// chantier then date/time). Used by the synchronization hub list.
  Future<List<ScheduledTask>> fetchAll() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];
    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('user_id', userId)
        .order('scheduled_date', ascending: true)
        .order('start_time', ascending: true);
    return (rows as List)
        .map((e) => ScheduledTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ScheduledTask?> fetchById(String id) async {
    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('id', id)
        .limit(1);
    if (rows.isEmpty) return null;
    return ScheduledTask.fromJson(rows.first);
  }

  Future<List<ScheduledTask>> fetchForDate(DateTime day) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final dateStr = _dateOnly(day);

    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('user_id', userId)
        .eq('scheduled_date', dateStr)
        .order('start_time', ascending: true);

    return (rows as List)
        .map((e) => ScheduledTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ScheduledTask>> fetchForWorker(
      String workerId, DateTime day) async {
    final dateStr = _dateOnly(day);
    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('worker_id', workerId)
        .eq('scheduled_date', dateStr)
        .order('start_time', ascending: true);

    return (rows as List)
        .map((e) => ScheduledTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ScheduledTask>> fetchForChantier(String chantierId) async {
    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('chantier_id', chantierId)
        .order('scheduled_date', ascending: true)
        .order('start_time', ascending: true);

    return (rows as List)
        .map((e) => ScheduledTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Range fetch for month-level stats (e.g. planning month view totals).
  Future<List<ScheduledTask>> fetchForRange(
      DateTime from, DateTime to) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];
    final rows = await _client
        .from('scheduled_tasks')
        .select(_selectWithJoins)
        .eq('user_id', userId)
        .gte('scheduled_date', _dateOnly(from))
        .lte('scheduled_date', _dateOnly(to))
        .order('scheduled_date', ascending: true)
        .order('start_time', ascending: true);

    return (rows as List)
        .map((e) => ScheduledTask.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns the first existing scheduled task that overlaps with the
  /// proposed slot, or `null` if the worker is free.
  Future<ScheduledTask?> checkConflict({
    required String workerId,
    required DateTime date,
    required String startTime,
    required int durationMinutes,
    String? excludeTaskId,
  }) async {
    final existing = await fetchForWorker(workerId, date);
    final probe = ScheduledTask(
      id: '__probe__',
      userId: '',
      chantierId: '',
      workerId: workerId,
      title: '',
      scheduledDate: date,
      startTime: startTime,
      durationMinutes: durationMinutes,
    );
    for (final t in existing) {
      if (excludeTaskId != null && t.id == excludeTaskId) continue;
      if (probe.overlaps(t)) return t;
    }
    return null;
  }

  static String _dateOnly(DateTime d) {
    return '${d.year.toString().padLeft(4, '0')}-'
        '${d.month.toString().padLeft(2, '0')}-'
        '${d.day.toString().padLeft(2, '0')}';
  }
}
