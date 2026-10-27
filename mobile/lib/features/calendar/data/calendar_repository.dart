import 'package:supabase_flutter/supabase_flutter.dart';
import 'calendar_event_model.dart';

class CalendarRepository {
  final SupabaseClient _client = Supabase.instance.client;

  // ─── FETCH ────────────────────────────────────────────────

  /// All events for the authenticated user, joined with workers & tasks.
  Future<List<CalendarEvent>> fetchEvents() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final response = await _client
        .from('calendar_events')
        .select('''
          *,
          calendar_event_workers(
            id, event_id, worker_id, is_chef,
            workers(first_name, last_name, profile_picture_url, profession)
          ),
          calendar_event_tasks(id, event_id, title, status, progress)
        ''')
        .eq('user_id', userId)
        .order('start_at', ascending: true);

    return (response as List)
        .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Events for a specific calendar day.
  Future<List<CalendarEvent>> fetchEventsForDay(DateTime day) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final from = DateTime(day.year, day.month, day.day).toUtc().toIso8601String();
    final to = DateTime(day.year, day.month, day.day, 23, 59, 59).toUtc().toIso8601String();

    final response = await _client
        .from('calendar_events')
        .select('''
          *,
          calendar_event_workers(
            id, event_id, worker_id, is_chef,
            workers(first_name, last_name, profile_picture_url, profession)
          ),
          calendar_event_tasks(id, event_id, title, status, progress)
        ''')
        .eq('user_id', userId)
        .gte('start_at', from)
        .lte('start_at', to)
        .order('start_at', ascending: true);

    return (response as List)
        .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Events for a full month.
  Future<List<CalendarEvent>> fetchEventsForMonth(int year, int month) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final from = DateTime(year, month, 1).toUtc().toIso8601String();
    final to = DateTime(year, month + 1, 1).toUtc().toIso8601String();

    final response = await _client
        .from('calendar_events')
        .select('''
          *,
          calendar_event_workers(
            id, event_id, worker_id, is_chef,
            workers(first_name, last_name, profile_picture_url, profession)
          ),
          calendar_event_tasks(id, event_id, title, status, progress)
        ''')
        .eq('user_id', userId)
        .gte('start_at', from)
        .lt('start_at', to)
        .order('start_at', ascending: true);

    return (response as List)
        .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// All active projects (status != Terminé) — used for "Chantiers actifs" filter.
  Future<List<CalendarEvent>> fetchActiveProjectEvents() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return [];

    final response = await _client
        .from('calendar_events')
        .select('''
          *,
          calendar_event_workers(
            id, event_id, worker_id, is_chef,
            workers(first_name, last_name, profile_picture_url, profession)
          ),
          calendar_event_tasks(id, event_id, title, status, progress)
        ''')
        .eq('user_id', userId)
        .eq('status', 'En Cours')
        .order('start_at', ascending: true);

    return (response as List)
        .map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Single event by id.
  Future<CalendarEvent?> fetchEventById(String id) async {
    final response = await _client
        .from('calendar_events')
        .select('''
          *,
          calendar_event_workers(
            id, event_id, worker_id, is_chef,
            workers(first_name, last_name, profile_picture_url, profession)
          ),
          calendar_event_tasks(id, event_id, title, status, progress)
        ''')
        .eq('id', id)
        .maybeSingle();

    if (response == null) return null;
    return CalendarEvent.fromJson(response as Map<String, dynamic>);
  }

  // ─── CREATE ───────────────────────────────────────────────

  Future<CalendarEvent?> createEvent(
    CalendarEvent event,
    List<String> workerIds, {
    String? chefWorkerId,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('Not authenticated');

    // Insert the event
    final insertData = event.toInsertJson();
    insertData['user_id'] = userId;

    final response = await _client
        .from('calendar_events')
        .insert(insertData)
        .select()
        .single();

    final newEventId = (response['id'] as Object).toString();

    // Insert worker links
    if (workerIds.isNotEmpty) {
      final workerRows = workerIds.map((wid) => {
            'event_id': newEventId,
            'worker_id': wid,
            'is_chef': wid == chefWorkerId,
            'user_id': userId,
          }).toList();

      await _client.from('calendar_event_workers').insert(workerRows);
    }

    return fetchEventById(newEventId);
  }

  // ─── UPDATE ───────────────────────────────────────────────

  Future<void> updateEvent(String eventId, Map<String, dynamic> data) async {
    await _client
        .from('calendar_events')
        .update(data)
        .eq('id', eventId);
  }

  Future<void> updateEventProgress(String eventId, int progress) async {
    await _client.from('calendar_events').update({
      'progress': progress,
    }).eq('id', eventId);
  }

  Future<void> updateTaskStatus(String taskId, String status, int progress) async {
    await _client.from('calendar_event_tasks').update({
      'status': status,
      'progress': progress,
    }).eq('id', taskId);
  }

  // ─── DELETE ───────────────────────────────────────────────

  Future<void> deleteEvent(String eventId) async {
    await _client.from('calendar_events').delete().eq('id', eventId);
  }

  // ─── WORKERS ──────────────────────────────────────────────

  Future<void> addWorkerToEvent(
      String eventId, String workerId, bool isChef) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('Not authenticated');

    await _client.from('calendar_event_workers').upsert({
      'event_id': eventId,
      'worker_id': workerId,
      'is_chef': isChef,
      'user_id': userId,
    });
  }

  Future<void> removeWorkerFromEvent(String eventId, String workerId) async {
    await _client
        .from('calendar_event_workers')
        .delete()
        .eq('event_id', eventId)
        .eq('worker_id', workerId);
  }

  // ─── TASKS ────────────────────────────────────────────────

  Future<void> addTask(String eventId, String title) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('Not authenticated');

    await _client.from('calendar_event_tasks').insert({
      'event_id': eventId,
      'title': title,
      'status': 'En attente',
      'progress': 0,
      'user_id': userId,
    });
  }
}
