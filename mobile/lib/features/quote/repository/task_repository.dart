import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/features/quote/model/custom_task.dart';

final taskRepositoryProvider =
    Provider((ref) => TaskRepository(Supabase.instance.client));

class TaskRepository {
  final SupabaseClient _supabase;

  TaskRepository(this._supabase);

  /// Fetch all tasks visible to the current user, assembled as parent→children tree.
  Future<List<CustomTask>> getTasks(String profession) async {
    try {
      final response = await _supabase
          .from('tasks')
          .select()
          .order('famille', ascending: true)
          .order('code', ascending: true);

      final all = (response as List).map((e) => CustomTask.fromMap(e)).toList();

      // Deduplicate by id
      final seen = <String>{};
      final unique = all.where((t) => seen.add(t.id)).toList();

      // Build parent→children map
      // Strategy 1: Use parent_id if available
      // Strategy 2: Fallback to code convention (CARSOL-001-01 → parent CARSOL-001)
      final bool hasParentIds = unique.any((t) => t.parentId != null);

      final Map<String, List<CustomTask>> childrenMap = {};

      if (hasParentIds) {
        // DB has parent_id populated
        for (final t in unique) {
          if (t.parentId != null) {
            childrenMap.putIfAbsent(t.parentId!, () => []).add(t);
          }
        }
      } else {
        // Fallback: match by code convention
        // SOUS-POSTEs have codes like CARSOL-001-01, parent is CARSOL-001
        final codeToId = <String, String>{};
        for (final t in unique) {
          if (t.code != null && t.typePoste == 'POSTE') {
            codeToId[t.code!] = t.id;
          }
        }
        for (final t in unique) {
          if (t.code != null && t.typePoste == 'SOUS-POSTE') {
            // Strip last -NN from code to find parent code
            final parentCode = t.code!.replaceAll(RegExp(r'-\d{2}$'), '');
            final parentId = codeToId[parentCode];
            if (parentId != null) {
              childrenMap.putIfAbsent(parentId, () => []).add(t);
            }
          }
        }
      }

      // Attach children to parents, return only top-level tasks
      final parents = unique.where((t) {
        if (hasParentIds) return t.parentId == null;
        return t.typePoste != 'SOUS-POSTE';
      }).map((t) {
        t.subTasks = childrenMap[t.id] ?? [];
        return t;
      }).toList();

      return parents;
    } catch (e) {
      throw Exception('Error fetching tasks: $e');
    }
  }

  Future<CustomTask> createTask({
    required String title,
    String? description,
    required String profession,
    List<File> images = const [],
    Map<String, dynamic> defaultProducts = const {},
    String? code,
    String? famille,
    String? unite,
    double? tempsHU,
    String? parentId,
    String? typePoste,
  }) async {
    try {
      // 1. Auto-generate code if this is a sub-task
      String? finalCode = code;
      if (parentId != null && (code == null || code.trim().isEmpty)) {
        // Count existing children to determine next suffix
        final siblings = await _supabase
            .from('tasks')
            .select('id')
            .eq('parent_id', parentId);
        final count = (siblings as List).length + 1;
        // Fetch parent code
        final parentRow = await _supabase
            .from('tasks')
            .select('code')
            .eq('id', parentId)
            .maybeSingle();
        final parentCode = parentRow?['code'] as String? ?? '';
        finalCode = '$parentCode-${count.toString().padLeft(2, '0')}';
      }

      // 2. Upload images
      final List<String> imageUrls = [];
      for (var image in images) {
        final path =
            'task_${DateTime.now().millisecondsSinceEpoch}_${image.path.split(Platform.pathSeparator).last}';
        await _supabase.storage.from('task_images').upload(path, image);
        final url = _supabase.storage.from('task_images').getPublicUrl(path);
        imageUrls.add(url);
      }

      // 3. Insert task — only columns that exist in the DB
      final taskData = <String, dynamic>{
        'title': title,
        'profession': profession,
        'user_id': _supabase.auth.currentUser!.id,
        'type_poste': parentId != null ? 'SOUS-POSTE' : (typePoste ?? 'POSTE'),
        if (description != null && description.isNotEmpty) 'description': description,
        if (finalCode != null) 'code': finalCode,
        if (famille != null) 'famille': famille,
        if (unite != null) 'unite': unite,
        if (tempsHU != null) 'temps_hu': tempsHU,
        if (parentId != null) 'parent_id': parentId,
        if (imageUrls.isNotEmpty) 'image_urls': imageUrls,
        if (defaultProducts.isNotEmpty) 'default_products': defaultProducts,
      };

      debugPrint('Creating task with data: $taskData');
      final response =
          await _supabase.from('tasks').insert(taskData).select().single();
      debugPrint('Task created: ${response['id']}');
      return CustomTask.fromMap(response);
    } catch (e) {
      debugPrint('ERROR creating task: $e');
      throw Exception('Error creating task: $e');
    }
  }

  Future<void> updateTask({
    required String id,
    String? title,
    String? description,
    String? code,
    String? famille,
    String? unite,
    double? tempsHU,
    // Pass clearDescription: true to explicitly null out an existing
    // commentaire (a null `description` is treated as "leave unchanged").
    bool clearDescription = false,
  }) async {
    final updates = <String, dynamic>{};
    if (title != null) updates['title'] = title;
    if (description != null) {
      updates['description'] = description;
    } else if (clearDescription) {
      updates['description'] = null;
    }
    if (code != null) updates['code'] = code;
    if (famille != null) updates['famille'] = famille;
    if (unite != null) updates['unite'] = unite;
    if (tempsHU != null) updates['temps_hu'] = tempsHU;
    if (updates.isEmpty) return;
    await _supabase.from('tasks').update(updates).eq('id', id);
  }

  /// Delete a task. Sub-tasks linked via parent_id are removed too if the DB
  /// has ON DELETE CASCADE; otherwise we delete them explicitly first.
  Future<void> deleteTask(String id) async {
    // Best-effort cleanup of children in case the FK isn't ON DELETE CASCADE.
    try {
      await _supabase.from('tasks').delete().eq('parent_id', id);
    } catch (_) {/* ignore — children may already be cascaded */}
    await _supabase.from('tasks').delete().eq('id', id);
  }
}
