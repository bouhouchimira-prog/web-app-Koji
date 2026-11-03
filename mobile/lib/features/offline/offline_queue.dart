import 'package:hive_flutter/hive_flutter.dart';

/// Queue of pending write actions performed while offline.
/// Each action is stored as a JSON map: { id, type, payload, createdAt, retries }.
/// A sync worker (to be implemented) drains this queue when connectivity returns.
class OfflineQueue {
  OfflineQueue._();
  static final OfflineQueue instance = OfflineQueue._();

  static const _box = 'offline_queue';

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    await Hive.initFlutter();
    await Hive.openBox(_box);
    _initialized = true;
  }

  Box get _q => Hive.box(_box);

  Future<String> enqueue(String type, Map<String, dynamic> payload) async {
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    await _q.put(id, {
      'id': id,
      'type': type,
      'payload': payload,
      'createdAt': DateTime.now().toIso8601String(),
      'retries': 0,
    });
    return id;
  }

  List<Map<String, dynamic>> pending() {
    return _q.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList()
      ..sort((a, b) => (a['createdAt'] as String).compareTo(b['createdAt'] as String));
  }

  Future<void> remove(String id) async => _q.delete(id);

  Future<void> incrementRetry(String id) async {
    final v = _q.get(id);
    if (v == null) return;
    final m = Map<String, dynamic>.from(v as Map);
    m['retries'] = (m['retries'] as int? ?? 0) + 1;
    await _q.put(id, m);
  }

  int get length => _q.length;

  Future<void> clear() async => _q.clear();
}
