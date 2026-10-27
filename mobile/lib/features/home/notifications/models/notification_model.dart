/// A notification row from the shared Supabase `notifications` table (see
/// koji-main/supabase/migrations/0001_notifications.sql).
///
/// Recipient scoping mirrors the web app's taxonomy: [accountType]/[audience]
/// distinguish company vs. client-portal vs. worker-portal rows, though the
/// entreprise app (this one) currently only ever reads/writes company rows
/// (accountType == null && audience == null).
class AppNotification {
  final String id;
  final String userId;
  final String? accountType; // null (company) | 'particulier'
  final String? audience; // null (company) | 'worker'
  final String? workerId;
  final String type;
  final String title;
  final String message;
  final String? projectId;
  final String? taskId;
  final String? quoteId;
  final String? actionUrl;
  final String? actionLabel;
  final Map<String, dynamic> meta;
  final bool read;
  final bool archived;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.userId,
    this.accountType,
    this.audience,
    this.workerId,
    required this.type,
    required this.title,
    required this.message,
    this.projectId,
    this.taskId,
    this.quoteId,
    this.actionUrl,
    this.actionLabel,
    this.meta = const {},
    this.read = false,
    this.archived = false,
    required this.createdAt,
  });

  factory AppNotification.fromMap(Map<String, dynamic> map) {
    return AppNotification(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      accountType: map['account_type'] as String?,
      audience: map['audience'] as String?,
      workerId: map['worker_id'] as String?,
      type: (map['type'] as String?) ?? 'generic',
      title: (map['title'] as String?) ?? '',
      message: (map['message'] as String?) ?? '',
      projectId: map['project_id'] as String?,
      taskId: map['task_id'] as String?,
      quoteId: map['quote_id'] as String?,
      actionUrl: map['action_url'] as String?,
      actionLabel: map['action_label'] as String?,
      meta: (map['meta'] as Map?)?.cast<String, dynamic>() ?? const {},
      read: (map['read'] as bool?) ?? false,
      archived: (map['archived'] as bool?) ?? false,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}

/// Notification types produced today, mirrored from web's taxonomy
/// (app/api/quotes, app/api/tasks, app/api/urgent-alerts call sites) so both
/// apps agree on the same string keys once the web side migrates onto this
/// table.
abstract class NotificationType {
  static const quoteSigned = 'quote.signed';
  static const newMessage = 'company.reply';
  static const workerReport = 'worker.claim';
}
