import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

/// Handles a push that arrives while the app is backgrounded or terminated.
///
/// Runs in its own isolate, so it must be a top-level function and cannot see
/// anything from the running app. Android draws the notification itself from
/// the message's `notification` block, so there is nothing to do here beyond
/// existing: registering a handler is what lets the OS wake the app at all.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  debugPrint('push received in background: ${message.messageId}');
}

/// Push delivery through Firebase Cloud Messaging.
///
/// This is what makes notifications arrive when the app is closed. The in-app
/// poll only ever ran while the app was open; the OS push service is the only
/// transport that survives the app being swapped away or killed.
///
/// Every step degrades quietly: if Firebase is not configured into the build,
/// or the user declines notifications, [available] stays false and the app
/// keeps working with the existing poll.
class PushService {
  final ApiClient _api;
  final FlutterLocalNotificationsPlugin _local;

  PushService(this._api, this._local);

  bool _available = false;
  String? _token;

  /// Whether push is actually usable: Firebase configured *and* permission granted.
  bool get available => _available;

  /// Set up Firebase and ask for notification permission. Returns false when
  /// push is unavailable for any reason, so the caller can fall back to polling.
  Future<bool> init() async {
    try {
      // Reads google-services.json / GoogleService-Info.plist baked in at build
      // time. Throws when the app was built without Firebase configured.
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Firebase not configured; push disabled: $e');
      return false;
    }

    try {
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

      final messaging = FirebaseMessaging.instance;

      // On Android 13+ and on iOS this shows the OS permission prompt. The user
      // can refuse, and the OS then blocks notifications outright: no app can
      // override that. Refusal is not an error, just a quieter app.
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final granted = settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
      if (!granted) {
        debugPrint('notification permission declined; push disabled');
        return false;
      }

      // Foreground messages are not drawn by the OS, so show them ourselves
      // through the same channel the rest of the app uses.
      FirebaseMessaging.onMessage.listen(_showForeground);

      _available = true;
      return true;
    } catch (e) {
      debugPrint('push setup failed: $e');
      return false;
    }
  }

  /// Hand this device's token to the API so it can be pushed to. Safe to call
  /// on every sign-in; the server upserts on the token.
  Future<void> registerDevice() async {
    if (!_available) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      _token = token;
      await _api.post('/notifications/devices', {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      });

      // FCM rotates tokens; a stale one silently stops receiving.
      FirebaseMessaging.instance.onTokenRefresh.listen((t) async {
        _token = t;
        try {
          await _api.post('/notifications/devices', {
            'token': t,
            'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          });
        } catch (e) {
          debugPrint('token refresh registration failed: $e');
        }
      });
    } catch (e) {
      debugPrint('device registration failed: $e');
    }
  }

  /// Detach this device on sign-out, so the next Sheikh to use a shared phone
  /// does not receive the previous one's notifications.
  Future<void> unregisterDevice() async {
    final token = _token;
    if (token == null) return;
    try {
      await _api.post('/notifications/devices/remove', {'token': token});
    } catch (e) {
      debugPrint('device unregistration failed: $e');
    }
    _token = null;
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final n = message.notification;
    if (n == null) return;
    await _local.show(
      id: message.messageId.hashCode,
      title: n.title ?? 'Juzz Tracking',
      body: n.body ?? '',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'qpms_default',
          'QPMS Alerts',
          channelDescription: 'Targets, announcements and achievements',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(presentAlert: true, presentBadge: true, presentSound: true),
      ),
    );
  }
}
