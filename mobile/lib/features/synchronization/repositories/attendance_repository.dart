import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/synchronization/models/attendance_entry.dart';

/// CRUD + weekly summary for the day-level attendance ledger. Flutter-native
/// table — see koji-main/supabase/migrations/0005_attendance.sql.
class AttendanceRepository {
  AttendanceRepository(this._client);

  final SupabaseClient _client;

  String get _userId => _client.auth.currentUser!.id;

  Future<List<AttendanceEntry>> getForWorker(
    String workerId, {
    DateTime? from,
    DateTime? to,
  }) async {
    var query = _client
        .from('attendance_entries')
        .select()
        .eq('worker_id', workerId);
    if (from != null) {
      query = query.gte('date', from.toIso8601String().split('T').first);
    }
    if (to != null) {
      query = query.lte('date', to.toIso8601String().split('T').first);
    }
    final rows = await query.order('date', ascending: false);
    return (rows as List)
        .map((e) => AttendanceEntry.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  Future<AttendanceEntry> addEntry(AttendanceEntry entry) async {
    final inserted = await _client
        .from('attendance_entries')
        .insert({...entry.toInsertMap(), 'user_id': _userId})
        .select()
        .single();
    return AttendanceEntry.fromMap(inserted);
  }

  Future<void> deleteEntry(String id) async {
    await _client.from('attendance_entries').delete().eq('id', id);
  }

  /// Worked-vs-contracted summary for [workerId] over the ISO week containing
  /// [anyDayInWeek]. Ports web's weeklyAttendanceSummary/isoWeekInfo logic.
  Future<WeeklyAttendanceSummary> weeklySummary({
    required String workerId,
    required double contractedHours,
    DateTime? anyDayInWeek,
  }) async {
    final ref = anyDayInWeek ?? DateTime.now();
    final weekStart = _mondayOf(ref);
    final weekEnd = weekStart.add(const Duration(days: 6));

    final entries =
        await getForWorker(workerId, from: weekStart, to: weekEnd);

    final workedMinutes = entries.fold<int>(0, (sum, e) => sum + e.durationMinutes);

    return WeeklyAttendanceSummary(
      weekStart: weekStart,
      weekEnd: weekEnd,
      workedMinutes: workedMinutes,
      contractedHours: contractedHours,
      entries: entries,
    );
  }

  static DateTime _mondayOf(DateTime date) {
    final d = DateTime(date.year, date.month, date.day);
    // DateTime.weekday: Monday = 1 ... Sunday = 7
    return d.subtract(Duration(days: d.weekday - 1));
  }
}

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(Supabase.instance.client);
});
