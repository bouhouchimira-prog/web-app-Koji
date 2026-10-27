import 'package:flutter/material.dart';

/// Form header with icon, title, and description
/// STATELESS & CONST for performance
class ClientFormHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const ClientFormHeader({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Icon
        Center(
          child: Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: Theme.of(context).colorScheme.surface,
              size: 32,
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Title
        Text(
          title,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF1E3A8A),
          ),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: 8),

        // Description
        Text(
          description,
          style: TextStyle(
            fontSize: 14,
            color: const Color(0xFF6B7280),
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
