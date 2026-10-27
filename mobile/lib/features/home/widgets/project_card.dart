import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Project card widget displaying client project information
/// STATELESS & CONST for performance
class ProjectCard extends StatelessWidget {
  final String clientName;
  final String projectType;
  final String status;
  final double progress;
  final Color statusColor;
  final Color statusTextColor;
  final Color progressBarColor;

  const ProjectCard({
    super.key,
    required this.clientName,
    required this.projectType,
    required this.status,
    required this.progress,
    required this.statusColor,
    required this.statusTextColor,
    this.progressBarColor = AppTheme.primaryBlue,
  });

  @override
  Widget build(BuildContext context) {
    // RepaintBoundary to prevent unnecessary repaints
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RepaintBoundary(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  clientName,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppTheme.darkNavy,
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: statusTextColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              projectType,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.grey[400] : AppTheme.textLight,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Progress',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[400] : AppTheme.textLight,
                  ),
                ),
                Text(
                  '${(progress * 100).toInt()}%',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : AppTheme.darkNavy,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor:
                    isDark ? Colors.grey[800] : const Color(0xFFF3F4F6),
                valueColor: AlwaysStoppedAnimation<Color>(progressBarColor),
                minHeight: 6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
