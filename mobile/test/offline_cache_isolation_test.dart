import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:koji/features/offline/offline_cache_service.dart';
import 'package:koji/features/offline/offline_queue.dart';

// Le cache hors-ligne appartient à un seul compte (12 nov) : deux comptes qui
// se succèdent sur le même téléphone ne doivent jamais voir les données
// l'un de l'autre, même sans réseau.
void main() {
  late Directory dir;
  final cache = OfflineCacheService.instance;
  final queue = OfflineQueue.instance;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('koji_offline_test');
    await queue.initialize(path: dir.path);
    await cache.initialize(path: dir.path);
  });

  setUp(() async => cache.clearAll());

  tearDownAll(() async {
    await Hive.close();
    await dir.delete(recursive: true);
  });

  Map<String, dynamic> row(String id) => {'id': id, 'title': 'Devis $id'};

  test('un compte relit son propre cache', () async {
    await cache.cacheDevis([row('d1'), row('d2')], accountId: 'compte-A');
    expect(cache.getCachedDevis(accountId: 'compte-A').map((d) => d['id']), ['d1', 'd2']);
    expect(cache.getCachedDevisById('d1', accountId: 'compte-A')?['title'], 'Devis d1');
  });

  test('un autre compte ne voit rien du cache du précédent', () async {
    await cache.cacheDevis([row('d1')], accountId: 'compte-A');
    await cache.cacheChantiers([row('c1')], accountId: 'compte-A');
    await cache.cacheFournitures([row('f1')], accountId: 'compte-A');
    await cache.cacheClients([row('k1')], accountId: 'compte-A');

    expect(cache.getCachedDevis(accountId: 'compte-B'), isEmpty);
    expect(cache.getCachedChantiers(accountId: 'compte-B'), isEmpty);
    expect(cache.getCachedFournitures(accountId: 'compte-B'), isEmpty);
    expect(cache.getCachedClients(accountId: 'compte-B'), isEmpty);
    expect(cache.getCachedDevisById('d1', accountId: 'compte-B'), isNull);
  });

  test("écrire pour un autre compte efface tout l'ancien cache et sa file d'actions", () async {
    await cache.cacheDevis([row('d1')], accountId: 'compte-A');
    await cache.cacheChantiers([row('c1')], accountId: 'compte-A');
    await queue.enqueueCreateClient({'name': 'client de A'});

    await cache.cacheDevis([row('d9')], accountId: 'compte-B');

    expect(cache.ownerAccountId, 'compte-B');
    expect(cache.getCachedDevis(accountId: 'compte-B').map((d) => d['id']), ['d9']);
    // Les chantiers de A ne sont plus sur le disque, même relus par A.
    expect(cache.getCachedChantiers(accountId: 'compte-A'), isEmpty);
    expect(cache.getCachedChantiers(accountId: 'compte-B'), isEmpty);
    expect(queue.length, 0);
  });

  test('clearAll (déconnexion) efface les 4 types de données et la file', () async {
    await cache.cacheDevis([row('d1')], accountId: 'compte-A');
    await cache.cacheClients([row('k1')], accountId: 'compte-A');
    await cache.cacheChantiers([row('c1')], accountId: 'compte-A');
    await cache.cacheFournitures([row('f1')], accountId: 'compte-A');
    await queue.enqueueApiCall(method: 'post', path: '/api/clients');

    await cache.clearAll();

    expect(cache.ownerAccountId, isNull);
    expect(cache.getCachedDevis(accountId: 'compte-A'), isEmpty);
    expect(cache.getCachedClients(accountId: 'compte-A'), isEmpty);
    expect(cache.getCachedChantiers(accountId: 'compte-A'), isEmpty);
    expect(cache.getCachedFournitures(accountId: 'compte-A'), isEmpty);
    expect(queue.length, 0);
  });

  test('sans compte identifié, rien n’est mis en cache ni relu', () async {
    await cache.cacheDevis([row('d1')], accountId: '');
    expect(cache.ownerAccountId, isNull);
    expect(cache.getCachedDevis(accountId: ''), isEmpty);
  });

  test('mergeDevis reste rangé sous le compte', () async {
    await cache.cacheDevis([row('d1')], accountId: 'compte-A');
    final merged = await cache.mergeDevis([row('d2')], accountId: 'compte-A');
    expect(merged.map((d) => d['id']).toSet(), {'d1', 'd2'});
    expect(cache.getCachedDevis(accountId: 'compte-B'), isEmpty);
  });
}
