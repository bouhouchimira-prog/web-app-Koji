/// A single attendance/clock entry for a worker — day-level ledger, distinct
/// from the worker portal's task-level pointage (start/pause/resume/end).
/// Mirrors web's attendanceEntries shape (lib/worker-portal.js).
class AttendanceEntry {
  final String id;
  final String userId;
  final String workerId;
  final String? projectId;
  final String type; // heures | jour | forfait | ouvrage | passage | deplacement
  final DateTime date;
  final String? startTime; // 'HH:MM'
  final String? endTime;
  final int durationMinutes;
  final double amount;
  final String? label;
  final String? note;
  final String source; // 'company' | 'worker'
  final DateTime createdAt;

  const AttendanceEntry({
    required this.id,
    required this.userId,
    required this.workerId,
    this.projectId,
    required this.type,
    required this.date,
    this.startTime,
    this.endTime,
    this.durationMinutes = 0,
    this.amount = 0,
    this.label,
    this.note,
    this.source = 'company',
    required this.createdAt,
  });

  factory AttendanceEntry.fromMap(Map<String, dynamic> map) {
    return AttendanceEntry(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      workerId: map['worker_id'] as String,
      projectId: map['project_id'] as String?,
      type: (map['type'] as String?) ?? AttendanceType.jour,
      date: DateTime.parse(map['date'] as String),
      startTime: map['start_time'] as String?,
      endTime: map['end_time'] as String?,
      durationMinutes: (map['duration_minutes'] as num?)?.toInt() ?? 0,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      label: map['label'] as String?,
      note: map['note'] as String?,
      source: (map['source'] as String?) ?? 'company',
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  Map<String, dynamic> toInsertMap() {
    return {
      'worker_id': workerId,
      if (projectId != null) 'project_id': projectId,
      'type': type,
      'date': date.toIso8601String().split('T').first,
      if (startTime != null) 'start_time': startTime,
      if (endTime != null) 'end_time': endTime,
      'duration_minutes': durationMinutes,
      'amount': amount,
      if (label != null) 'label': label,
      if (note != null) 'note': note,
    };
  }

  /// Computes duration in minutes from 'HH:MM' start/end strings — mirrors
  /// web's durationFromTimes helper. Handles overnight ranges (end < start).
  static int durationFromTimes(String start, String end) {
    final s = _parseHHMM(start);
    final e = _parseHHMM(end);
    if (s == null || e == null) return 0;
    var diff = e - s;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  static int? _parseHHMM(String value) {
    final parts = value.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return h * 60 + m;
  }
}

abstract class AttendanceType {
  static const heures = 'heures';
  static const jour = 'jour';
  static const forfait = 'forfait';
  static const ouvrage = 'ouvrage';
  static const passage = 'passage';
  static const deplacement = 'deplacement';

  static const values = [heures, jour, forfait, ouvrage, passage, deplacement];

  static String label(String value) => switch (value) {
        heures => 'Heures (plage horaire)',
        jour => 'Journée',
        forfait => 'Forfait',
        ouvrage => 'Ouvrage',
        passage => 'Passage',
        deplacement => 'Déplacement',
        _ => value,
      };
}

/// Worked-vs-contracted summary for one worker over an ISO week.
class WeeklyAttendanceSummary {
  final DateTime weekStart; // Monday
  final DateTime weekEnd; // Sunday
  final int workedMinutes;
  final double contractedHours;
  final List<AttendanceEntry> entries;

  const WeeklyAttendanceSummary({
    required this.weekStart,
    required this.weekEnd,
    required this.workedMinutes,
    required this.contractedHours,
    required this.entries,
  });

  double get workedHours => workedMinutes / 60.0;
  double get diffHours => workedHours - contractedHours;
  bool get isOver => diffHours > 0.01;
  bool get isUnder => diffHours < -0.01;
}
