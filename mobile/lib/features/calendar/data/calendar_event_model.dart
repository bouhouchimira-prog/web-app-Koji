class CalendarEvent {
  final String id;
  final String userId;
  final String title;
  final String eventType; // 'Chantier' | 'Devis' | 'Urgence' | 'Maintenance'
  final String? clientName;
  final String? clientId;
  final String? projectId;
  final String? address;
  final DateTime startAt;
  final DateTime endAt;
  final bool allDay;
  final String status; // 'En Cours' | 'Terminé' | 'Annulé' | 'En attente'
  final int progress; // 0-100
  final int? daysRemaining;
  final String? notes;
  final List<CalendarEventWorker> workers;
  final List<CalendarEventTask> tasks;
  final DateTime createdAt;

  CalendarEvent({
    required this.id,
    required this.userId,
    required this.title,
    this.eventType = 'Chantier',
    this.clientName,
    this.clientId,
    this.projectId,
    this.address,
    required this.startAt,
    required this.endAt,
    this.allDay = false,
    this.status = 'En Cours',
    this.progress = 0,
    this.daysRemaining,
    this.notes,
    this.workers = const [],
    this.tasks = const [],
    required this.createdAt,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String,
      eventType: json['event_type'] as String? ?? 'Chantier',
      clientName: json['client_name'] as String?,
      clientId: json['client_id'] as String?,
      projectId: json['project_id'] as String?,
      address: json['address'] as String?,
      startAt: DateTime.parse(json['start_at'] as String).toLocal(),
      endAt: DateTime.parse(json['end_at'] as String).toLocal(),
      allDay: json['all_day'] as bool? ?? false,
      status: json['status'] as String? ?? 'En Cours',
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      daysRemaining: (json['days_remaining'] as num?)?.toInt(),
      notes: json['notes'] as String?,
      workers: (json['calendar_event_workers'] as List<dynamic>?)
              ?.map((e) => CalendarEventWorker.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      tasks: (json['calendar_event_tasks'] as List<dynamic>?)
              ?.map((e) => CalendarEventTask.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
    );
  }

  Map<String, dynamic> toInsertJson() {
    return {
      'title': title,
      'event_type': eventType,
      'client_name': clientName,
      'client_id': clientId,
      'project_id': projectId,
      'address': address,
      'start_at': startAt.toUtc().toIso8601String(),
      'end_at': endAt.toUtc().toIso8601String(),
      'all_day': allDay,
      'status': status,
      'progress': progress,
      'days_remaining': daysRemaining,
      'notes': notes,
    };
  }

  /// Duration string e.g. "2h30"
  String get durationLabel {
    final diff = endAt.difference(startAt);
    final h = diff.inHours;
    final m = diff.inMinutes % 60;
    if (m == 0) return '${h}h00';
    return '${h}h${m.toString().padLeft(2, '0')}';
  }

  /// "08:30" from startAt
  String get startTimeLabel {
    final h = startAt.hour.toString().padLeft(2, '0');
    final m = startAt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  CalendarEvent copyWith({
    String? title,
    String? eventType,
    String? clientName,
    String? address,
    DateTime? startAt,
    DateTime? endAt,
    String? status,
    int? progress,
    int? daysRemaining,
    String? notes,
    List<CalendarEventWorker>? workers,
    List<CalendarEventTask>? tasks,
  }) {
    return CalendarEvent(
      id: id,
      userId: userId,
      title: title ?? this.title,
      eventType: eventType ?? this.eventType,
      clientName: clientName ?? this.clientName,
      clientId: clientId,
      projectId: projectId,
      address: address ?? this.address,
      startAt: startAt ?? this.startAt,
      endAt: endAt ?? this.endAt,
      allDay: allDay,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      daysRemaining: daysRemaining ?? this.daysRemaining,
      notes: notes ?? this.notes,
      workers: workers ?? this.workers,
      tasks: tasks ?? this.tasks,
      createdAt: createdAt,
    );
  }
}

class CalendarEventWorker {
  final String id;
  final String eventId;
  final String workerId;
  final bool isChef;
  // Joined worker fields (populated when we join with workers table)
  final String? firstName;
  final String? lastName;
  final String? profilePictureUrl;
  final String? profession;

  CalendarEventWorker({
    required this.id,
    required this.eventId,
    required this.workerId,
    this.isChef = false,
    this.firstName,
    this.lastName,
    this.profilePictureUrl,
    this.profession,
  });

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();

  factory CalendarEventWorker.fromJson(Map<String, dynamic> json) {
    final workerData = json['workers'] as Map<String, dynamic>?;
    return CalendarEventWorker(
      id: json['id'] as String,
      eventId: json['event_id'] as String,
      workerId: json['worker_id'] as String,
      isChef: json['is_chef'] as bool? ?? false,
      firstName: workerData?['first_name'] as String?,
      lastName: workerData?['last_name'] as String?,
      profilePictureUrl: workerData?['profile_picture_url'] as String?,
      profession: workerData?['profession'] as String?,
    );
  }
}

class CalendarEventTask {
  final String id;
  final String eventId;
  final String title;
  final String status; // 'En attente' | 'En cours' | 'Terminé'
  final int progress;

  CalendarEventTask({
    required this.id,
    required this.eventId,
    required this.title,
    this.status = 'En attente',
    this.progress = 0,
  });

  factory CalendarEventTask.fromJson(Map<String, dynamic> json) {
    return CalendarEventTask(
      id: json['id'] as String,
      eventId: json['event_id'] as String,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'En attente',
      progress: (json['progress'] as num?)?.toInt() ?? 0,
    );
  }
}
