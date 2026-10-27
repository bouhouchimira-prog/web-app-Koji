import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/fournitures/models/fourniture_model.dart';
import 'package:koji/features/fournitures/repository/fourniture_repository.dart';
import 'package:koji/features/fournitures/services/supply_import_service.dart';

class AddFournitureScreen extends ConsumerStatefulWidget {
  final Fournisseur? preselectedFournisseur;

  const AddFournitureScreen({super.key, this.preselectedFournisseur});

  @override
  ConsumerState<AddFournitureScreen> createState() =>
      _AddFournitureScreenState();
}

class _AddFournitureScreenState extends ConsumerState<AddFournitureScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _prixAchatController = TextEditingController();
  final _prixVenteController = TextEditingController();
  final _conditionnementController = TextEditingController();
  final _barcodeController = TextEditingController();
  final _imageUrlController = TextEditingController();
  final _sourceUrlController = TextEditingController();
  final _quantiteController = TextEditingController();

  String _selectedCategory = 'Peinture';
  String _selectedUnite = 'Unité';
  Fournisseur? _selectedFournisseur;
  bool _isUrlMode = false;
  bool _isSaving = false;
  bool _isImporting = false;
  String? _importedImageUrl;
  // Image choisie dans la galerie (mode Manuel) — uploadée à l'enregistrement.
  File? _imageFile;

  final _supplyImportService = SupplyImportService();

  Future<void> _pickImageFromGallery() async {
    final img = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (img != null) setState(() => _imageFile = File(img.path));
  }

  /// Scrape le lien produit collé et préremplit le formulaire (nom, prix,
  /// catégorie, image, conditionnement) — miroir de l'import web-app-Koji.
  Future<void> _importFromUrl() async {
    final url = _sourceUrlController.text.trim();
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Collez un lien produit d\'abord')),
      );
      return;
    }

    setState(() => _isImporting = true);
    try {
      final result = await _supplyImportService.importFromUrl(url);

      if (result.name.isNotEmpty) _nameController.text = result.name;
      if (result.priceHt > 0) {
        final priceStr = result.priceHt.toStringAsFixed(2);
        _prixAchatController.text = priceStr;
        _prixVenteController.text = priceStr;
      }
      if (result.conditionnement != null) {
        _conditionnementController.text = result.conditionnement!;
      }
      if (result.quantite != null) {
        _quantiteController.text = result.quantite!.toStringAsFixed(0);
      }
      if (result.unite != null && _unites.contains(result.unite)) {
        setState(() => _selectedUnite = result.unite!);
      }
      if (_categories.contains(result.category)) {
        setState(() => _selectedCategory = result.category);
      }
      setState(() => _importedImageUrl = result.imageUrl);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Informations importées, vérifiez avant d\'enregistrer'),
            backgroundColor: Color(0xFF22C55E),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Import impossible: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isImporting = false);
    }
  }

  final List<String> _unites = [
    'Unité',
    'm²',
    'm³',
    'ml',
    'L',
    'kg',
    'g',
    'pcs',
    'h',
  ];

  final List<String> _categories = [
    'Peinture',
    'Enduit',
    'Outillage',
    'Matériaux',
    'Plomberie',
    'Électricité',
    'Autre',
  ];

  @override
  void initState() {
    super.initState();
    _selectedFournisseur = widget.preselectedFournisseur;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _prixAchatController.dispose();
    _prixVenteController.dispose();
    _conditionnementController.dispose();
    _barcodeController.dispose();
    _imageUrlController.dispose();
    _sourceUrlController.dispose();
    _quantiteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fournisseursAsync = ref.watch(fournisseursProvider);

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      body: SafeArea(
        child: Column(
          children: [
            // ─── HEADER ─────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 16, 0),
              child: Row(
                children: [
                  Container(
                    margin: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back,
                          color: AppTheme.darkNavy, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Ajouter une fourniture',
                      textAlign: TextAlign.center,
                      style: AppTheme.headingStyle(context)
                          .copyWith(fontSize: 18),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // ─── MODE TOGGLE ────────────
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _isUrlMode = false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: !_isUrlMode
                              ? AppTheme.darkNavy
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.edit_outlined,
                                size: 18,
                                color: !_isUrlMode
                                    ? Colors.white
                                    : AppTheme.textLight),
                            const SizedBox(width: 6),
                            Text(
                              'Manuel',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: !_isUrlMode
                                    ? Colors.white
                                    : AppTheme.textLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _isUrlMode = true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _isUrlMode
                              ? AppTheme.darkNavy
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.link,
                                size: 18,
                                color: _isUrlMode
                                    ? Colors.white
                                    : AppTheme.textLight),
                            const SizedBox(width: 6),
                            Text(
                              'Via URL',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: _isUrlMode
                                    ? Colors.white
                                    : AppTheme.textLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── FORM ───────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_isUrlMode) ...[
                        _buildUrlForm(),
                      ] else ...[
                        _buildManualForm(fournisseursAsync),
                      ],
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),

            // ─── SAVE BUTTON ────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.05),
                    blurRadius: 20,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.darkNavy,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Theme.of(context).colorScheme.surface, strokeWidth: 2))
                    : const Text(
                        'Enregistrer',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildManualForm(AsyncValue<List<Fournisseur>> fournisseursAsync) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildFormField(
          controller: _nameController,
          label: 'Nom du produit',
          hint: 'Ex: Peinture acrylique blanche',
          icon: Icons.inventory_2_outlined,
          required: true,
        ),
        const SizedBox(height: 14),

        // Category dropdown
        _buildDropdown(
          label: 'Catégorie',
          value: _selectedCategory,
          items: _categories,
          icon: Icons.category_outlined,
          onChanged: (val) => setState(() => _selectedCategory = val!),
        ),
        const SizedBox(height: 14),

        // Fournisseur dropdown
        fournisseursAsync.when(
          data: (list) => _buildFournisseurDropdown(list),
          loading: () => const LinearProgressIndicator(),
          error: (_, __) => const SizedBox.shrink(),
        ),
        const SizedBox(height: 14),

        // Prices row
        Row(
          children: [
            Expanded(
              child: _buildFormField(
                controller: _prixAchatController,
                label: "Prix d'achat H.T",
                hint: '0.00',
                icon: Icons.euro,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                required: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildFormField(
                controller: _prixVenteController,
                label: 'Prix de vente H.T',
                hint: '0.00',
                icon: Icons.euro,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                required: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        _buildFormField(
          controller: _conditionnementController,
          label: 'Conditionnement',
          hint: 'Ex: Pot de 5L',
          icon: Icons.straighten,
        ),
        const SizedBox(height: 14),

        // Quantité + Unité row
        Row(
          children: [
            Expanded(
              child: _buildFormField(
                controller: _quantiteController,
                label: 'Quantité',
                hint: '0',
                icon: Icons.numbers,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildDropdown(
                label: 'Unité',
                value: _selectedUnite,
                items: _unites,
                icon: Icons.straighten_outlined,
                onChanged: (val) => setState(() => _selectedUnite = val!),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        _buildFormField(
          controller: _barcodeController,
          label: 'Code-barre',
          hint: 'Optionnel',
          icon: Icons.qr_code,
        ),
        const SizedBox(height: 14),

        // Image du produit — depuis la galerie (plus d'URL à saisir).
        _buildImagePicker(),
      ],
    );
  }

  Widget _buildImagePicker() {
    return GestureDetector(
      onTap: _pickImageFromGallery,
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          image: _imageFile != null
              ? DecorationImage(
                  image: FileImage(_imageFile!), fit: BoxFit.cover)
              : null,
        ),
        child: _imageFile != null
            ? Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: Colors.black54,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(Icons.close,
                          size: 16, color: Colors.white),
                      onPressed: () => setState(() => _imageFile = null),
                    ),
                  ),
                ),
              )
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_photo_alternate_outlined,
                      size: 28, color: Color(0xFF64748B)),
                  SizedBox(height: 6),
                  Text('Ajouter une photo (galerie)',
                      style:
                          TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
      ),
    );
  }

  Widget _buildUrlForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Column(
            children: [
              const Icon(Icons.link, size: 40, color: Color(0xFF3B82F6)),
              const SizedBox(height: 12),
              const Text(
                'Ajouter via un lien',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.darkNavy,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Collez le lien du produit depuis le site du fournisseur.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildFormField(
                controller: _sourceUrlController,
                label: 'Lien du produit',
                hint: 'https://www.fournisseur.fr/produit/...',
                icon: Icons.link,
                required: true,
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _isImporting ? null : _importFromUrl,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isImporting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Importer'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        if (_importedImageUrl != null) ...[
          Container(
            height: 110,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              image: DecorationImage(
                image: NetworkImage(_importedImageUrl!),
                fit: BoxFit.contain,
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],

        _buildFormField(
          controller: _nameController,
          label: 'Nom du produit',
          hint: 'Ex: Peinture acrylique blanche',
          icon: Icons.inventory_2_outlined,
          required: true,
        ),
        const SizedBox(height: 14),

        // Category
        _buildDropdown(
          label: 'Catégorie',
          value: _selectedCategory,
          items: _categories,
          icon: Icons.category_outlined,
          onChanged: (val) => setState(() => _selectedCategory = val!),
        ),
        const SizedBox(height: 14),

        // Prices
        Row(
          children: [
            Expanded(
              child: _buildFormField(
                controller: _prixAchatController,
                label: "Prix d'achat H.T",
                hint: '0.00',
                icon: Icons.euro,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildFormField(
                controller: _prixVenteController,
                label: 'Prix de vente H.T',
                hint: '0.00',
                icon: Icons.euro,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        _buildFormField(
          controller: _conditionnementController,
          label: 'Conditionnement',
          hint: 'Ex: Pot de 5L',
          icon: Icons.straighten,
        ),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: _buildFormField(
                controller: _quantiteController,
                label: 'Quantité',
                hint: '0',
                icon: Icons.numbers,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildDropdown(
                label: 'Unité',
                value: _selectedUnite,
                items: _unites,
                icon: Icons.straighten_outlined,
                onChanged: (val) => setState(() => _selectedUnite = val!),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFournisseurDropdown(List<Fournisseur> list) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonFormField<String>(
        value: _selectedFournisseur?.id,
        decoration: const InputDecoration(
          border: InputBorder.none,
          labelText: 'Fournisseur (optionnel)',
          labelStyle: TextStyle(
            fontSize: 13,
            color: Color(0xFF94A3B8),
          ),
          icon: Icon(Icons.store_outlined,
              size: 18, color: Color(0xFF94A3B8)),
        ),
        items: [
          const DropdownMenuItem(
            value: null,
            child: Text('Aucun (Divers)',
                style: TextStyle( fontSize: 14)),
          ),
          ...list.map((f) => DropdownMenuItem(
                value: f.id,
                child: Text(f.name,
                    style:
                        const TextStyle( fontSize: 14)),
              )),
        ],
        onChanged: (val) {
          setState(() {
            _selectedFournisseur =
                val != null ? list.firstWhere((f) => f.id == val) : null;
          });
        },
      ),
    );
  }

  Widget _buildFormField({
    required TextEditingController controller,
    required String label,
    String? hint,
    IconData? icon,
    bool required = false,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: TextStyle(
        fontSize: 14,
        color: AppTheme.textPrimary(context),
      ),
      cursorColor: AppTheme.darkNavy,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Theme.of(context).colorScheme.surface,
        labelStyle: const TextStyle(
          fontSize: 13,
          color: Color(0xFF94A3B8),
        ),
        hintStyle: TextStyle(
          fontSize: 13,
          color: Colors.grey[400],
        ),
        prefixIcon: icon != null
            ? Icon(icon, size: 18, color: const Color(0xFF94A3B8))
            : null,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
          borderSide: const BorderSide(color: AppTheme.darkNavy, width: 1.5),
        ),
      ),
      validator: required
          ? (val) =>
              (val == null || val.isEmpty) ? 'Ce champ est requis' : null
          : null,
    );
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> items,
    IconData? icon,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonFormField<String>(
        value: value,
        decoration: InputDecoration(
          border: InputBorder.none,
          labelText: label,
          labelStyle: const TextStyle(
            fontSize: 13,
            color: Color(0xFF94A3B8),
          ),
          icon: icon != null
              ? Icon(icon, size: 18, color: const Color(0xFF94A3B8))
              : null,
        ),
        items: items
            .map((c) => DropdownMenuItem(
                value: c,
                child: Text(c,
                    style: const TextStyle( fontSize: 14))))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final quantite = double.tryParse(
          _quantiteController.text.replaceAll(',', '.'));

      final repo = ref.read(fournitureRepositoryProvider);

      // Upload de l'image galerie (si choisie) → URL publique. En mode URL on
      // garde le champ URL existant.
      String? imageUrl = _imageUrlController.text.isNotEmpty
          ? _imageUrlController.text.trim()
          : _importedImageUrl;
      if (_imageFile != null) {
        try {
          imageUrl = await repo.uploadFournitureImage(_imageFile!.path);
        } catch (_) {/* image facultative */}
      }

      final data = {
        'name': _nameController.text.trim(),
        'category': _selectedCategory,
        'prix_achat_ht': double.tryParse(
                _prixAchatController.text.replaceAll(',', '.')) ??
            0.0,
        'prix_vente_ht': double.tryParse(
                _prixVenteController.text.replaceAll(',', '.')) ??
            0.0,
        if (_conditionnementController.text.isNotEmpty)
          'conditionnement': _conditionnementController.text.trim(),
        if (quantite != null) 'quantite': quantite,
        'unite': _selectedUnite,
        if (_barcodeController.text.isNotEmpty)
          'barcode': _barcodeController.text.trim(),
        if (imageUrl != null) 'image_url': imageUrl,
        if (_sourceUrlController.text.isNotEmpty)
          'source_url': _sourceUrlController.text.trim(),
        if (_selectedFournisseur != null)
          'fournisseur_id': _selectedFournisseur!.id,
      };

      final created = await repo.addFourniture(data);

      // Invalidate all relevant providers
      ref.invalidate(recentFournituresProvider);
      ref.invalidate(diversFournituresProvider);
      ref.invalidate(allFournituresProvider);
      if (_selectedFournisseur != null) {
        ref.invalidate(
            fournisseurFournituresProvider(_selectedFournisseur!.id));
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fourniture ajoutée avec succès'),
            backgroundColor: Color(0xFF22C55E),
          ),
        );
        // Renvoie la fourniture créée pour que l'appelant (devis) l'insère.
        Navigator.pop(context, created);
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
      if (mounted) setState(() => _isSaving = false);
    }
  }
}
