import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Photo icon circle
/// STATELESS & CONST for performance
class PhotoIconCircle extends StatelessWidget {
  final IconData icon;
  final double size;

  const PhotoIconCircle({
    super.key,
    this.icon = Icons.add_photo_alternate_outlined,
    this.size = 120,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: AppTheme.darkNavy,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: Theme.of(context).colorScheme.surface,
          size: size * 0.47, // Proportional icon size
        ),
      ),
    );
  }
}
