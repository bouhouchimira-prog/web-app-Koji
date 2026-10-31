import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ProjectRepository {
  final SupabaseClient _client = Supabase.instance.client;

  Future<List<Project>> fetchProjects() async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return [];

      // Fetch from chantiers table (main source of truth for user's job sites)
      final response = await _client
          .from('chantiers')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      return (response as List).map((e) => Project.fromChantierJson(e)).toList();
    } catch (e) {
      // Fallback to projects table if chantiers fails
      try {
        final userId = _client.auth.currentUser?.id;
        if (userId == null) return [];
        final response = await _client
            .from('projects')
            .select()
            .eq('user_id', userId)
            .order('created_at', ascending: false);
        return (response as List).map((e) => Project.fromJson(e)).toList();
      } catch (_) {
        throw Exception('Failed to fetch projects: $e');
      }
    }
  }

  Future<List<ProjectAssignment>> fetchAssignmentsForProject(
      String projectId) async {
    try {
      final response = await _client
          .from('chantier_assignments')
          .select()
          .eq('chantier_id', projectId);

      return (response as List)
          .map((e) => ProjectAssignment.fromJson(e))
          .toList();
    } catch (e) {
      throw Exception('Failed to fetch assignments: $e');
    }
  }

  Future<void> assignWorkersToProject(
      String projectId, List<String> workerIds) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) throw Exception("User not authenticated");

      final rows = workerIds
          .map((workerId) => {
                'user_id': userId,
                'chantier_id': projectId,
                'worker_id': workerId,
                'assigned_at': DateTime.now().toIso8601String(),
              })
          .toList();

      await _client
          .from('chantier_assignments')
          .upsert(rows, onConflict: 'chantier_id,worker_id');
    } catch (e) {
      throw Exception('Failed to assign workers: $e');
    }
  }

  Future<void> removeWorkerAssignment(String projectId, String workerId) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) throw Exception("User not authenticated");

      await _client
          .from('chantier_assignments')
          .delete()
          .eq('chantier_id', projectId)
          .eq('worker_id', workerId)
          .eq('user_id', userId);
    } catch (e) {
      throw Exception('Failed to remove worker assignment: $e');
    }
  }

  Future<List<TaskItem>> fetchProjectTasks(String projectId) async {
    try {
      final response = await _client
          .from('project_tasks')
          .select()
          .eq('project_id', projectId)
          .order('created_at', ascending: false);

      return (response as List).map((e) => TaskItem.fromJson(e)).toList();
    } catch (e) {
      throw Exception('Failed to fetch project tasks: $e');
    }
  }

  Future<void> createDummyProject() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return;

    await _client.from('projects').insert({
      'user_id': userId,
      'title': 'Rénovation Appartement T3',
      'client_name': 'M. Robert Durand',
      'address': '12 Rue des Lilas, 75011 Paris',
      'status': 'En Cours',
      'image_url':
          'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2831&auto=format&fit=crop',
    });

    await _client.from('projects').insert({
      'user_id': userId,
      'title': 'Construction Bureau',
      'client_name': 'Mme. Claire Martin',
      'address': '45 Avenue des Champs-Élysées, 75008 Paris',
      'status': 'Terminé',
      'image_url':
          'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop',
    });
  }

  Future<List<TaskItem>> fetchUserPlanning(DateTime date) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return [];

      // 1. Get the user's chantier IDs
      final chantiers = await _client
          .from('chantiers')
          .select('id')
          .eq('user_id', userId);

      if ((chantiers as List).isEmpty) return [];

      final chantierIds = chantiers.map((c) => c['id'] as String).toList();

      // 2. Fetch tasks for those chantiers on the selected date
      final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

      final response = await _client
          .from('chantier_tasks')
          .select()
          .inFilter('chantier_id', chantierIds)
          .order('created_at', ascending: false);

      return (response as List).map((e) => TaskItem.fromChantierTaskJson(e)).toList();
    } catch (e) {
      throw Exception('Failed to fetch planning: $e');
    }
  }

  /// Fetch real stats for the sync dashboard
  Future<Map<String, dynamic>> fetchSyncStats() async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return {'totalWorkers': 0, 'activeWorkers': 0};

      final workers = await _client
          .from('workers')
          .select('id, status')
          .eq('user_id', userId);

      final total = (workers as List).length;
      final active = workers.where((w) => w['status'] == 'Disponible' || w['status'] == 'En mission').length;

      return {
        'totalWorkers': total,
        'activeWorkers': active,
      };
    } catch (e) {
      return {'totalWorkers': 0, 'activeWorkers': 0};
    }
  }

  Future<void> updateTaskSchedule(
      String taskId, DateTime date, String startTime, String duration) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) throw Exception("User not authenticated");

      // Update scheduled_date and details needed for Planning
      // We will perform a simple update for now.
      // Ideally we should merge 'details' but Supabase update replaces the column value.
      await _client.from('project_tasks').update({
        'scheduled_date': date.toIso8601String(),
        'details': {
          'start_time': startTime,
          'duration': duration,
        }
      }).eq('id', taskId);
    } catch (e) {
      throw Exception('Failed to update task schedule: $e');
    }
  }

  Future<void> updateTaskScheduleAdvanced(
    String taskId, {
    required DateTime startDate,
    required DateTime endDate,
    required String startTime,
    required String endTime,
    String? workerId,
  }) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) throw Exception("User not authenticated");

      final updateData = {
        'scheduled_date': startDate
            .toIso8601String(), // Keep for legacy/simple view compatibility
        'start_date': startDate.toIso8601String(),
        'end_date': endDate.toIso8601String(),
        'start_time': startTime,
        'end_time': endTime,
        // Calculate duration? Optional.
        'details': {
          'start_time': startTime,
          'end_time': endTime,
        }
      };

      if (workerId != null) {
        updateData['user_id'] =
            userId; // Ensure we keep owner but maybe add assigned_worker_id column?
        // Wait, schema says worker_id. Let's use worker_id.
        updateData['worker_id'] = workerId;
      }

      await _client.from('project_tasks').update(updateData).eq('id', taskId);
    } catch (e) {
      throw Exception('Failed to update task schedule: $e');
    }
  }
}
