import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/quote/models/task_note.dart';

/// Reads/writes the `task_notes` / `task_replies` tables (see
/// koji-main/supabase/migrations/0003_task_notes.sql). Flutter-native —
/// not shared with web's own task-notes system inside koji_web_state.
class TaskNoteRepository {
  TaskNoteRepository(this._client);

  final SupabaseClient _client;

  Future<List<TaskNote>> getForTask(String taskId) async {
    final rows = await _client
        .from('task_notes')
        .select('*, task_replies(*)')
        .eq('task_id', taskId)
        .order('created_at', ascending: true);
    return (rows as List)
        .map((e) => TaskNote.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> sendNote({
    required String taskId,
    String? projectId,
    required String senderName,
    required String audience,
    required String message,
  }) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) return;
    final userId = _client.auth.currentUser!.id;
    await _client.from('task_notes').insert({
      'user_id': userId,
      'task_id': taskId,
      if (projectId != null) 'project_id': projectId,
      'sender_name': senderName,
      'source': 'company',
      'audience': audience,
      'message': trimmed,
    });
  }

  Future<void> reply({
    required String taskId,
    String? projectId,
    String? replyToId,
    required String senderName,
    required String message,
  }) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) return;
    final userId = _client.auth.currentUser!.id;
    await _client.from('task_replies').insert({
      'user_id': userId,
      'task_id': taskId,
      if (projectId != null) 'project_id': projectId,
      if (replyToId != null) 'reply_to_id': replyToId,
      'sender_name': senderName,
      'source': 'company',
      'message': trimmed,
    });
  }
}

final taskNoteRepositoryProvider = Provider<TaskNoteRepository>((ref) {
  return TaskNoteRepository(Supabase.instance.client);
});
