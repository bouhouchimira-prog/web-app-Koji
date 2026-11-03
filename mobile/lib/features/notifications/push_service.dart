import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Background message handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background message: ${message.messageId}');
}

/// Service for remote push notifications (FCM).
///
/// Setup required before use:
/// 1. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
///    to the project.
/// 2. Configure APNs key/certificate in Firebase Console.
/// 3. Call [PushNotificationService.initialize] at app startup (after
///    Firebase.initializeApp()).
class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  String? _token;

  String? get token => _token;

  /// Initialize FCM and request permission. Returns the device token (or null).
  Future<String?> initialize() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('Push permission denied');
        return null;
      }

      _token = await FirebaseMessaging.instance.getToken();
      debugPrint('FCM token: $_token');

      // Listen for token refresh
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
        // TODO: send newToken to backend via /api/push/register
      });

      // Foreground messages
      FirebaseMessaging.onMessage.listen((message) {
        debugPrint('Foreground message: ${message.notification?.title}');
        // TODO: show local notification
      });

      return _token;
    } catch (e) {
      debugPrint('Push init error: $e');
      return null;
    }
  }

  /// Register the current token with the backend.
  Future<void> registerToken(String userId, String authToken) async {
    if (_token == null) return;
    // TODO: POST to /api/push/register with { userId, deviceToken: _token, platform }
    debugPrint('Register token for $userId: $_token');
  }
}
