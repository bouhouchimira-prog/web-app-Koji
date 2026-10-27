import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/models/attendance_entry.dart';
import 'package:koji/features/synchronization/repositories/attendance_repository.dart';

class WeeklyAttendanceParams {
  final Worker worker;
  final DateTime anyDayInWeek;

  const WeeklyAttendanceParams(this.worker, this.anyDayInWeek);

  @override
  bool operator ==(Object other) =>
      other is WeeklyAttendanceParams &&
      other.worker.id == worker.id &&
      other.anyDayInWeek.year == anyDayInWeek.year &&
      other.anyDayInWeek.month == anyDayInWeek.month &&
      other.anyDayInWeek.day == anyDayInWeek.day;

  @override
  int get hashCode => Object.hash(worker.id, anyDayInWeek.year,
      anyDayInWeek.month, anyDayInWeek.day);
}

final weeklyAttendanceProvider = FutureProvider.family<WeeklyAttendanceSummary,
    WeeklyAttendanceParams>((ref, params) {
  return ref.read(attendanceRepositoryProvider).weeklySummary(
        workerId: params.worker.id,
        contractedHours: params.worker.weeklyContractHours,
        anyDayInWeek: params.anyDayInWeek,
      );
});
