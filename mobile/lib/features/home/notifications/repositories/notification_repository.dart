import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/home/notifications/models/notification_model.dart';

/// Reads/writes the shared `notifications` table (see
/// koji-main/supabase/migrations/0001_notifications.sql). Company-scoped:
/// every call here operates on the signed-in entreprise user's own rows.
class NotificationRepository {
  NotificationRepository(this._client);

  final SupabaseClient _client;

  static const _table = 'notifications';

  String get _userId => _client.auth.currentUser!.id;

  Future<List<AppNotification>> getAll({bool includeArchived = false}) async {
    var query = _client.from(_table).select().eq('user_id', _userId);
    if (!includeArchived) query = query.eq('archived', false);
    final rows = await query.order('created_at', ascending: false).limit(100);
    return (rows as List)
        .map((e) => AppNotification.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  /// Insert a notification unless one with the same [type]+[dedupeKey]
  /// already exists for this user — idempotent by design so producer code
  /// (signature detection, new-message polling, worker-report polling) can
  /// safely call this on every refresh without duplicating rows.
  Future<void> addOnce({
    required String type,
    required String title,
    required String message,
    required String dedupeKey,
    String? projectId,
    String? taskId,
    String? quoteId,
    String? actionUrl,
    String? actionLabel,
    Map<String, dynamic>? meta,
  }) async {
    final mergedMeta = {...?meta, 'dedupeKey': dedupeKey};
    final existing = await _client
        .from(_table)
        .select('id')
        .eq('user_id', _userId)
        .eq('type', type)
        .eq('meta->>dedupeKey', dedupeKey)
        .limit(1);
    if ((existing as List).isNotEmpty) return;

    await _client.from(_table).insert({
      'user_id': _userId,
      'type': type,
      'title': title,
      'message': message,
      if (projectId != null) 'project_id': projectId,
      if (taskId != null) 'task_id': taskId,
      if (quoteId != null) 'quote_id': quoteId,
      if (actionUrl != null) 'action_url': actionUrl,
      if (actionLabel != null) 'action_label': actionLabel,
      'meta': mergedMeta,
    });
  }

  Future<void> markRead(String id) async {
    await _client.from(_table).update({'read': true}).eq('id', id);
  }

  Future<void> markAllRead() async {
    await _client
        .from(_table)
        .update({'read': true})
        .eq('user_id', _userId)
        .eq('read', false);
  }

  Future<void> archive(String id) async {
    await _client.from(_table).update({'archived': true}).eq('id', id);
  }

  Future<void> delete(String id) async {
    await _client.from(_table).delete().eq('id', id);
  }

  Future<void> deleteAll() async {
    await _client.from(_table).delete().eq('user_id', _userId);
  }
}

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository(Supabase.instance.client);
});
