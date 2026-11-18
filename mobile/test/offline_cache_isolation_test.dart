import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:koji/features/offline/offline_cache_service.dart';
import 'package:koji/features/offline/offline_queue.dart';

// Le cache hors ligne appartient à un seul compte : deux comptes qui se
// succèdent sur le même téléphone ne doivent jamais voir les données l'un de
// l'autre, même sans réseau. Le compte est donné par initialize(userId: …),
// comme le font les dépôts devis, chantiers, fournitures et client.
void main() {
  late Directory dir;
  final cache = OfflineCacheService.instance;
  final queue = OfflineQueue.instance;

  setUpAll(() async {
    dir = await Directory.systemTemp.createTemp('koji_offline_test');
    await queue.initialize(path: dir.path);
    await cache.initialize(path: dir.path);
  });

  // Chaque test repart d'un téléphone sans compte ni cache.
  setUp(() async => cache.clearAll());

  tearDownAll(() async {
    await Hive.close();
    await dir.delete(recursive: true);
  });

  Map<String, dynamic> row(String id) => {'id': id, 'title': 'Devis $id'};
  Future<void> connecter(String compte) => cache.initialize(userId: compte);

  test('un compte relit son propre cache', () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1'), row('d2')]);

    expect(cache.getCachedDevis().map((d) => d['id']), ['d1', 'd2']);
    expect(cache.getCachedDevisById('d1')?['title'], 'Devis d1');
    expect(cache.lastCachedAt('devis'), isNotNull);
  });

  test('revenir sur le même compte garde son cache', () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1')]);
    await cache.cacheChantiers([row('c1')]);

    // Ce que fait chaque dépôt avant de lire : il redonne le compte courant.
    await connecter('compte-A');
    // Ce que fait l'app au démarrage : elle initialise sans compte.
    await cache.initialize();

    expect(cache.getCachedDevis().map((d) => d['id']), ['d1']);
    expect(cache.getCachedChantiers().map((c) => c['id']), ['c1']);
  });

  test('un autre compte ne voit rien du cache du précédent', () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1')]);
    await cache.cacheChantiers([row('c1')]);
    await cache.cacheFournitures([row('f1')]);
    await cache.cacheClients([row('k1')]);

    await connecter('compte-B');

    expect(cache.getCachedDevis(), isEmpty);
    expect(cache.getCachedChantiers(), isEmpty);
    expect(cache.getCachedFournitures(), isEmpty);
    expect(cache.getCachedClients(), isEmpty);
    expect(cache.getCachedDevisById('d1'), isNull);
    expect(cache.lastCachedAt('devis'), isNull);
  });

  test("changer de compte efface tout l'ancien cache et sa file d'actions", () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1')]);
    await cache.cacheChantiers([row('c1')]);
    await queue.enqueueCreateClient({'name': 'client de A'});

    await connecter('compte-B');
    await cache.cacheDevis([row('d9')]);

    expect(cache.getCachedDevis().map((d) => d['id']), ['d9']);
    expect(queue.length, 0);

    // Les données de A ne sont plus sur le disque, même si A se reconnecte.
    await connecter('compte-A');
    expect(cache.getCachedDevis(), isEmpty);
    expect(cache.getCachedChantiers(), isEmpty);
  });

  test('clearAll (déconnexion) efface les 4 types de données et la file', () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1')]);
    await cache.cacheClients([row('k1')]);
    await cache.cacheChantiers([row('c1')]);
    await cache.cacheFournitures([row('f1')]);
    await queue.enqueueApiCall(method: 'post', path: '/api/clients');

    await cache.clearAll();

    // Déconnecté : plus rien à lire.
    expect(cache.getCachedDevis(), isEmpty);
    expect(queue.length, 0);

    // Et rien ne revient quand le même compte se reconnecte.
    await connecter('compte-A');
    expect(cache.getCachedDevis(), isEmpty);
    expect(cache.getCachedClients(), isEmpty);
    expect(cache.getCachedChantiers(), isEmpty);
    expect(cache.getCachedFournitures(), isEmpty);
  });

  test("sans compte identifié, rien n'est mis en cache ni relu", () async {
    await cache.cacheDevis([row('d1')]);
    await cache.cacheChantiers([row('c1')]);

    expect(cache.getCachedDevis(), isEmpty);
    expect(cache.getCachedChantiers(), isEmpty);

    // Rien n'a été écrit en douce : le premier compte part d'un cache vide.
    await connecter('compte-A');
    expect(cache.getCachedDevis(), isEmpty);
    expect(cache.getCachedChantiers(), isEmpty);
  });

  test('mergeDevis reste rangé sous le compte', () async {
    await connecter('compte-A');
    await cache.cacheDevis([row('d1')]);

    final fusion = await cache.mergeDevis([row('d2')]);
    expect(fusion.map((d) => d['id']).toSet(), {'d1', 'd2'});

    // Un autre compte ne récupère que ce que le serveur lui donne.
    await connecter('compte-B');
    final pourB = await cache.mergeDevis([row('d3')]);
    expect(pourB.map((d) => d['id']).toSet(), {'d3'});
  });
}
