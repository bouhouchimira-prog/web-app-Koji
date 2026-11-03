import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import 'offline_queue.dart';

/// Drains the [OfflineQueue] when connectivity returns.
///
/// Currently a skeleton: it listens to connectivity changes and logs them.
/// The actual replay of queued actions (calling the right repository methods
/// per action type) must be implemented per action type — see the TODOs.
class SyncWorker {
  SyncWorker._();
  static final SyncWorker instance = SyncWorker._();

  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _running = false;

  void start() {
    if (_running) return;
    _running = true;
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) _drain();
    });
    // Try once at start.
    _drain();
  }

  Future<void> _drain() async {
    await OfflineQueue.instance.initialize();
    final pending = OfflineQueue.instance.pending();
    if (pending.isEmpty) return;
    debugPrint('SyncWorker: ${pending.length} action(s) en attente');
    for (final action in pending) {
      try {
        // TODO: dispatch par action['type'] vers le repository adequat.
        // Ex: if (action['type'] == 'create_quote') { await quoteRepo.create(...); }
        // Pour l'instant on ne fait rien d'automatique pour eviter des
        // effets de bord ; on logge seulement.
        debugPrint('SyncWorker: action ${action['id']} (${action['type']}) en attente d implementation');
      } catch (e) {
        debugPrint('SyncWorker: erreur sur ${action['id']}: $e');
        await OfflineQueue.instance.incrementRetry(action['id'] as String);
      }
    }
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
    _running = false;
  }
}
