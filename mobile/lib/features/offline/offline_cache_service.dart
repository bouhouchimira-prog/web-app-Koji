import 'package:hive_flutter/hive_flutter.dart';

/// Read-only offline cache for the most consulted data (devis, clients,
/// chantiers, fournitures).
///
/// The cache is now scoped to a single user id. A cache belonging to another
/// account is cleared before being reused, so a network error cannot expose
/// the previous user's devis or clients on a shared device. Callers must pass
/// the current user id to [initialize]; without it the cache is not written
/// and reads return an empty list.
class OfflineCacheService {
  OfflineCacheService._();
  static final OfflineCacheService instance = OfflineCacheService._();

  static const _boxDevis = 'cache_devis';
  static const _boxClients = 'cache_clients';
  static const _boxChantiers = 'cache_chantiers';
  static const _boxFournitures = 'cache_fournitures';
  static const _boxMeta = 'cache_meta';
  static const _ownerKey = 'cache_owner_user_id';

  bool _initialized = false;
  String? _userId;

  Future<void> initialize({String? userId}) async {
    if (!_initialized) {
      await Hive.initFlutter();
      await Hive.openBox(_boxDevis);
      await Hive.openBox(_boxClients);
      await Hive.openBox(_boxChantiers);
      await Hive.openBox(_boxFournitures);
      await Hive.openBox(_boxMeta);
      _initialized = true;
    }

    if (userId != null && userId != _userId) {
      await clearAll();
      _userId = userId;
      await _metaBox.put(_ownerKey, userId);
    } else if (userId != null) {
      _userId = userId;
      await _metaBox.put(_ownerKey, userId);
    } else {
      _userId ??= _metaBox.get(_ownerKey) as String?;
    }
  }

  bool get _isOwner => _userId != null && _metaBox.get(_ownerKey) == _userId;

  Box get _devisBox => Hive.box(_boxDevis);
  Box get _clientsBox => Hive.box(_boxClients);
  Box get _chantiersBox => Hive.box(_boxChantiers);
  Box get _fournituresBox => Hive.box(_boxFournitures);
  Box get _metaBox => Hive.box(_boxMeta);

  Future<void> clearAll() async {
    if (!_initialized) await initialize();
    await _devisBox.clear();
    await _clientsBox.clear();
    await _chantiersBox.clear();
    await _fournituresBox.clear();
    await _metaBox.clear();
    _userId = null;
  }

  // --- Devis ---

  Future<void> cacheDevis(List<Map<String, dynamic>> devis) async {
    await initialize();
    if (!_isOwner) return;
    await _devisBox.clear();
    for (final d in devis) {
      final id = d['id']?.toString();
      if (id != null) await _devisBox.put(id, d);
    }
    await _metaBox.put('devis_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedDevis() {
    if (!_initialized || !_isOwner) return const [];
    return _devisBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Map<String, dynamic>? getCachedDevisById(String id) {
    if (!_initialized || !_isOwner) return null;
    final v = _devisBox.get(id);
    return v == null ? null : Map<String, dynamic>.from(v as Map);
  }

  Future<List<Map<String, dynamic>>> mergeDevis(List<Map<String, dynamic>> serverDevis) async {
    await initialize();
    if (!_isOwner) return serverDevis;
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
    await initialize();
    if (!_isOwner) return;
    await _clientsBox.clear();
    for (final c in clients) {
      final id = c['id']?.toString();
      if (id != null) await _clientsBox.put(id, c);
    }
    await _metaBox.put('clients_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedClients() {
    if (!_initialized || !_isOwner) return const [];
    return _clientsBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  // --- Chantiers ---

  Future<void> cacheChantiers(List<Map<String, dynamic>> chantiers) async {
    await initialize();
    if (!_isOwner) return;
    await _chantiersBox.clear();
    for (final c in chantiers) {
      final id = c['id']?.toString();
      if (id != null) await _chantiersBox.put(id, c);
    }
    await _metaBox.put('chantiers_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedChantiers() {
    if (!_initialized || !_isOwner) return const [];
    return _chantiersBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  // --- Fournitures ---

  Future<void> cacheFournitures(List<Map<String, dynamic>> fournitures) async {
    await initialize();
    if (!_isOwner) return;
    await _fournituresBox.clear();
    for (final f in fournitures) {
      final id = f['id']?.toString();
      if (id != null) await _fournituresBox.put(id, f);
    }
    await _metaBox.put('fournitures_cached_at', DateTime.now().toIso8601String());
  }

  List<Map<String, dynamic>> getCachedFournitures() {
    if (!_initialized || !_isOwner) return const [];
    return _fournituresBox.values
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  // --- Meta ---

  String? lastCachedAt(String key) {
    if (!_initialized || !_isOwner) return null;
    return _metaBox.get('${key}_cached_at') as String?;
  }
}
