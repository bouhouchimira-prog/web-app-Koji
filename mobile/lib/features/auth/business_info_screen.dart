import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/core/responsive_helper.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';

class BusinessInfoScreen extends ConsumerStatefulWidget {
  const BusinessInfoScreen({super.key});

  @override
  ConsumerState<BusinessInfoScreen> createState() => _BusinessInfoScreenState();
}

class _BusinessInfoScreenState extends ConsumerState<BusinessInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _raisonSocialeController = TextEditingController();
  final _formeJuridiqueController = TextEditingController();
  final _siretController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _tvaController = TextEditingController();

  File? _imageFile;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _imageFile = File(image.path);
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _loadBusinessInfo();
  }

  Future<void> _loadBusinessInfo() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;

    // Check if we need to load data (only if all fields are empty)
    if (_raisonSocialeController.text.isNotEmpty) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final userData = await ref.read(userRepositoryProvider).getUser(user.id);
      if (userData != null && userData['business_info'] != null) {
        final info = userData['business_info'] as Map<String, dynamic>;

        setState(() {
          _raisonSocialeController.text = info['raisonSociale'] ?? '';
          _formeJuridiqueController.text = info['formeJuridique'] ?? '';
          _siretController.text = info['siret'] ?? '';
          _emailController.text = info['emailPro'] ?? '';
          _phoneController.text = info['phone'] ?? '';
          _addressController.text = info['address'] ?? '';
          _tvaController.text = info['tva'] ?? '';
        });
      }
    } catch (e) {
      debugPrint('Error loading business info: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  bool _isLoading = false;

  @override
  void dispose() {
    _raisonSocialeController.dispose();
    _formeJuridiqueController.dispose();
    _siretController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _tvaController.dispose();
    super.dispose();
  }

  bool get _isFormValid {
    return _raisonSocialeController.text.isNotEmpty &&
        _formeJuridiqueController.text.isNotEmpty &&
        _siretController.text.isNotEmpty &&
        _emailController.text.isNotEmpty &&
        _phoneController.text.isNotEmpty &&
        _addressController.text.isNotEmpty &&
        _tvaController.text.isNotEmpty;
  }

  void _handleSkip() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(userRepositoryProvider).markBusinessInfoSkipped(user.id);
      if (mounted) context.go('/profession-selection');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleSubmit() async {
    final user = ref.read(authProvider).value;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erreur: Utilisateur non connecté')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Upload logo to Supabase Storage if exists
      String? logoUrl;
      if (_imageFile != null) {
        logoUrl = await ref.read(userRepositoryProvider).uploadBusinessLogo(
              user.id,
              _imageFile!.path,
            );
      }

      // Update business info with logo URL
      await ref.read(userRepositoryProvider).updateBusinessInfo(
            uid: user.id,
            raisonSociale: _raisonSocialeController.text.trim(),
            formeJuridique: _formeJuridiqueController.text.trim(),
            siret: _siretController.text.trim(),
            emailPro: _emailController.text.trim(),
            phone: _phoneController.text.trim(),
            address: _addressController.text.trim(),
            tva: _tvaController.text.trim(),
            logoUrl: logoUrl,
          );

      if (mounted) {
        context.go('/profession-selection');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur lors de l\'enregistrement: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final responsive = context.responsive;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.darkNavy),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),

                // Logo
                Center(
                  child: Text(
                    'K Ô J I',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 6,
                      color: AppTheme.darkNavy,
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Title
              

                // Photo Upload Circle
                Center(
                  child: GestureDetector(
                    onTap: _pickImage,
                    child: Stack(
                      children: [
                        Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppTheme.darkNavy,
                              width: 2,
                            ),
                            color: Theme.of(context).colorScheme.surface,
                            image: _imageFile != null
                                ? DecorationImage(
                                    image: FileImage(_imageFile!),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          child: _imageFile == null
                              ? const Icon(
                                  Icons.add_photo_alternate_outlined,
                                  size: 40,
                                  color: AppTheme.darkNavy,
                                )
                              : null,
                        ),
                        if (_imageFile == null)
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppTheme.darkNavy,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
                              ),
                              child: Icon(
                                Icons.add,
                                color: Theme.of(context).colorScheme.surface,
                                size: 18,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Raison sociale
                _buildTextField(
                  controller: _raisonSocialeController,
                  label: 'Raison sociale',
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // Forme juridique
                _buildTextField(
                  controller: _formeJuridiqueController,
                  label: 'Forme juridique',
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // Numéro SIRET
                _buildTextField(
                  controller: _siretController,
                  label: 'Numéro SIRET',
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // Email professionnel
                _buildTextField(
                  controller: _emailController,
                  label: 'Email professionnel',
                  keyboardType: TextInputType.emailAddress,
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // Numéro de téléphone
                _buildTextField(
                  controller: _phoneController,
                  label: 'Numéro de téléphone',
                  keyboardType: TextInputType.phone,
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // Adresse
                _buildTextField(
                  controller: _addressController,
                  label: 'Adresse',
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 16),

                // TVA
                _buildTextField(
                  controller: _tvaController,
                  label: 'TVA',
                  onChanged: (_) => setState(() {}),
                ),

                const SizedBox(height: 24),

                // Progress Indicator
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildDot(false),
                    const SizedBox(width: 8),
                    _buildDot(true),
                    const SizedBox(width: 8),
                    _buildDot(false),
                  ],
                ),

                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton(
                  onPressed: _isFormValid && !_isLoading ? _handleSubmit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isFormValid
                        ? AppTheme.darkNavy
                        : const Color(0xFFE5E7EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    disabledBackgroundColor: const Color(0xFFE5E7EB),
                    disabledForegroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Theme.of(context).colorScheme.surface, strokeWidth: 2))
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Créer mon compte',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (_isFormValid) ...[
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward, size: 20),
                            ],
                          ],
                        ),
                ),

                const SizedBox(height: 12),

                // Skip Link — completes onboarding without filling fields.
                // The user can still edit these later in Mon Profil.
                Center(
                  child: TextButton(
                    onPressed: _isLoading ? null : _handleSkip,
                    child: const Text(
                      "Passer pour l'instant",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.darkNavy,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 8),

                // Login Link
                Center(
                  child: GestureDetector(
                    onTap: () => context.go('/login'),
                    child: RichText(
                      text: TextSpan(
                        style: TextStyle(
                          fontSize: 14,
                          color: AppTheme.textLight,
                        ),
                        children: [
                          const TextSpan(text: 'Déjà inscrit ? '),
                          TextSpan(
                            text: 'Se connecter',
                            style: const TextStyle(
                              color: AppTheme.primaryBlue,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    required Function(String) onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        onChanged: onChanged,
        style: TextStyle(
          fontSize: 16,
          color: AppTheme.darkNavy,
        ),
        decoration: InputDecoration(
          hintText: label,
          hintStyle: TextStyle(
            fontSize: 16,
            color: AppTheme.textLight,
          ),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildDot(bool isActive) {
    return Container(
      width: isActive ? 32 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: isActive ? AppTheme.darkNavy : const Color(0xFFE5E7EB),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
