import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Room card widget for selection
/// STATELESS & CONST for performance
class RoomCard extends StatelessWidget {
  final String id;
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const RoomCard({
    super.key,
    required this.id,
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0F3460) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  color: isSelected ? Colors.white : AppTheme.darkNavy,
                  size: 32,
                ),
                const Spacer(),
                Text(
                  label,
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.darkNavy,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            if (isSelected)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface, shape: BoxShape.circle),
                  child: const Center(
                    child:
                        Icon(Icons.check, size: 16, color: AppTheme.darkNavy),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
