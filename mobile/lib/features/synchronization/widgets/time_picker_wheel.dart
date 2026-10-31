import 'package:flutter/material.dart';

/// 24-hour wheel-like time picker (hours + minutes, 5-minute steps).
/// Stateless — caller owns the hour/minute state.
class TimePickerWheel extends StatelessWidget {
  final int hour;
  final int minute;
  final ValueChanged<int> onHourChanged;
  final ValueChanged<int> onMinuteChanged;
  final Color darkNavy;

  const TimePickerWheel({
    super.key,
    required this.hour,
    required this.minute,
    required this.onHourChanged,
    required this.onMinuteChanged,
    this.darkNavy = const Color(0xFF0A1227),
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _column(
            current: hour,
            step: 1,
            modulo: 24,
            onChanged: onHourChanged,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              ":",
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.w700,
                color: darkNavy,
              ),
            ),
          ),
          _column(
            current: minute,
            step: 5,
            modulo: 60,
            onChanged: onMinuteChanged,
          ),
        ],
      ),
    );
  }

  Widget _column({
    required int current,
    required int step,
    required int modulo,
    required ValueChanged<int> onChanged,
  }) {
    final next = (current + step) % modulo;
    final prev = (current - step + modulo) % modulo;
    return Column(
      children: [
        GestureDetector(
          onTap: () => onChanged(next),
          child: Text(
            next.toString().padLeft(2, '0'),
            style: TextStyle(
              fontSize: 16,
              color: const Color(0xFF2E65F3).withValues(alpha: 0.5),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          current.toString().padLeft(2, '0'),
          style: TextStyle(
            fontSize: 42,
            fontWeight: FontWeight.w700,
            color: darkNavy,
          ),
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: () => onChanged(prev),
          child: Text(
            prev.toString().padLeft(2, '0'),
            style: TextStyle(
              fontSize: 16,
              color: const Color(0xFF2E65F3).withValues(alpha: 0.5),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
