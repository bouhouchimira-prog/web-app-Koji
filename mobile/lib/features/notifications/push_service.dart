import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/core/supabase_config.dart';

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
  bool _started = false;

  String? get token => _token;

  /// Initialize FCM, request permission, listen to foreground messages and
  /// register the device token with the backend once the user is signed in.
  Future<String?> initialize() async {
    if (_started) return _token;
    _started = true;
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

      // Refresh du token : on re-enregistre cote backend.
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _token = newToken;
        registerToken();
      });

      // Message recu pendant que l'app est ouverte : notification locale.
      FirebaseMessaging.onMessage.listen((message) {
        final notification = message.notification;
        if (notification != null) {
          NotificationService.instance.notifyPush(
            title: notification.title ?? 'Koji',
            body: notification.body ?? '',
          );
        }
      });

      // Enregistre le token des qu'une session existe (login inclus).
      SupabaseConfig.client.auth.onAuthStateChange.listen((event) {
        if (event.session != null) registerToken();
      });
      if (SupabaseConfig.client.auth.currentSession != null) {
        await registerToken();
      }

      return _token;
    } catch (e) {
      debugPrint('Push init error: $e');
      return null;
    }
  }

  /// Enregistre le token courant aupres de /api/push/register (session
  /// Supabase de l'utilisateur connecte). Sans effet si pas de session.
  Future<void> registerToken() async {
    final token = _token;
    final session = SupabaseConfig.client.auth.currentSession;
    if (token == null || session == null) return;
    try {
      final platform = Platform.isAndroid
          ? 'android'
          : Platform.isIOS
              ? 'ios'
              : 'web';
      final response = await http.post(
        Uri.parse('${KojiWebApiConfig.baseUrl}/api/push/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${session.accessToken}',
        },
        body: jsonEncode({'deviceToken': token, 'platform': platform}),
      );
      if (response.statusCode >= 300) {
        debugPrint('Push register failed: ${response.statusCode} ${response.body}');
      }
    } catch (e) {
      debugPrint('Push register error: $e');
    }
  }
}
