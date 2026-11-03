import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/features/pricing/models/pricing_models.dart';

final pricingRepositoryProvider = Provider<PricingRepository>((ref) {
  return PricingRepository(Supabase.instance.client);
});

class PricingRepository {
  final SupabaseClient _supabase;

  PricingRepository(this._supabase);

  // Fetch pricing profile for a specific profession
  Future<PricingProfile?> getProfileForProfession(String profession) async {
    try {
      final response = await _supabase
          .from('pricing_profiles')
          .select()
          .eq('profession', profession)
          .eq('is_active', true)
          .maybeSingle();

      if (response == null) return null;
      return PricingProfile.fromJson(response);
    } catch (e) {
      debugPrint('Error fetching pricing profile: $e');
      return null;
    }
  }

  // Fetch all pricing profiles (for admin settings)
  Future<List<PricingProfile>> getAllProfiles() async {
    try {
      final response =
          await _supabase.from('pricing_profiles').select().order('profession');

      return (response as List)
          .map((json) => PricingProfile.fromJson(json))
          .toList();
    } catch (e) {
      debugPrint('Error fetching pricing profiles: $e');
      return [];
    }
  }

  // Update pricing profile
  Future<void> updateProfile(PricingProfile profile) async {
    try {
      await _supabase
          .from('pricing_profiles')
          .update(profile.toJson())
          .eq('id', profile.id);
    } catch (e) {
      debugPrint('Error updating pricing profile: $e');
      rethrow;
    }
  }

  // Fetch smart tasks for a profession
  Future<List<SmartTask>> getTasksForProfession(String profession) async {
    try {
      // Fetch tasks
      final tasksResponse = await _supabase
          .from('smart_tasks')
          .select()
          .eq('profession', profession);

      final tasks = tasksResponse as List;

      // Fetch material requirements for all tasks
      final taskIds = tasks.map((t) => t['id'] as String).toList();

      final List<MaterialRequirement> allRequirements = [];
      if (taskIds.isNotEmpty) {
        final reqResponse = await _supabase
            .from('task_material_requirements')
            .select()
            .inFilter('task_id', taskIds);

        allRequirements.addAll((reqResponse as List)
            .map((json) => MaterialRequirement.fromJson(json))
            .toList());
      }

      // Map requirements to tasks using the strongly-typed taskId field directly
      // (avoids the bug where req.toJson()['task_id'] was undefined)
      return tasks.map((taskJson) {
        final taskId = taskJson['id'] as String;
        final requirements =
            allRequirements.where((req) => req.taskId == taskId).toList();

        return SmartTask.fromJson(taskJson, requirements: requirements);
      }).toList();
    } catch (e) {
      debugPrint('Error fetching smart tasks: $e');
      return [];
    }
  }

  // Fetch specific task by ID with its requirements
  Future<SmartTask?> getTaskById(String taskId) async {
    try {
      final taskResponse = await _supabase
          .from('smart_tasks')
          .select()
          .eq('id', taskId)
          .maybeSingle();

      if (taskResponse == null) return null;

      final reqResponse = await _supabase
          .from('task_material_requirements')
          .select()
          .eq('task_id', taskId);

      final requirements = (reqResponse as List)
          .map((json) => MaterialRequirement.fromJson(json))
          .toList();

      return SmartTask.fromJson(taskResponse, requirements: requirements);
    } catch (e) {
      debugPrint('Error fetching task by ID: $e');
      return null;
    }
  }

  /// Lit le catalogue partage web <-> mobile (`koji_ouvrages`, migration 0002).
  ///
  /// Renvoie les ouvrages du socle commun (is_shared = true) convertis en
  /// [SmartTask] pour etre utilisables par le moteur de prix. Retourne une
  /// liste vide si la table est absente ou vide : les callers doivent alors
  /// conserver leur comportement actuel (smart_tasks / JSON local).
  Future<List<SmartTask>> getSharedOuvrages({String? metier}) async {
    try {
      var query = _supabase
          .from('koji_ouvrages')
          .select()
          .eq('is_shared', true)
          .eq('is_active', true);
      if (metier != null && metier.isNotEmpty) {
        query = query.eq('metier', metier);
      }
      final response = await query.order('label');
      return (response as List).map((row) {
        return SmartTask(
          id: row['id'] as String,
          label: (row['label'] ?? '') as String,
          profession: (row['metier'] ?? row['famille'] ?? '') as String,
          unit: (row['unite'] ?? 'u') as String,
          normativeTime: ((row['temps_unitaire'] ?? 0) as num).toDouble(),
        );
      }).toList();
    } catch (e) {
      debugPrint('Error fetching shared ouvrages: $e');
      return [];
    }
  }
}

// Providers for accessing pricing data
final pricingProfileProvider =
    FutureProvider.family<PricingProfile?, String>((ref, profession) async {
  final repo = ref.read(pricingRepositoryProvider);
  return await repo.getProfileForProfession(profession);
});

final smartTasksProvider =
    FutureProvider.family<List<SmartTask>, String>((ref, profession) async {
  final repo = ref.read(pricingRepositoryProvider);
  return await repo.getTasksForProfession(profession);
});

/// Catalogue partage web <-> mobile (koji_ouvrages), vide si non migre.
final sharedOuvragesProvider = FutureProvider<List<SmartTask>>((ref) async {
  final repo = ref.read(pricingRepositoryProvider);
  return await repo.getSharedOuvrages();
});
