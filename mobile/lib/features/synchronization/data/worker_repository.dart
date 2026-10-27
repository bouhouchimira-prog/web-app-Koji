import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';

class WorkerRepository {
  final SupabaseClient _client = Supabase.instance.client;

  // Unambiguous alphabet (no 0/O/1/I) for codes and passwords the entreprise
  // reads aloud / types when sharing them with a worker.
  static const _alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  String _randomToken(int length) {
    final rng = Random.secure();
    return List.generate(
      length,
      (_) => _alphabet[rng.nextInt(_alphabet.length)],
    ).join();
  }

  Future<List<Worker>> getWorkers({String? query}) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return [];

      var dbQuery = _client.from('workers').select().eq('user_id', userId);

      if (query != null && query.isNotEmpty) {
        dbQuery = dbQuery.or(
            'first_name.ilike.%$query%,last_name.ilike.%$query%,profession.ilike.%$query%');
      }

      final response = await dbQuery.order('created_at', ascending: false);

      return (response as List).map((e) => Worker.fromJson(e)).toList();
    } catch (e) {
      throw Exception('Failed to fetch workers: $e');
    }
  }

  /// Re-fetch a single worker by id (fresh credentials included). Used by the
  /// detail screen so it always shows the access_code/password from the DB,
  /// regardless of how stale the passed-in Worker object might be.
  Future<Worker?> getWorkerById(String workerId) async {
    try {
      final response = await _client
          .from('workers')
          .select()
          .eq('id', workerId)
          .maybeSingle();
      if (response == null) return null;
      return Worker.fromJson(response);
    } catch (_) {
      return null;
    }
  }

  Future<Worker> createWorker(Worker worker) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final data = worker.toJson();
      data['user_id'] = userId;

      final response = await _client
          .from('workers')
          .insert(data)
          .select()
          .single();

      final created = Worker.fromJson(response);

      // Generate per-worker Espace Particulier credentials and persist them via
      // the secure RPC (set_worker_access_credentials). The worker uses these to
      // log in and follow their tasks. Returned on the worker so the detail
      // screen can display/share them.
      final accessCode = 'OUV-${_randomToken(6)}';
      final accessPassword = _randomToken(8);
      try {
        await _client.rpc('set_worker_access_credentials', params: {
          'p_worker_id': created.id,
          'p_access_code': accessCode,
          'p_access_password': accessPassword,
        });
        return Worker.fromJson({
          ...response,
          'access_code': accessCode,
          'access_password': accessPassword,
        });
      } catch (e) {
        // Credentials couldn't be set (e.g. SQL not applied yet) — the worker is
        // still created; the detail screen will just show no code.
        if (kDebugMode) debugPrint('Worker credential generation failed: $e');
        return created;
      }
    } catch (e) {
      throw Exception('Failed to create worker: $e');
    }
  }

  Future<void> updateWorker(Worker worker) async {
    try {
      await _client.from('workers').update(worker.toJson()).eq('id', worker.id);
    } catch (e) {
      throw Exception('Failed to update worker: $e');
    }
  }

  Future<String> uploadWorkerImage(File file, String path) async {
    try {
      final fileName =
          '${DateTime.now().millisecondsSinceEpoch}_${path.split('/').last}';
      final storagePath = 'workers/$fileName';

      await _client.storage.from('worker_docs').upload(
            storagePath,
            file,
            fileOptions: const FileOptions(cacheControl: '3600', upsert: false),
          );

      final imageUrl =
          _client.storage.from('worker_docs').getPublicUrl(storagePath);
      return imageUrl;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Upload Error: $e');
      }
      throw Exception('Failed to upload image: $e');
    }
  }
}
