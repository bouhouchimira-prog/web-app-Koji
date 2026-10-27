import 'package:flutter/material.dart';

/// Section divider with text
/// STATELESS & CONST for performance
class SectionDivider extends StatelessWidget {
  final String text;

  const SectionDivider({
    super.key,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            text,
            style: TextStyle(
              color: const Color(0xFF9CA3AF),
              fontSize: 14,
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
      ],
    );
  }
}
