import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Bottom navigation item widget
/// STATELESS & CONST for performance
class BottomNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color? activeColor;

  const BottomNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.isActive,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? Colors.white : AppTheme.darkNavy);
    final inactiveColor = isDark ? Colors.grey[600] : AppTheme.textLight;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          color: isActive ? effectiveActiveColor : inactiveColor,
          size: 26,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            color: isActive ? effectiveActiveColor : inactiveColor,
          ),
        ),
        if (isActive)
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              color: effectiveActiveColor,
              shape: BoxShape.circle,
            ),
          ),
      ],
    );
  }
}
