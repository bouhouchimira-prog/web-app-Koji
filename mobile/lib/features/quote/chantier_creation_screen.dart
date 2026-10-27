import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';

class ChantierCreationScreen extends ConsumerStatefulWidget {
  const ChantierCreationScreen({super.key});

  @override
  ConsumerState<ChantierCreationScreen> createState() =>
      _ChantierCreationScreenState();
}

class _ChantierCreationScreenState
    extends ConsumerState<ChantierCreationScreen> {
  final _referenceController = TextEditingController();
  final _streetController = TextEditingController();
  final _postalCodeController = TextEditingController();
  final _cityController = TextEditingController();
  final _clientEmailController = TextEditingController();

  String _selectedPropertyType = 'Maison';
  bool _dropdownOpen = false;

  final List<String> _propertyTypes = [
    'Appartement',
    'Maison',
    'Local',
    'Autre',
  ];

  @override
  void dispose() {
    _referenceController.dispose();
    _streetController.dispose();
    _postalCodeController.dispose();
    _cityController.dispose();
    _clientEmailController.dispose();
    super.dispose();
  }

  bool _isLoading = false;

  Future<void> _onNext() async {
    if (_referenceController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez renseigner la référence du chantier'),
          backgroundColor: Color(0xFF0F172A),
        ),
      );
      return;
    }

    final clientEmail = _clientEmailController.text.trim();
    if (clientEmail.isNotEmpty && !clientEmail.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Adresse e-mail du client invalide'),
          backgroundColor: Color(0xFF0F172A),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final repository = ChantierRepository();

      final data = {
        'reference': _referenceController.text.trim(),
        'street': _streetController.text.trim(),
        'postalCode': _postalCodeController.text.trim(),
        'city': _cityController.text.trim(),
        'propertyType': _selectedPropertyType,
        'clientEmail': clientEmail,
      };

      final chantierId = await repository.createChantier(data);
      data['id'] = chantierId; // Inject ID for the dashboard

      if (mounted) {
        context.push('/chantier/dashboard', extra: data);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF5EDE3), Colors.white],
            stops: [0.0, 0.45],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // App Bar
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        if (Navigator.canPop(context)) {
                          context.pop();
                        } else {
                          context.go('/home');
                        }
                      },
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE8E8E8)),
                        ),
                        child: const Icon(
                          Icons.chevron_left_rounded,
                          color: Color(0xFF0F172A),
                          size: 22,
                        ),
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'Nouveau chantier',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 36), // balance
                  ],
                ),
              ),

              // Scrollable form
              Expanded(
                child: SingleChildScrollView(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 12),

                      // Référence du chantier
                      _buildLabel('Référence  du chantier'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _referenceController,
                        hint: 'Loft Durand - Cuisine ...',
                      ),
                      const SizedBox(height: 20),

                      // Numéro / Rue
                      _buildLabel('Numéro /Rue'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _streetController,
                        hint: 'Rajouter votre texte...',
                      ),
                      const SizedBox(height: 20),

                      // Code postale
                      _buildLabel('Code postale'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _postalCodeController,
                        hint: 'Rajouter votre texte...',
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 20),

                      // Ville
                      _buildLabel('Ville'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _cityController,
                        hint: 'Rajouter votre texte...',
                      ),
                      const SizedBox(height: 20),

                      // Adresse e-mail du client
                      // This email gates the devis signature link: the client
                      // must open the link with this exact address. It is
                      // auto-filled into every devis created from this chantier.
                      _buildLabel('Adresse e-mail du client'),
                      const SizedBox(height: 8),
                      _buildTextField(
                        controller: _clientEmailController,
                        hint: 'client@exemple.com',
                        keyboardType: TextInputType.emailAddress,
                      ),
                      const SizedBox(height: 20),

                      // Type du bien
                      _buildLabel('Type du bien'),
                      const SizedBox(height: 8),
                      _buildPropertyTypeDropdown(),

                      const SizedBox(height: 120),
                    ],
                  ),
                ),
              ),

              // Sticky bottom button
              Container(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                color: Theme.of(context).colorScheme.surface,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _onNext,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F172A),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(32),
                          ),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Theme.of(context).colorScheme.surface,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Suivant',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Theme.of(context).colorScheme.surface,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    '→',
                                    style: TextStyle(
                                      fontSize: 18,
                                      color: Theme.of(context).colorScheme.surface,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: Color(0xFF0F172A),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(
        fontSize: 15,
        color: Color(0xFF0F172A),
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          fontSize: 15,
          color: const Color(0xFF0F172A).withValues(alpha: 0.35),
        ),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0F172A), width: 1.5),
        ),
      ),
    );
  }

  Widget _buildPropertyTypeDropdown() {
    return Column(
      children: [
        // Main dropdown button
        GestureDetector(
          onTap: () => setState(() => _dropdownOpen = !_dropdownOpen),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: _dropdownOpen
                  ? const BorderRadius.only(
                      topLeft: Radius.circular(12),
                      topRight: Radius.circular(12),
                    )
                  : BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _selectedPropertyType,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF0F172A),
                  ),
                ),
                AnimatedRotation(
                  turns: _dropdownOpen ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Color(0xFF0F172A),
                    size: 22,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Dropdown options
        if (_dropdownOpen)
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(12),
                bottomRight: Radius.circular(12),
              ),
              border: const Border(
                left: BorderSide(color: Color(0xFFE2E8F0)),
                right: BorderSide(color: Color(0xFFE2E8F0)),
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: Column(
              children: _propertyTypes.map((type) {
                final isSelected = type == _selectedPropertyType;
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedPropertyType = type;
                      _dropdownOpen = false;
                    });
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFF8F8F8)
                          : Colors.transparent,
                    ),
                    child: Text(
                      type,
                      style: TextStyle(
                        fontSize: 15,
                        color: isSelected
                            ? const Color(0xFF0F172A)
                            : const Color(0xFF475569),
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }
}
