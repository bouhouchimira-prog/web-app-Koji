import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/interventions/models/intervention.dart';
import 'package:koji/features/interventions/providers/intervention_provider.dart';
import 'package:koji/features/interventions/repositories/intervention_repository.dart';
import 'package:koji/features/interventions/services/intervention_pdf_service.dart';
import 'package:koji/features/signature/signature_screen.dart' show SignaturePainter;

/// Create form for a standalone intervention/diagnostic report — client/
/// site/date/entreprise/equipement/constat/analyse/preconisations, plus a
/// signature captured on the same canvas the devis signing flow uses.
/// Generates and shares the PDF on save, matching web's auto-download.
class InterventionFormScreen extends ConsumerStatefulWidget {
  const InterventionFormScreen({super.key});

  @override
  ConsumerState<InterventionFormScreen> createState() =>
      _InterventionFormScreenState();
}

class _InterventionFormScreenState
    extends ConsumerState<InterventionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _clientController = TextEditingController();
  final _siteController = TextEditingController();
  final _equipementController = TextEditingController();
  final _constatController = TextEditingController();
  final _analyseController = TextEditingController();
  final _preconisationsController = TextEditingController();
  final _signatureNameController = TextEditingController();

  DateTime _date = DateTime.now();
  List<Offset?> _signaturePoints = [];
  bool _saving = false;

  @override
  void dispose() {
    _clientController.dispose();
    _siteController.dispose();
    _equipementController.dispose();
    _constatController.dispose();
    _analyseController.dispose();
    _preconisationsController.dispose();
    _signatureNameController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _companySnapshot() async {
    try {
      final client = Supabase.instance.client;
      final uid = client.auth.currentUser?.id;
      if (uid == null) return {};
      final res = await client
          .from('users')
          .select('business_info, logo_url')
          .eq('id', uid)
          .maybeSingle();
      if (res == null) return {};
      final info = (res['business_info'] as Map?)?.cast<String, dynamic>() ?? {};
      return {
        'name': info['raisonSociale'],
        'address': info['address'],
        'phone': info['phone'],
        'email': info['emailPro'],
        'siret': info['siret'],
        'logoUrl': res['logo_url'],
      };
    } catch (_) {
      return {};
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(interventionRepositoryProvider);
      final reference = await repo.generateNextReference();
      final companySnapshot = await _companySnapshot();

      var intervention = Intervention(
        id: '',
        userId: '',
        reference: reference,
        client: _clientController.text.trim(),
        site: _siteController.text.trim().isEmpty
            ? null
            : _siteController.text.trim(),
        date: _date,
        entreprise: companySnapshot['name'] as String?,
        equipement: _equipementController.text.trim().isEmpty
            ? null
            : _equipementController.text.trim(),
        constat: _constatController.text.trim().isEmpty
            ? null
            : _constatController.text.trim(),
        analyse: _analyseController.text.trim().isEmpty
            ? null
            : _analyseController.text.trim(),
        preconisations: _preconisationsController.text.trim().isEmpty
            ? null
            : _preconisationsController.text.trim(),
        signature: _signatureNameController.text.trim().isEmpty
            ? null
            : _signatureNameController.text.trim(),
        companySnapshot: companySnapshot,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final created = await repo.create(intervention);
      intervention = created;

      // Signature (optional) — export the canvas the same way SignatureScreen does.
      if (_signaturePoints.isNotEmpty) {
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder,
            Rect.fromPoints(const Offset(0, 0), const Offset(500, 300)));
        canvas.drawRect(const Rect.fromLTWH(0, 0, 500, 300),
            Paint()..color = Colors.white);
        SignaturePainter(points: _signaturePoints)
            .paint(canvas, const Size(500, 300));
        final img = await recorder.endRecording().toImage(500, 300);
        final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
        if (byteData != null) {
          final path = await repo.uploadSignature(
              reference, byteData.buffer.asUint8List());
          await repo.update(created.id, {'signature_image_path': path});
          intervention = (await repo.getById(created.id)) ?? created;
        }
      }

      ref.invalidate(interventionsProvider);

      // Auto-generate + share the PDF on save, matching web's behaviour.
      await InterventionPdfService().share(intervention);

      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      appBar: AppBar(title: const Text('Nouvelle intervention')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _field(_clientController, 'Client', required: true),
            const SizedBox(height: 12),
            _field(_siteController, 'Site / adresse'),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date'),
              subtitle: Text('${_date.day}/${_date.month}/${_date.year}'),
              trailing: const Icon(Icons.calendar_today_outlined),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2100),
                );
                if (picked != null) setState(() => _date = picked);
              },
            ),
            const SizedBox(height: 12),
            _field(_equipementController, 'Équipement', maxLines: 2),
            const SizedBox(height: 12),
            _field(_constatController, 'Constat', maxLines: 4),
            const SizedBox(height: 12),
            _field(_analyseController, 'Analyse', maxLines: 4),
            const SizedBox(height: 12),
            _field(_preconisationsController, 'Préconisations', maxLines: 4),
            const SizedBox(height: 20),
            Text('Signature (optionnel)',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary(context))),
            const SizedBox(height: 8),
            _field(_signatureNameController, 'Nom du signataire'),
            const SizedBox(height: 8),
            Container(
              height: 180,
              decoration: BoxDecoration(
                color: AppTheme.surface(context),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: GestureDetector(
                onPanUpdate: (details) {
                  final box = context.findRenderObject() as RenderBox?;
                  final local = box?.globalToLocal(details.globalPosition);
                  if (local != null) {
                    setState(() => _signaturePoints = [..._signaturePoints, local]);
                  }
                },
                onPanEnd: (_) =>
                    setState(() => _signaturePoints = [..._signaturePoints, null]),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CustomPaint(
                    painter: SignaturePainter(points: _signaturePoints),
                    size: Size.infinite,
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => setState(() => _signaturePoints = []),
                child: const Text('Effacer'),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Enregistrer et générer le PDF'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {bool required = false, int maxLines = 1}) {
    return TextFormField(
      controller: c,
      maxLines: maxLines,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      validator: required
          ? (v) => (v == null || v.trim().isEmpty) ? 'Ce champ est requis' : null
          : null,
    );
  }
}
