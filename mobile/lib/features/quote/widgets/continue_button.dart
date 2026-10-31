import 'package:flutter/material.dart';
import 'package:koji/core/theme.dart';

/// Continue button with count
/// STATELESS for performance (not const due to nullable onPressed)
class ContinueButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final int count;
  final String label;

  const ContinueButton({
    super.key,
    required this.onPressed,
    required this.count,
    this.label = 'Continuer',
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.darkNavy,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppTheme.darkNavy.withValues(alpha: 0.5),
        padding: const EdgeInsets.symmetric(vertical: 20),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 0,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$label ($count sélectionnés)',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.arrow_forward, size: 20),
        ],
      ),
    );
  }
}
