import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class CreateWorkerScreen extends StatefulWidget {
  final Worker? worker;

  const CreateWorkerScreen({super.key, this.worker});

  @override
  State<CreateWorkerScreen> createState() => _CreateWorkerScreenState();
}

class _CreateWorkerScreenState extends State<CreateWorkerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();

  String? _selectedProfession;
  bool _isSubmitting = false;
  File? _pickedImage;
  final _repository = WorkerRepository();

  final List<String> _professions = [
    'Électricien',
    'Plombier',
    'Maçon',
    'Peintre',
    'Ingénieur',
    'Architecte',
    'Charpentier',
    'Conducteur de travaux',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.worker != null) {
      _firstNameController.text = widget.worker!.firstName;
      _lastNameController.text = widget.worker!.lastName;
      _selectedProfession = widget.worker!.profession;
      _phoneController.text = widget.worker!.phoneNumber ?? '';
      _emailController.text = widget.worker!.email ?? '';
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }
  void _pickImage() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Color(0xFF2E65F3)),
                title: const Text('Prendre une photo',
                    style: TextStyle( fontWeight: FontWeight.w600)),
                onTap: () async {
                  Navigator.pop(context);
                  final picked = await ImagePicker().pickImage(
                    source: ImageSource.camera,
                    imageQuality: 80,
                    maxWidth: 800,
                  );
                  if (picked != null && mounted) {
                    setState(() => _pickedImage = File(picked.path));
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Color(0xFF2E65F3)),
                title: const Text('Choisir depuis la galerie',
                    style: TextStyle( fontWeight: FontWeight.w600)),
                onTap: () async {
                  Navigator.pop(context);
                  final picked = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 80,
                    maxWidth: 800,
                  );
                  if (picked != null && mounted) {
                    setState(() => _pickedImage = File(picked.path));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }


  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedProfession == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez sélectionner un métier')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Upload photo if picked
      String? profilePicUrl;
      if (_pickedImage != null) {
        try {
          profilePicUrl = await _repository.uploadWorkerImage(
            _pickedImage!,
            _pickedImage!.path,
          );
        } catch (e) {
          debugPrint('Photo upload failed: $e');
          // Continue without photo
        }
      }

      final workerData = Worker(
        id: widget.worker?.id ?? '',
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        profession: _selectedProfession!,
        contactType: 'Ouvrier',
        status: widget.worker?.status ?? 'Disponible',
        profilePictureUrl: profilePicUrl ?? widget.worker?.profilePictureUrl,
        phoneNumber: _phoneController.text.trim().isNotEmpty
            ? _phoneController.text.trim()
            : null,
        email: _emailController.text.trim().isNotEmpty
            ? _emailController.text.trim()
            : null,
      );

      if (widget.worker != null) {
        await _repository.updateWorker(workerData);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Profil mis à jour')));
          context.pop();
        }
      } else {
        final createdWorker = await _repository.createWorker(workerData);
        if (mounted) {
          context.pushReplacement('/workers/success', extra: createdWorker);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);
    const greyText = Color(0xFF8B95A5);

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
                      horizontal: 24.0, vertical: 16.0),
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
                          "Nouveau Ouvrier",
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
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 8),

                          // Photo upload
                          GestureDetector(
                            onTap: _pickImage,
                            child: Center(
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  Container(
                                    width: 100,
                                    height: 100,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: const Color(0xFFE0E7FF),
                                        width: 1.5,
                                        strokeAlign: BorderSide.strokeAlignOutside,
                                      ),
                                    ),
                                    child: _pickedImage != null
                                        ? ClipRRect(
                                            borderRadius: BorderRadius.circular(20),
                                            child: Image.file(
                                              _pickedImage!,
                                              width: 100,
                                              height: 100,
                                              fit: BoxFit.cover,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.add_photo_alternate_outlined,
                                            color: Color(0xFFCBD5E1),
                                            size: 40,
                                          ),
                                  ),
                                  Positioned(
                                    right: -6,
                                    bottom: -6,
                                    child: Container(
                                      width: 30,
                                      height: 30,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF2E65F3),
                                        shape: BoxShape.circle,
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
                          const SizedBox(height: 8),
                          const Center(
                            child: Text(
                              "Photo de l'ouvrier",
                              style: TextStyle(
                                fontSize: 13,
                                color: greyText,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),

                          const SizedBox(height: 28),

                          // Prénom
                          _buildLabel("Prénom"),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _firstNameController,
                            hint: "Rajouter votre texte...",
                            validator: (val) => val == null || val.isEmpty
                                ? 'Obligatoire'
                                : null,
                          ),

                          const SizedBox(height: 20),

                          // Nom
                          _buildLabel("Nom"),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _lastNameController,
                            hint: "Rajouter votre texte...",
                            validator: (val) => val == null || val.isEmpty
                                ? 'Obligatoire'
                                : null,
                          ),

                          const SizedBox(height: 20),

                          // Profession
                          _buildLabel("Profession"),
                          const SizedBox(height: 8),
                          _buildDropdown(),

                          const SizedBox(height: 20),

                          // Numéro de téléphone
                          _buildLabel("Numéro de téléphone"),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _phoneController,
                            hint: "06 12 34 56 78",
                            keyboardType: TextInputType.phone,
                          ),

                          const SizedBox(height: 20),

                          // Email
                          _buildLabel("Email"),
                          const SizedBox(height: 8),
                          _buildTextField(
                            controller: _emailController,
                            hint: "exemple@email.com",
                            keyboardType: TextInputType.emailAddress,
                          ),

                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Bottom Button
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: const EdgeInsets.only(
                  left: 24.0, right: 24.0, bottom: 32.0, top: 12),
              decoration: BoxDecoration(
                color: appBg,
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03),
                    blurRadius: 10,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
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
                      : Text(
                          "Enregistrer le profil",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.surface,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }


  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: Color(0xFF0A1227),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        validator: validator,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: Color(0xFF0A1227),
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: const Color(0xFF8B95A5).withValues(alpha: 0.5),
            fontWeight: FontWeight.w400,
          ),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  Widget _buildDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedProfession,
          hint: Text(
            "Sélectionner un métier",
            style: TextStyle(
              color: const Color(0xFF8B95A5).withValues(alpha: 0.5),
              fontWeight: FontWeight.w400,
              fontSize: 15,
            ),
          ),
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down,
              color: Color(0xFF8B95A5), size: 24),
          dropdownColor: Colors.white,
          borderRadius: BorderRadius.circular(14),
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: Color(0xFF0A1227),
          ),
          items: _professions
              .map((e) => DropdownMenuItem(
                    value: e,
                    child: Text(e),
                  ))
              .toList(),
          onChanged: (val) =>
              setState(() => _selectedProfession = val),
        ),
      ),
    );
  }
}
