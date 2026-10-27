import 'package:flutter/material.dart';

/// Submit/Continue button widget
/// STATELESS & CONST for performance
class SubmitButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool showIcon;
  final Color? backgroundColor;
  final Color? foregroundColor;

  const SubmitButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.showIcon = true,
    this.backgroundColor,
    this.foregroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: backgroundColor ?? const Color(0xFFE5D5C6),
        foregroundColor: foregroundColor ?? const Color(0xFF1E3A8A),
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (showIcon) ...[
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward, size: 20),
          ],
        ],
      ),
    );
  }
}
