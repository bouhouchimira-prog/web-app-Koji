import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final rdvRepositoryProvider = Provider<RdvRepository>((ref) {
  return RdvRepository(SupabaseConfig.client);
});

class RdvRepository {
  final SupabaseClient _supabase;

  RdvRepository(this._supabase);

  /// Save a new RDV (appointment) to Supabase.
  /// [chantierId] is optional — used when the RDV is linked to a chantier.
  Future<Map<String, dynamic>> createRdv({
    required String userId,
    required String title,
    required DateTime scheduledAt,
    required String duration,
    String? note,
    String? workerName,
    String? workerId,
    String? chantierId,
  }) async {
    final data = {
      'user_id': userId,
      'title': title,
      'scheduled_at': scheduledAt.toIso8601String(),
      'duration': duration,
      if (note != null && note.isNotEmpty) 'note': note,
      if (workerName != null && workerName.isNotEmpty) 'worker_name': workerName,
      if (workerId != null) 'worker_id': workerId,
      if (chantierId != null) 'chantier_id': chantierId,
      'created_at': DateTime.now().toIso8601String(),
    };

    final response =
        await _supabase.from('rdvs').insert(data).select().single();
    return response;
  }

  /// Fetch all RDVs for a user, optionally filtered by chantier.
  Future<List<Map<String, dynamic>>> getRdvs({
    required String userId,
    String? chantierId,
  }) async {
    var query = _supabase
        .from('rdvs')
        .select()
        .eq('user_id', userId);

    if (chantierId != null) {
      query = query.eq('chantier_id', chantierId);
    }

    final response = await query.order('scheduled_at', ascending: true);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Delete a RDV by id.
  Future<void> deleteRdv(String rdvId) async {
    await _supabase.from('rdvs').delete().eq('id', rdvId);
  }
}
