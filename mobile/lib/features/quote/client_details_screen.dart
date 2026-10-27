import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/responsive_helper.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';

class ClientDetailsScreen extends ConsumerStatefulWidget {
  const ClientDetailsScreen({super.key});

  @override
  ConsumerState<ClientDetailsScreen> createState() =>
      _ClientDetailsScreenState();
}

class _ClientDetailsScreenState extends ConsumerState<ClientDetailsScreen> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      // Build a typed ClientInfo instead of a raw Map
      final clientInfo = ClientInfo(
        name: _nameController.text,
        email: _emailController.text,
        phone: _phoneController.text,
        address: _addressController.text,
      );

      ref.read(quoteCreationProvider.notifier).updateClientInfo(clientInfo);

      // Navigate to next step
      context.push('/quote/room-selection', extra: <String>[]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final responsive = context.responsive;

    return Scaffold(
      backgroundColor:
          const Color(0xFFF8F9FA), // Cream/White background from image
      appBar: AppBar(
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
            onPressed: () => context.pop(),
          ),
        ),
        centerTitle: true,
        title: Column(
          children: [
            Text(
              'Détails Client',
              style: AppTheme.headingStyle(context).copyWith(
                fontSize: 18,
                color: const Color(0xFF1E3A8A), // Dark blue
              ),
            ),
            
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.arrow_forward_ios,
                color: Colors.grey, size: 16),
            onPressed: () {}, // Optional helper
          )
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            padding: EdgeInsets.all(responsive.width(5)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Icon
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F172A), // Dark Navy
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.person_add_alt_1_outlined,
                      color: Theme.of(context).colorScheme.surface,
                      size: 32,
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Title
                Text(
                  'Informations',
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
                  'Renseignez les coordonnées du client avant de procéder à l\'état des lieux',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textLight,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 32),

                // Fields
                _buildLabel('Nom du client'),
                _buildTextField(
                  controller: _nameController,
                  hint: 'Rajouter votre texte...',
                  validator: (v) => v?.isEmpty == true ? 'Requis' : null,
                ),

                const SizedBox(height: 16),

                _buildLabel('Adresse e-mail'),
                _buildTextField(
                  controller: _emailController,
                  hint: 'Rajouter votre texte...',
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v?.isNotEmpty == true && !v!.contains('@')
                      ? 'Email invalide'
                      : null,
                ),

                const SizedBox(height: 16),

                _buildLabel('Numéro de téléphone'),
                _buildTextField(
                  controller: _phoneController,
                  hint: 'Rajouter votre texte...',
                  keyboardType: TextInputType.phone,
                ),

                const SizedBox(height: 16),

                _buildLabel('Adresse complète'),
                _buildTextField(
                  controller: _addressController,
                  hint: 'Rajouter votre texte...',
                ),

                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        const Color(0xFF1E3A8A), // Beige/Gold from image
                    foregroundColor:
                        const Color.fromARGB(255, 237, 237, 238), // Dark text
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
                        'Suivant',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward, size: 20),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: const Color(0xFF1F2937),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator,
      cursorColor: const Color(0xFF1E3A8A),
      style: const TextStyle( color: Color(0xFF1F2937)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle( color: Colors.grey[400]),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF1E3A8A)),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }
}
