import 'package:flutter/material.dart';

/// Traffic-light state of a scheduled task, driving its colour in the
/// synchronization view.
enum ScheduleState {
  /// Start time hasn't arrived yet — blue.
  upcoming(Color(0xFF2E65F3), 'À venir'),

  /// Worker has started (status 'En cours' or 'Terminé') — green.
  active(Color(0xFF18A957), 'En cours'),

  /// Start time passed but the worker hasn't started — red.
  overdue(Color(0xFFE5484D), 'En retard');

  const ScheduleState(this.color, this.label);
  final Color color;
  final String label;
}

/// A planned task: a specific worker, on a specific date, at a specific start
/// time, for a specific duration. This is the single source of truth for the
/// contractor's planning view (/planning).
///
/// Optionally linked to a [chantier_task] (the checklist entry it came from).
class ScheduledTask {
  final String id;
  final String userId;
  final String chantierId;
  final String? chantierTaskId;

  /// Link to a devis task (quote_tasks.id) — what the planning screen assigns.
  final String? quoteTaskId;

  final String workerId;
  final String title;
  final String? notes;

  /// Date portion only (time is in [startTime]).
  final DateTime scheduledDate;

  /// "HH:mm" 24-hour format.
  final String startTime;

  final int durationMinutes;

  /// Explicit end date — null for legacy rows (then derived from duration).
  /// Lets a task span multiple days.
  final DateTime? endDateExplicit;

  /// Explicit "HH:mm" end time — null for legacy rows.
  final String? endTimeExplicit;

  /// "À faire" | "En cours" | "Terminé" | "Annulé".
  final String status;

  // Joined fields populated by repository select with FK joins — read-only.
  final String? workerFirstName;
  final String? workerLastName;
  final String? workerProfession;
  final String? chantierReference;
  final String? chantierCity;

  /// All workers assigned to this task (from the scheduled_task_workers join
  /// table). Falls back to the single [workerId] worker for legacy rows.
  /// Read-only — populated by the repository select.
  final List<AssignedWorker> assignedWorkers;

  const ScheduledTask({
    required this.id,
    required this.userId,
    required this.chantierId,
    this.chantierTaskId,
    this.quoteTaskId,
    required this.workerId,
    required this.title,
    this.notes,
    required this.scheduledDate,
    required this.startTime,
    required this.durationMinutes,
    this.endDateExplicit,
    this.endTimeExplicit,
    this.status = 'À faire',
    this.workerFirstName,
    this.workerLastName,
    this.workerProfession,
    this.chantierReference,
    this.chantierCity,
    this.assignedWorkers = const [],
  });

  /// "HH:mm" end time. Uses the explicit end if set, otherwise computed from
  /// [startTime] + [durationMinutes] (clamped to 23:59 within the day).
  String get endTime {
    if (endTimeExplicit != null && endTimeExplicit!.isNotEmpty) {
      return endTimeExplicit!;
    }
    final parts = startTime.split(':');
    final startMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
    final end = (startMinutes + durationMinutes).clamp(0, 24 * 60 - 1);
    final h = (end ~/ 60).toString().padLeft(2, '0');
    final m = (end % 60).toString().padLeft(2, '0');
    return '$h:$m';
  }

  /// End date — explicit if set, otherwise the start date (single-day task).
  DateTime get endDate => endDateExplicit ?? scheduledDate;

  /// Full end DateTime (date + time).
  DateTime get endDateTime {
    final p = endTime.split(':');
    return DateTime(endDate.year, endDate.month, endDate.day,
        int.parse(p[0]), int.parse(p[1]));
  }

  /// True when the task spans more than one calendar day.
  bool get isMultiDay =>
      endDate.year != scheduledDate.year ||
      endDate.month != scheduledDate.month ||
      endDate.day != scheduledDate.day;

  TimeOfDay get startTimeOfDay {
    final parts = startTime.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  String get workerFullName {
    final f = workerFirstName ?? '';
    final l = workerLastName ?? '';
    final name = '$f $l'.trim();
    return name.isEmpty ? 'Ouvrier' : name;
  }

  /// Effective list of assigned workers. Uses the join-table set when present,
  /// otherwise falls back to the single primary worker (legacy rows).
  List<AssignedWorker> get workers {
    if (assignedWorkers.isNotEmpty) return assignedWorkers;
    return [
      AssignedWorker(
        id: workerId,
        firstName: workerFirstName,
        lastName: workerLastName,
        profession: workerProfession,
      ),
    ];
  }

  /// All assigned worker ids (deduplicated, primary first).
  List<String> get workerIds {
    final ids = <String>[workerId];
    for (final w in assignedWorkers) {
      if (!ids.contains(w.id)) ids.add(w.id);
    }
    return ids;
  }

  /// Comma-separated names of every assigned worker — for the planning cards.
  String get workersLabel {
    final names = workers.map((w) => w.fullName).where((n) => n.isNotEmpty);
    return names.isEmpty ? 'Ouvrier' : names.join(', ');
  }

  bool get isStarted => status == 'En cours' || status == 'Terminé';

  /// The full DateTime of this task's start, used to compare against "now".
  DateTime get startDateTime {
    final p = startTime.split(':');
    return DateTime(scheduledDate.year, scheduledDate.month, scheduledDate.day,
        int.parse(p[0]), int.parse(p[1]));
  }

  /// Traffic-light state for the synchronization view:
  ///   • [ScheduleState.upcoming] (blue)  — start time hasn't arrived yet.
  ///   • [ScheduleState.active]   (green) — worker started (status started).
  ///   • [ScheduleState.overdue]  (red)   — start time passed, still 'À faire'.
  ScheduleState stateAt(DateTime now) {
    if (isStarted) return ScheduleState.active;
    if (now.isBefore(startDateTime)) return ScheduleState.upcoming;
    return ScheduleState.overdue;
  }

  /// True if two tasks assigned to the same worker overlap on the same date.
  /// Used for conflict detection.
  bool overlaps(ScheduledTask other) {
    if (workerId != other.workerId) return false;
    if (scheduledDate.year != other.scheduledDate.year ||
        scheduledDate.month != other.scheduledDate.month ||
        scheduledDate.day != other.scheduledDate.day) {
      return false;
    }
    final a = _toMinutes(startTime);
    final b = _toMinutes(other.startTime);
    return a < b + other.durationMinutes && b < a + durationMinutes;
  }

  static int _toMinutes(String hhmm) {
    final p = hhmm.split(':');
    return int.parse(p[0]) * 60 + int.parse(p[1]);
  }

  factory ScheduledTask.fromJson(Map<String, dynamic> json) {
    final worker = json['workers'] as Map<String, dynamic>?;
    final chantier = json['chantiers'] as Map<String, dynamic>?;

    // Parse the scheduled_task_workers join rows. Each row nests a worker.
    final joinRows = json['scheduled_task_workers'] as List?;
    final assigned = <AssignedWorker>[];
    if (joinRows != null) {
      for (final r in joinRows) {
        final m = r as Map<String, dynamic>;
        final w = m['workers'] as Map<String, dynamic>?;
        final id = m['worker_id'] as String?;
        if (id == null) continue;
        assigned.add(AssignedWorker(
          id: id,
          firstName: w?['first_name'] as String?,
          lastName: w?['last_name'] as String?,
          profession: w?['profession'] as String?,
        ));
      }
    }

    return ScheduledTask(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      chantierId: json['chantier_id'] as String,
      chantierTaskId: json['chantier_task_id'] as String?,
      quoteTaskId: json['quote_task_id'] as String?,
      workerId: json['worker_id'] as String,
      title: json['title'] as String,
      notes: json['notes'] as String?,
      scheduledDate: DateTime.parse(json['scheduled_date'] as String),
      startTime: _normaliseTime(json['start_time'] as String),
      durationMinutes: (json['duration_minutes'] as num).toInt(),
      endDateExplicit: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      endTimeExplicit: json['end_time'] != null
          ? _normaliseTime(json['end_time'] as String)
          : null,
      status: json['status'] as String? ?? 'À faire',
      workerFirstName: worker?['first_name'] as String?,
      workerLastName: worker?['last_name'] as String?,
      workerProfession: worker?['profession'] as String?,
      chantierReference: chantier?['reference'] as String?,
      chantierCity: chantier?['city'] as String?,
      assignedWorkers: assigned,
    );
  }

  /// Postgres TIME can come back as "HH:mm:ss" — we only keep "HH:mm".
  static String _normaliseTime(String raw) {
    final parts = raw.split(':');
    if (parts.length < 2) return raw;
    return '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')}';
  }

  Map<String, dynamic> toInsertJson() {
    return {
      'user_id': userId,
      'chantier_id': chantierId,
      if (chantierTaskId != null) 'chantier_task_id': chantierTaskId,
      if (quoteTaskId != null) 'quote_task_id': quoteTaskId,
      'worker_id': workerId,
      'title': title,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
      'scheduled_date':
          '${scheduledDate.year.toString().padLeft(4, '0')}-${scheduledDate.month.toString().padLeft(2, '0')}-${scheduledDate.day.toString().padLeft(2, '0')}',
      'start_time': startTime,
      'duration_minutes': durationMinutes,
      if (endDateExplicit != null)
        'end_date':
            '${endDateExplicit!.year.toString().padLeft(4, '0')}-${endDateExplicit!.month.toString().padLeft(2, '0')}-${endDateExplicit!.day.toString().padLeft(2, '0')}',
      if (endTimeExplicit != null && endTimeExplicit!.isNotEmpty)
        'end_time': endTimeExplicit,
      'status': status,
    };
  }

  ScheduledTask copyWith({
    String? title,
    String? notes,
    DateTime? scheduledDate,
    String? startTime,
    int? durationMinutes,
    DateTime? endDateExplicit,
    String? endTimeExplicit,
    String? status,
    String? workerId,
    String? chantierId,
    String? chantierTaskId,
    String? quoteTaskId,
    List<AssignedWorker>? assignedWorkers,
  }) {
    return ScheduledTask(
      id: id,
      userId: userId,
      chantierId: chantierId ?? this.chantierId,
      chantierTaskId: chantierTaskId ?? this.chantierTaskId,
      quoteTaskId: quoteTaskId ?? this.quoteTaskId,
      workerId: workerId ?? this.workerId,
      title: title ?? this.title,
      notes: notes ?? this.notes,
      scheduledDate: scheduledDate ?? this.scheduledDate,
      startTime: startTime ?? this.startTime,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      endDateExplicit: endDateExplicit ?? this.endDateExplicit,
      endTimeExplicit: endTimeExplicit ?? this.endTimeExplicit,
      status: status ?? this.status,
      workerFirstName: workerFirstName,
      workerLastName: workerLastName,
      workerProfession: workerProfession,
      chantierReference: chantierReference,
      chantierCity: chantierCity,
      assignedWorkers: assignedWorkers ?? this.assignedWorkers,
    );
  }
}

/// One worker assigned to a [ScheduledTask], read from the
/// scheduled_task_workers join table (or derived from the legacy single worker).
class AssignedWorker {
  final String id;
  final String? firstName;
  final String? lastName;
  final String? profession;

  const AssignedWorker({
    required this.id,
    this.firstName,
    this.lastName,
    this.profession,
  });

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();
}

/// Standard duration options shown in the scheduling UI.
class ScheduleDuration {
  static const options = <({String label, int minutes})>[
    (label: '30 min', minutes: 30),
    (label: '1h', minutes: 60),
    (label: '2h', minutes: 120),
    (label: '½ journée', minutes: 240),
    (label: 'Journée', minutes: 480),
  ];

  static String labelFor(int minutes) {
    for (final o in options) {
      if (o.minutes == minutes) return o.label;
    }
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '${m}min';
    if (m == 0) return '${h}h';
    return '${h}h${m.toString().padLeft(2, '0')}';
  }
}
