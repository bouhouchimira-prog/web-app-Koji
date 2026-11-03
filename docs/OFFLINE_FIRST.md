# Offline-first — Kôji (mobile)

## État actuel

- Aucun cache local ni queue d'actions hors-ligne.
- L'app mobile dépend du réseau pour toutes les opérations (Supabase direct +
  API web).

## Fondations posées (PR Phase 4)

- `mobile/lib/features/offline/offline_cache_service.dart` : cache read-only
  Hive pour les devis et les clients (`cacheDevis`, `cacheClients`,
  `getCachedDevis`, `getCachedClients`, `getCachedDevisById`, `clearAll`).
- `mobile/lib/features/offline/offline_queue.dart` : queue d'actions hors-ligne
  (enqueue, pending, remove, incrementRetry, clear).

## Prochaines étapes

1. Initialiser `OfflineCacheService` et `OfflineQueue` au démarrage de l'app
   (dans `main.dart` / `main_client.dart`).
2. Remplir le cache après chaque fetch réseau (devis, clients).
3. Lire depuis le cache en cas d'erreur réseau (fallback).
4. Implémenter un `SyncWorker` qui draine la queue quand la connectivité
   revient (utiliser `connectivity_plus`).
5. Résolution de conflits (last-write-wins ou merge par champ).
6. Tests sur appareil en mode avion.

## Choix techniques

- **Hive** plutôt que sqflite : pas de setup natif, fonctionne sur toutes les
  plateformes (iOS, Android, web, desktop), API simple.
- Cache read-only d'abord, puis queue d'écriture.
- Pas de sync bidirectionnelle automatique dans cette phase.
