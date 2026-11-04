import 'package:hive_flutter/hive_flutter.dart';

/// Read-only offline cache for the most consulted data (devis, clients).
///
/// Uses Hive (key-value, no native setup) so it works on all platforms.
/// Write operations are NOT cached here — they go through the network and
/// are queued separately (see OfflineQueue, to be implemented).
class OfflineCacheService {
  OfflineCacheService._();
  static final OfflineCacheService instance = OfflineCacheService._();

  static const _boxDevis = 'cache_devis';
  static const _boxClients = 'cache_clients';
  static const _boxChantiers = 'cache_chantiers';
  static const _boxFournitures = 'cache_fournitures';
  static const _boxMeta = 'cache_meta';

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    await Hive.initFlutter();
    await Hive.openBox(_boxDevis);
    await Hive.openBox(_boxClients);
    await Hive.openBox(_boxChantiers);
    await Hive.openBox(_boxFournitures);
    await Hive.openBox(_boxMeta);
    _initialized = true;
  }

  Box get _devisBox => Hive.box(_boxDevis);
  Box get _clientsBox => Hive.box(_boxClients);
  Box get _metaBox => Hive.box(_boxMeta);

  // --- Devis ---

  Future<void> cacheDevis(List<Map<String, dynamic>> devis) async {
    await _devisBox.clear();
    for (final d in devis) {
      final id = d['id']?.toString();
      if (id != null) await _devisBox.put(id, d);
    }
    await _metaBox.put('devis_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedDevis() {
    return _devisBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Map<String, dynamic>? getCachedDevisById(String id) {
    final v = _devisBox.get(id);
    return v == null ? null : Map<String, dynamic>.from(v as Map);
  }

  /// Merge server data with cache using last-write-wins (by updatedAt/createdAt).
  /// Returns the merged list. Useful when reconnecting after offline edits.
  Future<List<Map<String, dynamic>>> mergeDevis(List<Map<String, dynamic>> serverDevis) async {
    await initialize();
    final cached = getCachedDevis();
    final byId = <String, Map<String, dynamic>>{};
    for (final d in cached) {
      final id = d['id']?.toString();
      if (id != null) byId[id] = d;
    }
    for (final d in serverDevis) {
      final id = d['id']?.toString();
      if (id == null) continue;
      final cached = byId[id];
      if (cached == null) {
        byId[id] = d;
      } else {
        final serverTs = DateTime.tryParse((d['updatedAt'] ?? d['createdAt'] ?? '').toString());
        final cachedTs = DateTime.tryParse((cached['updatedAt'] ?? cached['createdAt'] ?? '').toString());
        if (serverTs == null || cachedTs == null || !cachedTs.isAfter(serverTs)) {
          byId[id] = d;
        }
      }
    }
    final merged = byId.values.toList();
    await cacheDevis(merged);
    return merged;
  }

  // --- Clients ---

  Future<void> cacheClients(List<Map<String, dynamic>> clients) async {
    await _clientsBox.clear();
    for (final c in clients) {
      final id = c['id']?.toString();
      if (id != null) await _clientsBox.put(id, c);
    }
    await _metaBox.put('clients_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedClients() {
    return _clientsBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Box get _chantiersBox => Hive.box(_boxChantiers);

  Future<void> cacheChantiers(List<Map<String, dynamic>> chantiers) async {
    await _chantiersBox.clear();
    for (final c in chantiers) {
      final id = c['id']?.toString();
      if (id != null) await _chantiersBox.put(id, c);
    }
    await _metaBox.put('chantiers_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedChantiers() {
    return _chantiersBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Box get _fournituresBox => Hive.box(_boxFournitures);

  Future<void> cacheFournitures(List<Map<String, dynamic>> fournitures) async {
    await _fournituresBox.clear();
    for (final f in fournitures) {
      final id = f['id']?.toString();
      if (id != null) await _fournituresBox.put(id, f);
    }
    await _metaBox.put('fournitures_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedFournitures() {
    return _fournituresBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  // --- Meta ---

  String? lastCachedAt(String key) => _metaBox.get('${key}_cached_at') as String?;

  Future<void> clearAll() async {
    await _devisBox.clear();
    await _clientsBox.clear();
    await _metaBox.clear();
  }
}
