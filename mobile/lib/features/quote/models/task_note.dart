/// A note/message on a chantier task, targeted to a specific audience
/// (client, workers, or both) — mirrors web's task-notes system
/// (app/api/task-notes/route.js), keyed by taskId rather than quoteId, unlike
/// the existing quote_messages chat.
class TaskNote {
  final String id;
  final String userId;
  final String taskId;
  final String? projectId;
  final String senderName;
  final String source; // 'company' | 'client' | 'worker'
  final String audience; // 'client' | 'workers' | 'both'
  final String message;
  final DateTime createdAt;
  final List<TaskReply> replies;

  const TaskNote({
    required this.id,
    required this.userId,
    required this.taskId,
    this.projectId,
    required this.senderName,
    required this.source,
    required this.audience,
    required this.message,
    required this.createdAt,
    this.replies = const [],
  });

  factory TaskNote.fromMap(Map<String, dynamic> map) {
    final repliesRaw = map['task_replies'] as List?;
    return TaskNote(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      taskId: map['task_id'] as String,
      projectId: map['project_id'] as String?,
      senderName: (map['sender_name'] as String?) ?? '',
      source: (map['source'] as String?) ?? 'company',
      audience: (map['audience'] as String?) ?? 'both',
      message: (map['message'] as String?) ?? '',
      createdAt: DateTime.parse(map['created_at'] as String),
      replies: (repliesRaw ?? const [])
          .map((e) => TaskReply.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt)),
    );
  }
}

class TaskReply {
  final String id;
  final String taskId;
  final String? replyToId;
  final String senderName;
  final String source; // 'company' | 'client'
  final String? message;
  final String? fileName;
  final String? fileUrl;
  final DateTime createdAt;

  const TaskReply({
    required this.id,
    required this.taskId,
    this.replyToId,
    required this.senderName,
    required this.source,
    this.message,
    this.fileName,
    this.fileUrl,
    required this.createdAt,
  });

  factory TaskReply.fromMap(Map<String, dynamic> map) {
    return TaskReply(
      id: map['id'] as String,
      taskId: map['task_id'] as String,
      replyToId: map['reply_to_id'] as String?,
      senderName: (map['sender_name'] as String?) ?? '',
      source: (map['source'] as String?) ?? 'company',
      message: map['message'] as String?,
      fileName: map['file_name'] as String?,
      fileUrl: map['file_url'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }
}

/// Audience targeting for a task note, mirroring web's 3 values.
abstract class TaskNoteAudience {
  static const client = 'client';
  static const workers = 'workers';
  static const both = 'both';

  static const values = [client, workers, both];

  static String label(String value) => switch (value) {
        client => 'Client uniquement',
        workers => 'Ouvriers uniquement',
        _ => 'Client et ouvriers',
      };
}
