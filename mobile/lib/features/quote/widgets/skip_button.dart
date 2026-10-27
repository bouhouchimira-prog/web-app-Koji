import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Skip button widget
/// STATELESS & CONST for performance
class SkipButton extends StatelessWidget {
  final VoidCallback onPressed;
  final String label;

  const SkipButton({
    super.key,
    required this.onPressed,
    this.label = 'Passer',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton(
        onPressed: onPressed,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 16,
            color: AppTheme.darkNavy,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.underline,
          ),
        ),
      ),
    );
  }
}
