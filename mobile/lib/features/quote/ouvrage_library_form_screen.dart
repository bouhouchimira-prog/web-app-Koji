import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/quote/model/library_ouvrage.dart';
import 'package:koji/features/quote/repository/ouvrage_library_repository.dart';

class OuvrageLibraryFormScreen extends ConsumerStatefulWidget {
  final LibraryOuvrage? existing;

  /// When set, the form creates a sous-ouvrage attached to this parent ouvrage.
  final String? parentId;
  final String? parentCode;

  const OuvrageLibraryFormScreen({
    super.key,
    this.existing,
    this.parentId,
    this.parentCode,
  });

  @override
  ConsumerState<OuvrageLibraryFormScreen> createState() =>
      _OuvrageLibraryFormScreenState();
}

class _OuvrageLibraryFormScreenState
    extends ConsumerState<OuvrageLibraryFormScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _codeCtrl;
  late final TextEditingController _designationCtrl;
  late final TextEditingController _familleCtrl;
  late final TextEditingController _uniteCtrl;
  late final TextEditingController _tempsCtrl;
  late final TextEditingController _tauxCtrl;
  late final TextEditingController _commentaireCtrl;
  late final TextEditingController _coefficientCtrl;
  late final TextEditingController _reductionCtrl;

  bool _saving = false;
  bool _familleCustom = false;
  bool _uniteCustom = false;

  static const _familleOptions = [
    'Carrelage',
    'Peinture',
    'Plomberie',
    'Électricité',
    'Menuiserie',
    'Démolition',
    'Maçonnerie',
    'Plâtrerie',
    'Isolation',
    'Sol souple',
  ];

  static const _uniteOptions = [
    'm²',
    'm',
    'ml',
    'm³',
    'u',
    'h',
    'kg',
    'l',
    'forfait',
  ];

  bool get _isEdit => widget.existing != null;

  /// The parent this row hangs under: an existing sous-ouvrage keeps its own
  /// parent_id; a brand-new one uses the parentId passed into the form.
  String? get _effectiveParentId =>
      widget.existing?.parentId ?? widget.parentId;

  bool get _isSubOuvrage => _effectiveParentId != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _codeCtrl = TextEditingController(text: e?.code ?? '');
    _designationCtrl = TextEditingController(text: e?.designation ?? '');
    _familleCtrl = TextEditingController(text: e?.famille ?? '');
    _uniteCtrl = TextEditingController(text: e?.unite ?? '');
    _tempsCtrl =
        TextEditingController(text: e == null ? '' : _fmt(e.tempsHU));
    _tauxCtrl =
        TextEditingController(text: e == null ? '56.25' : _fmt(e.tauxHoraire));
    _commentaireCtrl = TextEditingController(text: e?.commentaire ?? '');
    _coefficientCtrl =
        TextEditingController(text: e == null ? '1.0' : _fmt(e.coefficient));
    _reductionCtrl =
        TextEditingController(text: e == null ? '0' : _fmt(e.reduction));

    for (final c in [_tempsCtrl, _tauxCtrl]) {
      c.addListener(() => setState(() {}));
    }

    final famille = _familleCtrl.text.trim();
    if (famille.isNotEmpty && !_familleOptions.contains(famille)) {
      _familleCustom = true;
    }
    final unite = _uniteCtrl.text.trim();
    if (unite.isNotEmpty && !_uniteOptions.contains(unite)) {
      _uniteCustom = true;
    }
  }

  String _fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  double _toDouble(String s) =>
      double.tryParse(s.trim().replaceAll(',', '.')) ?? 0;

  double get _previewCoutMo => _toDouble(_tempsCtrl.text) * _toDouble(_tauxCtrl.text);

  @override
  void dispose() {
    _codeCtrl.dispose();
    _designationCtrl.dispose();
    _familleCtrl.dispose();
    _uniteCtrl.dispose();
    _tempsCtrl.dispose();
    _tauxCtrl.dispose();
    _commentaireCtrl.dispose();
    _coefficientCtrl.dispose();
    _reductionCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final repo = ref.read(ouvrageLibraryRepositoryProvider);
    final temps = _toDouble(_tempsCtrl.text);
    final taux = _toDouble(_tauxCtrl.text);
    final coutMo = temps * taux;

    final ouvrage = LibraryOuvrage(
      id: widget.existing?.id ?? '',
      code: _codeCtrl.text.trim().toUpperCase(),
      designation: _designationCtrl.text.trim(),
      famille: _familleCtrl.text.trim().isEmpty
          ? null
          : _familleCtrl.text.trim(),
      unite: _uniteCtrl.text.trim().isEmpty ? null : _uniteCtrl.text.trim(),
      tempsHU: temps,
      tauxHoraire: taux,
      coutMoU: coutMo,
      commentaire: _commentaireCtrl.text.trim().isEmpty
          ? null
          : _commentaireCtrl.text.trim(),
      coefficient: _toDouble(_coefficientCtrl.text),
      reduction: _toDouble(_reductionCtrl.text),
      parentId: _effectiveParentId,
    );

    try {
      if (_isEdit) {
        await repo.update(ouvrage);
      } else {
        await repo.create(ouvrage);
      }
      ref.invalidate(ouvrageLibraryProvider);
      if (mounted) context.pop(true);
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $err')),
        );
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        title: Text(
          _isEdit
              ? (_isSubOuvrage ? 'Modifier sous-ouvrage' : 'Modifier ouvrage')
              : (_isSubOuvrage ? 'Nouveau sous-ouvrage' : 'Nouvel ouvrage'),
          style: AppTheme.headingStyle(context).copyWith(fontSize: 18),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.darkNavy),
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Sous-ouvrage parent indicator
            if (_isSubOuvrage) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F9FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBAE6FD)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.account_tree,
                        size: 16, color: Color(0xFF0369A1)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Sous-ouvrage de ${widget.parentCode ?? widget.existing?.code ?? "l'ouvrage parent"}',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0369A1)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            _label('Code'),
            _field(
              _codeCtrl,
              hint: 'Ex: CAR-01',
              upper: true,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Code requis' : null,
            ),
            const SizedBox(height: 16),
            _label('Désignation'),
            _field(
              _designationCtrl,
              hint: 'Pose carrelage sol ≤ 60×60 cm',
              maxLines: 2,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Désignation requise' : null,
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Famille'),
                      _pickerOrField(
                        controller: _familleCtrl,
                        options: _familleOptions,
                        custom: _familleCustom,
                        onCustomToggle: (v) =>
                            setState(() => _familleCustom = v),
                        hint: 'Choisir une famille',
                        customHint: 'Nouvelle famille',
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Unité'),
                      _pickerOrField(
                        controller: _uniteCtrl,
                        options: _uniteOptions,
                        custom: _uniteCustom,
                        onCustomToggle: (v) =>
                            setState(() => _uniteCustom = v),
                        hint: 'Choisir',
                        customHint: 'Ex: ml',
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Temps (h/u)'),
                      _field(_tempsCtrl,
                          hint: '1.20', keyboard: _decimal),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Taux horaire (€)'),
                      _field(_tauxCtrl,
                          hint: '56.25', keyboard: _decimal),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: const Color(0xFF1D74FF).withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calculate_outlined,
                      color: Color(0xFF1D74FF), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Coût MO/u : ${_previewCoutMo.toStringAsFixed(2)} €',
                    style: const TextStyle(
                      color: Color(0xFF1D74FF),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Coefficient'),
                      _field(_coefficientCtrl,
                          hint: '1.00', keyboard: _decimal),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _label('Réduction (%)'),
                      _field(_reductionCtrl,
                          hint: '0', keyboard: _decimal),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _label('Commentaire'),
            _field(_commentaireCtrl,
                hint: 'Colle + joints inclus', maxLines: 3),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.darkNavy,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 54),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      _isEdit ? 'Enregistrer' : 'Créer l\'ouvrage',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  static const TextInputType _decimal =
      TextInputType.numberWithOptions(decimal: true);

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 2),
        child: Text(
          text,
          style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF374151),
              fontWeight: FontWeight.w600),
        ),
      );

  Widget _pickerOrField({
    required TextEditingController controller,
    required List<String> options,
    required bool custom,
    required ValueChanged<bool> onCustomToggle,
    required String hint,
    required String customHint,
  }) {
    if (custom) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _field(controller, hint: customHint),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () {
              controller.clear();
              onCustomToggle(false);
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              child: Text(
                '↩ Choisir dans la liste',
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.darkNavy,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      );
    }

    final value = options.contains(controller.text) ? controller.text : null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text(hint,
              style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14)),
          icon: const Icon(Icons.keyboard_arrow_down,
              color: Color(0xFF6B7280)),
          items: [
            ...options.map(
              (o) => DropdownMenuItem(value: o, child: Text(o)),
            ),
            const DropdownMenuItem(
              value: '__custom__',
              child: Text('Autre…',
                  style: TextStyle(
                      fontStyle: FontStyle.italic, color: AppTheme.darkNavy)),
            ),
          ],
          onChanged: (v) {
            if (v == null) return;
            if (v == '__custom__') {
              controller.clear();
              onCustomToggle(true);
            } else {
              setState(() => controller.text = v);
            }
          },
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController c, {
    String? hint,
    int maxLines = 1,
    TextInputType? keyboard,
    bool upper = false,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: c,
      maxLines: maxLines,
      keyboardType: keyboard,
      textCapitalization:
          upper ? TextCapitalization.characters : TextCapitalization.sentences,
      inputFormatters: upper
          ? [
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]')),
              _UpperCaseFormatter(),
            ]
          : null,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppTheme.darkNavy),
        ),
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}
