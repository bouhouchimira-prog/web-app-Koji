import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class NouveauContactScreen extends StatefulWidget {
  const NouveauContactScreen({super.key});

  @override
  State<NouveauContactScreen> createState() => _NouveauContactScreenState();
}

class _NouveauContactScreenState extends State<NouveauContactScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _roleController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _roleController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nom et téléphone sont requis.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final parts = name.split(' ');
      final firstName = parts.first;
      final lastName = parts.length > 1 ? parts.sublist(1).join(' ') : '';

      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId == null) throw Exception("User not authenticated");

      await Supabase.instance.client.from('workers').insert({
        'user_id': userId,
        'first_name': firstName,
        'last_name': lastName,
        'phone': phone,
        'profession': _roleController.text.trim().isNotEmpty
            ? _roleController.text.trim()
            : 'Non spécifié',
        'contact_type': 'Ouvrier',
        'status': 'Disponible',
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Contact ajouté avec succès!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        context.pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
        setState(() => _isSubmitting = false);
      }
    }
  }

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
            child: Column(
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24.0, vertical: 20.0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => context.pop(),
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: darkNavy.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.chevron_left,
                              color: darkNavy, size: 28),
                        ),
                      ),
                      const Expanded(
                        child: Text(
                          "Nouveau Contact Rapide",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: darkNavy,
                          ),
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                ),

                // Form
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 16),

                        // Avatar icon
                        Center(
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE3EDFF),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.person_add_outlined,
                              color: Color(0xFF2E65F3),
                              size: 36,
                            ),
                          ),
                        ),

                        const SizedBox(height: 32),

                        // Nom complet
                        _buildLabel("Nom complet", required: true),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _nameController,
                          hint: "Ex: Jean Dupont",
                        ),

                        const SizedBox(height: 24),

                        // Téléphone
                        _buildLabel("Téléphone", required: true),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _phoneController,
                          hint: "06 12 34 56 78",
                          prefixIcon: Icons.phone_outlined,
                          keyboardType: TextInputType.phone,
                        ),

                        const SizedBox(height: 24),

                        // Rôle / Entreprise
                        _buildLabel("Rôle / Entreprise (Optionnel)"),
                        const SizedBox(height: 8),
                        _buildTextField(
                          controller: _roleController,
                          hint: "Ex: Plomberie SARL",
                        ),

                        const SizedBox(height: 32),

                        // Info box
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE3EDFF).withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.info_outline,
                                  color: Color(0xFF2E65F3), size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  "Ce contact sera ajouté à votre carnet d'adresses Kôji et pourra être invité sur vos chantiers immédiatement.",
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: const Color(0xFF2E65F3).withValues(alpha: 0.8),
                                    height: 1.4,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Bottom Button
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(
                  left: 24.0, right: 24.0, bottom: 32.0),
              child: SizedBox(
                height: 56,
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: darkNavy,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: _isSubmitting
                      ? SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            color: Theme.of(context).colorScheme.surface,
                            strokeWidth: 2,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.person_add_alt_1_outlined,
                                color: Theme.of(context).colorScheme.surface, size: 20),
                            SizedBox(width: 12),
                            Text(
                              "Ajouter le contact",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Theme.of(context).colorScheme.surface,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text, {bool required = false}) {
    return RichText(
      text: TextSpan(
        text: text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Color(0xFF0A1227),
        ),
        children: required
            ? [
                const TextSpan(
                  text: " *",
                  style: TextStyle(color: Color(0xFFEF4444)),
                ),
              ]
            : null,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    IconData? prefixIcon,
    TextInputType? keyboardType,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: Color(0xFF0A1227),
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: const Color(0xFF8B95A5).withValues(alpha: 0.6),
            fontWeight: FontWeight.w400,
          ),
          border: InputBorder.none,
          prefixIcon: prefixIcon != null
              ? Icon(prefixIcon,
                  color: const Color(0xFF8B95A5), size: 20)
              : null,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }
}
