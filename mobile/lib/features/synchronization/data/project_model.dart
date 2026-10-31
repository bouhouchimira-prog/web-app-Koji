class Project {
  final String id;
  final String title;
  final String clientName;
  final String? address;
  final String status; // 'En Cours', 'Terminé', 'À Venir'
  final String? imageUrl;
  final DateTime? startDate;
  final DateTime? endDate;

  Project({
    required this.id,
    required this.title,
    required this.clientName,
    this.address,
    this.status = 'En Cours',
    this.imageUrl,
    this.startDate,
    this.endDate,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] as String,
      title: json['title'] as String,
      clientName: json['client_name'] as String,
      address: json['address'] as String?,
      status: json['status'] as String? ?? 'En Cours',
      imageUrl: json['image_url'] as String?,
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'])
          : null,
      endDate:
          json['end_date'] != null ? DateTime.parse(json['end_date']) : null,
    );
  }

  /// Map a chantiers table row to a Project
  factory Project.fromChantierJson(Map<String, dynamic> json) {
    // Build a readable title from reference or city
    final reference = json['reference'] as String? ?? '';
    final city = json['city'] as String? ?? '';
    final street = json['street'] as String? ?? '';
    final title = reference.isNotEmpty ? reference : (city.isNotEmpty ? city : 'Chantier');
    final address = [street, city].where((s) => s.isNotEmpty).join(', ');

    return Project(
      id: json['id'] as String,
      title: title,
      clientName: json['client_name'] as String? ?? '',
      address: address.isNotEmpty ? address : null,
      status: json['status'] as String? ?? 'En attente',
      imageUrl: json['image_url'] as String?,
      startDate: json['start_date'] != null
          ? DateTime.tryParse(json['start_date'])
          : null,
      endDate: json['end_date'] != null
          ? DateTime.tryParse(json['end_date'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'client_name': clientName,
      'address': address,
      'status': status,
      'image_url': imageUrl,
      'start_date': startDate?.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
    };
  }
}

class ProjectAssignment {
  final String id;
  final String projectId;
  final String workerId;
  final String? role;
  final DateTime assignedAt;

  ProjectAssignment({
    required this.id,
    required this.projectId,
    required this.workerId,
    this.role,
    required this.assignedAt,
  });

  factory ProjectAssignment.fromJson(Map<String, dynamic> json) {
    return ProjectAssignment(
      id: json['id'] as String,
      projectId: (json['chantier_id'] ?? json['project_id']) as String,
      workerId: json['worker_id'] as String,
      role: json['role'] as String?,
      assignedAt: DateTime.parse(json['assigned_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'chantier_id': projectId,
      'worker_id': workerId,
      'role': role,
      'assigned_at': assignedAt.toIso8601String(),
    };
  }
}

class TaskItem {
  final String id;
  final String projectId;
  final String userId;
  final String taskName;
  final String roomName;
  final String status; // 'À Faire', 'En Cours', 'Terminé'
  final Map<String, dynamic>? details;
  final DateTime? scheduledDate;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? startTime; // e.g. "08:30"
  final String? endTime; // e.g. "17:00"
  final String? duration; // e.g. "2h30" (legacy or calculated)
  final String? workerId;

  TaskItem({
    required this.id,
    required this.projectId,
    required this.userId,
    required this.taskName,
    required this.roomName,
    required this.status,
    this.details,
    this.scheduledDate,
    this.startDate,
    this.endDate,
    this.startTime,
    this.endTime,
    this.duration,
    this.workerId,
  });

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    final details = json['details'] as Map<String, dynamic>?;

    DateTime? parsedDate;
    if (json['scheduled_date'] != null) {
      parsedDate = DateTime.tryParse(json['scheduled_date']);
    }

    return TaskItem(
      id: json['id'] as String,
      projectId: json['project_id'] as String,
      userId: json['user_id'] as String,
      taskName: json['task_name'] as String,
      roomName: json['room_name'] as String,
      status: json['status'] as String,
      details: details,
      scheduledDate: parsedDate,
      startDate: json['start_date'] != null
          ? DateTime.tryParse(json['start_date'])
          : null,
      endDate:
          json['end_date'] != null ? DateTime.tryParse(json['end_date']) : null,
      startTime: json['start_time'] ?? details?['start_time'],
      endTime: json['end_time'],
      duration: details?['duration'],
      workerId: json['worker_id'],
    );
  }

  /// Map a chantier_tasks row to a TaskItem
  factory TaskItem.fromChantierTaskJson(Map<String, dynamic> json) {
    return TaskItem(
      id: json['id'] as String,
      projectId: json['chantier_id'] as String,
      userId: '',
      taskName: json['label'] as String? ?? 'Tâche',
      roomName: '',
      status: (json['is_done'] as bool? ?? false) ? 'Terminé' : 'À Faire',
      scheduledDate: null,
    );
  }
}
