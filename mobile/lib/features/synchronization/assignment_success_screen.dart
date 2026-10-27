import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AssignmentSuccessScreen extends StatelessWidget {
  const AssignmentSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    return Scaffold(
      backgroundColor: appBg,
      body: Stack(
        children: [
          // Background Gradient
          Positioned(
            top: -50,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withValues(alpha: 0.6),
                    const Color(0xFFFBE4D2).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  const Spacer(flex: 2),

                  // Success Icon
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE3EDFF),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: const BoxDecoration(
                          color: Color(0xFF2E65F3),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.check,
                            color: Theme.of(context).colorScheme.surface, size: 44),
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),

                  // Title
                  const Text(
                    "Affectation Confirmée!",
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Subtitle
                  Text(
                    "Les artisans ont été notifiés par SMS\net sur leur application",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[400],
                      height: 1.5,
                    ),
                  ),

                  const Spacer(flex: 3),

                  // Voir le planning button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        context.go('/planning');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: darkNavy,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            "Voir le planning",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.surface,
                            ),
                          ),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward,
                              color: Theme.of(context).colorScheme.surface, size: 20),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Retour à l'accueil
                  TextButton(
                    onPressed: () => context.go('/home'),
                    child: const Text(
                      "Retour à l'accueil",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: darkNavy,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
