import 'package:hive_flutter/hive_flutter.dart';

import 'offline_queue.dart';

/// Read-only offline cache for the most consulted data (devis, clients,
/// chantiers, fournitures).
///
/// Uses Hive (key-value, no native setup) so it works on all platforms.
/// Write operations are NOT cached here — they go through the network and
/// are queued separately (see [OfflineQueue]).
///
/// Le cache appartient à UN compte (12 nov) : chaque lecture et chaque
/// écriture passe l'identifiant du compte connecté. Avant, le cache n'était
/// jamais vidé à la déconnexion et ne regardait pas le compte : sur un même
/// téléphone, hors-ligne, un compte pouvait voir les devis du précédent.
/// - lecture pour un autre compte que le propriétaire → liste vide ;
/// - écriture pour un autre compte → tout l'ancien cache (et la file
///   d'actions hors-ligne de l'ancien compte) est effacé d'abord ;
/// - déconnexion → [clearAll].
class OfflineCacheService {
  OfflineCacheService._();
  static final OfflineCacheService instance = OfflineCacheService._();

  static const _boxDevis = 'cache_devis';
  static const _boxClients = 'cache_clients';
  static const _boxChantiers = 'cache_chantiers';
  static const _boxFournitures = 'cache_fournitures';
  static const _boxMeta = 'cache_meta';
  static const _ownerKey = 'owner_account_id';

  bool _initialized = false;

  /// [path] : uniquement pour les tests (Hive.init sur un dossier temporaire,
  /// sans path_provider). L'app passe toujours par Hive.initFlutter.
  Future<void> initialize({String? path}) async {
    if (_initialized) return;
    if (path != null) {
      Hive.init(path);
    } else {
      await Hive.initFlutter();
    }
    await Hive.openBox(_boxDevis);
    await Hive.openBox(_boxClients);
    await Hive.openBox(_boxChantiers);
    await Hive.openBox(_boxFournitures);
    await Hive.openBox(_boxMeta);
    _initialized = true;
  }

  Box get _devisBox => Hive.box(_boxDevis);
  Box get _clientsBox => Hive.box(_boxClients);
  Box get _chantiersBox => Hive.box(_boxChantiers);
  Box get _fournituresBox => Hive.box(_boxFournitures);
  Box get _metaBox => Hive.box(_boxMeta);

  // --- Propriétaire du cache ---

  /// Le compte à qui appartient le cache, ou null s'il est vide.
  String? get ownerAccountId => _metaBox.get(_ownerKey) as String?;

  bool _ownedBy(String accountId) =>
      accountId.isNotEmpty && ownerAccountId == accountId;

  /// Rattache le cache à [accountId] avant une écriture : si un autre compte
  /// en était propriétaire, tout son contenu est effacé d'abord.
  Future<void> _bindTo(String accountId) async {
    if (ownerAccountId == accountId) return;
    await clearAll();
    await _metaBox.put(_ownerKey, accountId);
  }

  List<Map<String, dynamic>> _read(Box box, String accountId) {
    if (!_ownedBy(accountId)) return const [];
    return box.values.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> _write(
    Box box,
    String metaKey,
    List<Map<String, dynamic>> rows,
    String accountId,
  ) async {
    // Sans compte identifié on ne met rien en cache (ces écritures sont
    // lancées sans attendre le résultat : pas d'exception ici).
    if (accountId.isEmpty) return;
    await _bindTo(accountId);
    await box.clear();
    for (final row in rows) {
      final id = row['id']?.toString();
      if (id != null) await box.put(id, row);
    }
    await _metaBox.put('${metaKey}_cached_at', DateTime.now().toIso8601String());
  }

  // --- Devis ---

  Future<void> cacheDevis(List<Map<String, dynamic>> devis, {required String accountId}) =>
      _write(_devisBox, 'devis', devis, accountId);

  List<Map<String, dynamic>> getCachedDevis({required String accountId}) =>
      _read(_devisBox, accountId);

  Map<String, dynamic>? getCachedDevisById(String id, {required String accountId}) {
    if (!_ownedBy(accountId)) return null;
    final v = _devisBox.get(id);
    return v == null ? null : Map<String, dynamic>.from(v as Map);
  }

  /// Merge server data with cache using last-write-wins (by updatedAt/createdAt).
  /// Returns the merged list. Useful when reconnecting after offline edits.
  Future<List<Map<String, dynamic>>> mergeDevis(
    List<Map<String, dynamic>> serverDevis, {
    required String accountId,
  }) async {
    await initialize();
    final cached = getCachedDevis(accountId: accountId);
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
    await cacheDevis(merged, accountId: accountId);
    return merged;
  }

  // --- Clients ---

  Future<void> cacheClients(List<Map<String, dynamic>> clients, {required String accountId}) =>
      _write(_clientsBox, 'clients', clients, accountId);

  List<Map<String, dynamic>> getCachedClients({required String accountId}) =>
      _read(_clientsBox, accountId);

  // --- Chantiers ---

  Future<void> cacheChantiers(List<Map<String, dynamic>> chantiers, {required String accountId}) =>
      _write(_chantiersBox, 'chantiers', chantiers, accountId);

  List<Map<String, dynamic>> getCachedChantiers({required String accountId}) =>
      _read(_chantiersBox, accountId);

  // --- Fournitures ---

  Future<void> cacheFournitures(List<Map<String, dynamic>> fournitures, {required String accountId}) =>
      _write(_fournituresBox, 'fournitures', fournitures, accountId);

  List<Map<String, dynamic>> getCachedFournitures({required String accountId}) =>
      _read(_fournituresBox, accountId);

  // --- Meta ---

  String? lastCachedAt(String key) => _metaBox.get('${key}_cached_at') as String?;

  /// Efface tout le cache (les 4 types de données + le propriétaire) et la
  /// file d'actions hors-ligne : appelé à la déconnexion et au changement de
  /// compte. Avant le 12 nov, chantiers et fournitures n'étaient pas effacés.
  Future<void> clearAll() async {
    await initialize();
    await _devisBox.clear();
    await _clientsBox.clear();
    await _chantiersBox.clear();
    await _fournituresBox.clear();
    await _metaBox.clear();
    await OfflineQueue.instance.initialize();
    await OfflineQueue.instance.clear();
  }
}
