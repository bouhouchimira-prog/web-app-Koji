import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Shown right after a client signs a devis. Confirms the signature and routes
/// back into the client space — the signed devis now appears under Documents.
class SignatureSuccessScreen extends StatelessWidget {
  const SignatureSuccessScreen({super.key});

  static const _darkNavy = Color(0xFF0F172A);
  static const _green = Color(0xFF10B981);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              // Success badge
              Center(
                child: Container(
                  width: 110,
                  height: 110,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFFECFDF5),
                  ),
                  child: const Icon(Icons.verified_rounded,
                      size: 64, color: _green),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'Devis signé !',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: _darkNavy),
              ),
              const SizedBox(height: 10),
              const Text(
                'Votre signature a bien été enregistrée.\n'
                'Votre artisan en est informé et vous retrouverez\n'
                'le document signé dans « Mes Documents ».',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 14, color: Color(0xFF64748B), height: 1.5),
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock_outline, color: Color(0xFF1D74FF), size: 20),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Signature électronique sécurisée, à valeur '
                        'juridique (art. 1367 du Code civil).',
                        style: TextStyle(
                            fontSize: 12, color: Color(0xFF1D74FF), height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: () => context.go('/client-home'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _darkNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Text('Retour à l\'accueil',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
