import 'package:flutter/material.dart';

/// Month-view calendar picker used in the scheduling flows
/// (AjouterRdvScreen + ScheduleTaskScreen). Stateless — caller owns the
/// selected date and month.
class CalendarMonthPicker extends StatelessWidget {
  final DateTime currentMonth;
  final DateTime selectedDate;
  final ValueChanged<DateTime> onDateSelected;
  final ValueChanged<DateTime> onMonthChanged;
  final Color darkNavy;

  const CalendarMonthPicker({
    super.key,
    required this.currentMonth,
    required this.selectedDate,
    required this.onDateSelected,
    required this.onMonthChanged,
    this.darkNavy = const Color(0xFF0A1227),
  });

  static const _monthNames = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  @override
  Widget build(BuildContext context) {
    final dayHeaders = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    final firstDay = DateTime(currentMonth.year, currentMonth.month, 1);
    final lastDay = DateTime(currentMonth.year, currentMonth.month + 1, 0);
    final startWeekday = firstDay.weekday;
    final today = DateTime.now();

    final cells = <Widget>[];

    for (final d in dayHeaders) {
      cells.add(Center(
        child: Text(
          d,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFF8B95A5),
            letterSpacing: 0.5,
          ),
        ),
      ));
    }

    final prevEnd = DateTime(currentMonth.year, currentMonth.month, 0).day;
    for (int i = startWeekday - 1; i > 0; i--) {
      cells.add(Center(
        child: Text(
          "${prevEnd - i + 1}",
          style: TextStyle(
            fontSize: 14,
            color: const Color(0xFF8B95A5).withValues(alpha: 0.35),
          ),
        ),
      ));
    }

    for (int day = 1; day <= lastDay.day; day++) {
      final isToday = today.day == day &&
          today.month == currentMonth.month &&
          today.year == currentMonth.year;
      final isSelected = selectedDate.day == day &&
          selectedDate.month == currentMonth.month &&
          selectedDate.year == currentMonth.year;

      cells.add(GestureDetector(
        onTap: () => onDateSelected(
            DateTime(currentMonth.year, currentMonth.month, day)),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF2E65F3) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                "$day",
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isSelected
                      ? Colors.white
                      : isToday
                          ? const Color(0xFF2E65F3)
                          : darkNavy,
                ),
              ),
              if (isToday && !isSelected)
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2E65F3),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ));
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    "${_monthNames[currentMonth.month]} ${currentMonth.year}",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.calendar_month, size: 18, color: darkNavy),
                ],
              ),
              Row(
                children: [
                  GestureDetector(
                    onTap: () => onMonthChanged(
                        DateTime(currentMonth.year, currentMonth.month - 1)),
                    child: Icon(Icons.chevron_left, color: darkNavy, size: 22),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => onMonthChanged(
                        DateTime(currentMonth.year, currentMonth.month + 1)),
                    child: Icon(Icons.chevron_right, color: darkNavy, size: 22),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 7,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            childAspectRatio: 1.0,
            children: cells,
          ),
        ],
      ),
    );
  }
}
