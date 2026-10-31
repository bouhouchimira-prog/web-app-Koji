import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Helper for Grid Items
class HomeMenuGrid extends StatelessWidget {
  const HomeMenuGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: 0.9,
      padding: EdgeInsets.zero,
      children: [
        _buildItem(context, "Mes Chantiers", Icons.home_filled,
            const Color(0xFF1D74FF)),
        _buildItem(context, "Fournitures", Icons.build, const Color(0xFF1D74FF),
            onTap: () => context.push('/fournitures')),
        _buildItem(
            context, "Historique", Icons.map_outlined, const Color(0xFF1D74FF)),
        _buildItem(
            context, "Signature", Icons.draw_outlined, const Color(0xFF1D74FF),
            onTap: () => context.push('/signature')),
        _buildItem(context, "Calendrier", Icons.calendar_today,
            const Color(0xFF1D74FF)),
        _buildItem(context, "Synchronisation", Icons.group_outlined,
            const Color(0xFF1D74FF),
            onTap: () => context.push('/synchronization')),
        _buildItem(context, "Facturation", Icons.receipt_long_outlined,
            const Color(0xFF1D74FF),
            onTap: () => context.push('/facturation')),
      ],
    );
  }

  Widget _buildItem(
      BuildContext context, String title, IconData icon, Color mainColor,
      {VoidCallback? onTap}) {
    return HomeGridItem(
      title: title,
      icon: icon,
      mainColor: mainColor,
      onTap: onTap ?? () {},
    );
  }
}

class HomeGridItem extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color mainColor;
  final VoidCallback onTap;

  const HomeGridItem({
    super.key,
    required this.title,
    required this.icon,
    required this.mainColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                // Decorative blurry circle
                if (!isDark)
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: mainColor.withValues(alpha: 0.05), // Very subtle
                    ),
                  ),
                // Icon with subtle depth
                Icon(icon,
                    color: isDark
                        ? Colors.white
                        : const Color(0xFF0F3995), // Deep Blue Icon
                    size: 32),
                // Add a small "gloss" or secondary icon if needed for specific items (like "Calendrier" having a date)
                if (title == "Calendrier")
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text("31",
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isDark
                                ? Colors.white
                                : const Color(0xFF0F3995))),
                  )
              ],
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                title,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.9)
                      : const Color(0xFF0F3995),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
