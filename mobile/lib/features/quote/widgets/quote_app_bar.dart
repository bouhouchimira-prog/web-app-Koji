import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Reusable app bar for quote screens
/// STATELESS & CONST for performance
class QuoteAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? stepText;
  final VoidCallback? onBack;
  final bool showHelp;

  const QuoteAppBar({
    super.key,
    required this.title,
    this.stepText,
    this.onBack,
    this.showHelp = false,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: AppTheme.darkNavy, size: 16),
          onPressed: onBack ?? () => Navigator.of(context).pop(),
        ),
      ),
      centerTitle: true,
      title: Column(
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1E3A8A),
            ),
          ),
          if (stepText != null)
            Text(
              stepText!,
              style: TextStyle(
                fontSize: 12,
                color: AppTheme.textLight,
              ),
            ),
        ],
      ),
      actions: showHelp
          ? [
              IconButton(
                icon: const Icon(Icons.arrow_forward_ios,
                    color: Colors.grey, size: 16),
                onPressed: () {},
              )
            ]
          : null,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
