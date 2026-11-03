# Push notifications — Kôji

## Architecture

- **Mobile** : `firebase_messaging` + `firebase_core`. Service :
  `mobile/lib/features/notifications/push_service.dart`.
- **Backend** : endpoints `/api/push/register` (enregistrement token) et
  `/api/push/send` (envoi, admin only).
- **Stockage** : table Supabase `device_tokens` (migration 0003).

## Setup requis (manuel)

### Android
1. Créer un projet Firebase.
2. Ajouter l'app Android (`com.koji...`).
3. Télécharger `google-services.json` → `mobile/android/app/`.
4. Ajouter le plugin Google Services dans `android/build.gradle` et
   `android/app/build.gradle`.

### iOS
1. Ajouter l'app iOS dans Firebase.
2. Télécharger `GoogleService-Info.plist` → `mobile/ios/Runner/`.
3. Créer une clé APNs dans Apple Developer et l'uploader dans Firebase Console.
4. Activer les capabilities "Push Notifications" et "Background Modes" (remote
   notifications) dans Xcode.

### Backend (envoi réel)
1. ~~Ajouter `firebase-admin` aux dépendances du projet web.~~ ✅ Fait (package.json).
2. Configurer `FIREBASE_SERVICE_ACCOUNT` (JSON) dans `.env.local`.
3. ~~Implémenter l'envoi dans `/api/push/send`.~~ ✅ Fait (sendEachForMulticast + nettoyage tokens invalides).

## État actuel

- Fondations posées : service mobile, endpoints backend, table DB, migration.
- Envoi réel implémenté dans `/api/push/send` (mode dry-run si `FIREBASE_SERVICE_ACCOUNT` absent).
- Initialisation FCM dans `main.dart` / `main_client.dart` à faire.
- Tests sur appareil réel requis.

## Prochaines étapes

- [ ] Ajouter `firebase-admin` aux dépendances web.
- [ ] Implémenter l'envoi réel dans `/api/push/send`.
- [ ] Initialiser `PushNotificationService` au démarrage de l'app.
- [ ] Enregistrer le token après login (appeler `registerToken`).
- [ ] Afficher les notifications foreground via `flutter_local_notifications`.
- [ ] Tester sur appareil réel (Android + iOS).
