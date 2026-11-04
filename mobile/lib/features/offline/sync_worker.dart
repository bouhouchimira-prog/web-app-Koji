import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import 'offline_queue.dart';

/// Drains the [OfflineQueue] when connectivity returns.
///
/// Handlers are registered per action type via [registerHandler]. Each handler
/// receives the queued action's payload and must throw on failure so the
/// worker can retry (increment retry counter).
///
/// Conflict resolution: last-write-wins based on `updatedAt`/`createdAt`
/// timestamps. If the server version is newer, the local action is dropped
/// and the server version wins.
class SyncWorker {
  SyncWorker._();
  static final SyncWorker instance = SyncWorker._();

  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _running = false;
  final Map<String, Future<void> Function(Map<String, dynamic>)> _handlers = {};

  void registerHandler(String type, Future<void> Function(Map<String, dynamic>) handler) {
    _handlers[type] = handler;
  }

  void start() {
    if (_running) return;
    _running = true;
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) _drain();
    });
    _drain();
  }

  Future<void> _drain() async {
    await OfflineQueue.instance.initialize();
    final pending = OfflineQueue.instance.pending();
    if (pending.isEmpty) return;
    debugPrint('SyncWorker: ${pending.length} action(s) en attente');
    for (final action in pending) {
      final id = action['id'] as String;
      final type = action['type'] as String;
      final payload = Map<String, dynamic>.from(action['payload'] as Map);
      final handler = _handlers[type];
      if (handler == null) {
        debugPrint('SyncWorker: pas de handler pour $type (action $id) — ignore');
        continue;
      }
      try {
        await handler(payload);
        await OfflineQueue.instance.remove(id);
        debugPrint('SyncWorker: action $id ($type) replayee avec succes');
      } catch (e) {
        debugPrint('SyncWorker: erreur sur $id ($type): $e');
        await OfflineQueue.instance.incrementRetry(id);
        // Abandonner apres 5 tentatives
        final retries = (action['retries'] as int? ?? 0) + 1;
        if (retries >= 5) {
          debugPrint('SyncWorker: abandon de $id apres $retries tentatives');
          await OfflineQueue.instance.remove(id);
        }
      }
    }
  }

  /// Resolve a conflict between a local (queued) version and a server version.
  /// Returns true if the local version should win (be applied).
  static bool shouldApplyLocal(Map<String, dynamic> local, Map<String, dynamic> server) {
    final localTs = _parseTs(local['updatedAt'] ?? local['createdAt']);
    final serverTs = _parseTs(server['updatedAt'] ?? server['createdAt']);
    if (localTs == null || serverTs == null) return true; // pas de timestamp → appliquer
    return localTs.isAfter(serverTs); // last-write-wins
  }

  static DateTime? _parseTs(dynamic v) {
    if (v is String) return DateTime.tryParse(v);
    if (v is int) return DateTime.fromMillisecondsSinceEpoch(v);
    return null;
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    _running = false;
  }
}
