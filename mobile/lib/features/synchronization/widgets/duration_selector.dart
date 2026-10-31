import 'package:flutter/material.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';

/// Chip row for picking a task duration.
/// Value is expressed in minutes; labels come from [ScheduleDuration.options].
class DurationSelector extends StatelessWidget {
  final int selectedMinutes;
  final ValueChanged<int> onChanged;
  final Color darkNavy;

  const DurationSelector({
    super.key,
    required this.selectedMinutes,
    required this.onChanged,
    this.darkNavy = const Color(0xFF0A1227),
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: ScheduleDuration.options.map((o) {
        final isSelected = selectedMinutes == o.minutes;
        return GestureDetector(
          onTap: () => onChanged(o.minutes),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF2E65F3) : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: isSelected
                  ? null
                  : Border.all(color: const Color(0xFFE0E7FF)),
            ),
            child: Text(
              o.label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : darkNavy,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
