import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class TaskCode {
  final String id;
  final String prefix;
  final String? label;
  final bool derived;

  const TaskCode({
    required this.id,
    required this.prefix,
    this.label,
    this.derived = false,
  });

  factory TaskCode.fromMap(Map<String, dynamic> map) => TaskCode(
        id: map['id'] as String,
        prefix: map['prefix'] as String,
        label: map['label'] as String?,
      );
}

class TaskCodeRepository {
  final SupabaseClient _client;
  TaskCodeRepository(this._client);

  Future<List<TaskCode>> getCodes() async {
    final results = await Future.wait([
      _client.from('task_codes').select().order('prefix', ascending: true),
      _client.from('tasks').select('code'),
    ]);

    final saved = (results[0] as List)
        .map((e) => TaskCode.fromMap(e as Map<String, dynamic>))
        .toList();

    final savedPrefixes = saved.map((c) => c.prefix).toSet();
    final prefixRe = RegExp(r'^([A-Z]+)-');
    final derivedPrefixes = <String>{};
    for (final r in (results[1] as List)) {
      final code = (r as Map)['code'] as String?;
      if (code == null) continue;
      final m = prefixRe.firstMatch(code.trim().toUpperCase());
      if (m == null) continue;
      final p = m.group(1)!;
      if (!savedPrefixes.contains(p)) derivedPrefixes.add(p);
    }

    final derived = derivedPrefixes
        .map((p) => TaskCode(id: 'derived:$p', prefix: p, derived: true))
        .toList();

    final all = [...saved, ...derived]
      ..sort((a, b) => a.prefix.compareTo(b.prefix));
    return all;
  }

  Future<TaskCode> addCode(String prefix, {String? label}) async {
    final userId = _client.auth.currentUser!.id;
    final data = await _client
        .from('task_codes')
        .insert({
          'user_id': userId,
          'prefix': prefix.trim().toUpperCase(),
          if (label != null && label.trim().isNotEmpty) 'label': label.trim(),
        })
        .select()
        .single();
    return TaskCode.fromMap(data);
  }

  Future<void> updateCode(String id,
      {required String prefix, String? label}) async {
    await _client.from('task_codes').update({
      'prefix': prefix.trim().toUpperCase(),
      'label': (label == null || label.trim().isEmpty) ? null : label.trim(),
    }).eq('id', id);
  }

  Future<void> deleteCode(String id) async {
    await _client.from('task_codes').delete().eq('id', id);
  }

  /// Look at existing tasks whose code starts with `<prefix>-` and return the
  /// next two-digit suffix. Returns "<prefix>-01" if no siblings exist.
  Future<String> nextCodeFor(String prefix) async {
    final p = prefix.trim().toUpperCase();
    final rows = await _client
        .from('tasks')
        .select('code')
        .like('code', '$p-%');
    int max = 0;
    final suffixRe = RegExp(r'-(\d+)$');
    for (final r in (rows as List)) {
      final code = (r as Map)['code'] as String?;
      if (code == null) continue;
      final m = suffixRe.firstMatch(code);
      if (m == null) continue;
      final n = int.tryParse(m.group(1)!) ?? 0;
      if (n > max) max = n;
    }
    return '$p-${(max + 1).toString().padLeft(2, '0')}';
  }
}

final taskCodeRepositoryProvider = Provider<TaskCodeRepository>((ref) {
  return TaskCodeRepository(Supabase.instance.client);
});

final taskCodesProvider = FutureProvider<List<TaskCode>>((ref) {
  return ref.read(taskCodeRepositoryProvider).getCodes();
});
