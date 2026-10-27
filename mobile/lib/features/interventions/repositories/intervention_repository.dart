import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/interventions/models/intervention.dart';
import 'package:koji/features/quote/repositories/invoice_repository.dart';

/// CRUD + status-transition helpers for the interventions module.
/// Flutter-native table — see koji-main/supabase/migrations/0004_interventions.sql.
class InterventionRepository {
  InterventionRepository(this._client);

  final SupabaseClient _client;
  static const _bucket = 'intervention-signatures';

  String get _userId => _client.auth.currentUser!.id;

  Future<List<Intervention>> getAll() async {
    final rows = await _client
        .from('interventions')
        .select()
        .eq('user_id', _userId)
        .order('created_at', ascending: false);
    return (rows as List)
        .map((e) => Intervention.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  Future<Intervention?> getById(String id) async {
    final row = await _client
        .from('interventions')
        .select()
        .eq('id', id)
        .maybeSingle();
    return row == null ? null : Intervention.fromMap(row);
  }

  /// Generate the next sequential reference, scoped per user and year.
  /// Format: INT-YYYY-NNNN.
  Future<String> generateNextReference() async {
    final year = DateTime.now().year;
    final prefix = 'INT-$year-';
    try {
      final rows = await _client
          .from('interventions')
          .select('reference')
          .eq('user_id', _userId)
          .like('reference', '$prefix%');

      int maxSeq = 0;
      for (final r in rows) {
        final ref = (r['reference'] as String?) ?? '';
        final tail = ref.substring(ref.lastIndexOf('-') + 1);
        final n = int.tryParse(tail) ?? 0;
        if (n > maxSeq) maxSeq = n;
      }
      final next = (maxSeq + 1).toString().padLeft(4, '0');
      return '$prefix$next';
    } catch (_) {
      return '$prefix${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    }
  }

  Future<Intervention> create(Intervention intervention) async {
    final inserted = await _client
        .from('interventions')
        .insert({...intervention.toInsertMap(), 'user_id': _userId})
        .select()
        .single();
    return Intervention.fromMap(inserted);
  }

  Future<void> update(String id, Map<String, dynamic> updates) async {
    await _client.from('interventions').update({
      ...updates,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  Future<void> delete(String id) async {
    await _client.from('interventions').delete().eq('id', id);
  }

  /// Upload the signature PNG bytes, returning the storage path to persist
  /// on the intervention row.
  Future<String> uploadSignature(String interventionRef, Uint8List bytes) async {
    final path =
        '$_userId/${interventionRef}_${DateTime.now().millisecondsSinceEpoch}.png';
    await _client.storage.from(_bucket).uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(upsert: true, contentType: 'image/png'),
        );
    return path;
  }

  String signatureUrl(String path) =>
      _client.storage.from(_bucket).getPublicUrl(path);

  // ── Status transitions (mirroring web's action verbs) ──────────────────

  Future<void> markCompleted(String id) => update(id, {
        'status': InterventionStatus.terminee,
        'completed_at': DateTime.now().toIso8601String(),
      });

  Future<void> reopen(String id) => update(id, {
        'status': InterventionStatus.enCours,
        'completed_at': null,
      });

  Future<void> linkToChantier(String id, String projectId) =>
      update(id, {'project_id': projectId});

  Future<void> archive(String id) =>
      update(id, {'status': InterventionStatus.archivee});

  /// Create an invoice from this intervention, reusing the same `invoices`
  /// insert path chantier invoices use (InvoiceRepository) so there is a
  /// single invoice system rather than a third one. Requires the
  /// intervention to already be linked to a chantier ([Intervention.projectId])
  /// since `invoices.chantier_id` is required.
  Future<Map<String, dynamic>> createInvoiceFrom({
    required Intervention intervention,
    required double amount,
    String? note,
  }) async {
    if (intervention.projectId == null) {
      throw StateError(
          'Cette intervention doit être liée à un chantier avant de pouvoir facturer.');
    }
    final invoice = await InvoiceRepository().createInvoice(
      chantierId: intervention.projectId!,
      quoteTotal: amount,
      type: 'intermediaire',
      amount: amount,
      amountMode: 'fixed',
      note: note ?? 'Intervention ${intervention.reference}',
      clientName: intervention.client,
    );
    await update(intervention.id, {
      'status': InterventionStatus.facturee,
      'invoice_id': invoice['id'],
    });
    return invoice;
  }
}

final interventionRepositoryProvider = Provider<InterventionRepository>((ref) {
  return InterventionRepository(Supabase.instance.client);
});
