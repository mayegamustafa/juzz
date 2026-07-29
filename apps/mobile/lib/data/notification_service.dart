import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/config.dart';
import '../models/models.dart';
import 'api_client.dart';
import 'local_db.dart';

/// Surfaces server notifications as OS heads-up ("pop-up") notifications.
///
/// Delivery today is poll-driven while the app is running. The backend already
/// exposes a `NotificationChannel` interface, so adding FCM later means
/// registering a device token and letting `_show` handle the incoming payload —
/// no changes to the screens.
class NotificationService {
  final ApiClient _api;
  final LocalDb _db;
  final FlutterLocalNotificationsPlugin _plugin;

  static const _seenKey = 'seen_notification_ids';
  static const _androidChannel = AndroidNotificationChannel(
    'qpms_default',
    'QPMS Alerts',
    description: 'Targets, announcements and achievements',
    importance: Importance.high,
  );

  Timer? _poll;
  int _unread = 0;
  final _unreadController = StreamController<int>.broadcast();

  NotificationService(this._api, this._db, {FlutterLocalNotificationsPlugin? plugin})
      : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  Stream<int> get unreadStream => _unreadController.stream;
  int get unreadCount => _unread;

  /// Shared with [PushService] so a foreground push is drawn through the same
  /// already-initialised channel rather than a second, differently-configured one.
  FlutterLocalNotificationsPlugin get plugin => _plugin;

  Future<void> init() async {
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      ),
    );
    await _plugin.initialize(settings: settings);

    final android =
        _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_androidChannel);
    await android?.requestNotificationsPermission();
  }

  /// Begin polling. Safe to call more than once.
  void startPolling() {
    _poll?.cancel();
    unawaited(check());
    _poll = Timer.periodic(AppConfig.notificationPollInterval, (_) => check());
  }

  void stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  /// Fetch unread notifications; pop up any we have not shown before.
  Future<void> check() async {
    try {
      final data = await _api.get('/notifications', query: {'unread': 'true', 'limit': 20});
      final items = (data as List)
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();

      _unread = items.length;
      _unreadController.add(_unread);

      final seen = ((await _db.getCache(_seenKey)) as List?)?.cast<String>().toSet() ?? <String>{};
      // Oldest first so the newest ends up on top of the shade.
      for (final n in items.reversed) {
        if (seen.contains(n.id)) continue;
        await _show(n);
        seen.add(n.id);
      }
      // Bound the set so it can't grow without limit.
      final trimmed = seen.length > 200 ? seen.toList().sublist(seen.length - 200) : seen.toList();
      await _db.putCache(_seenKey, trimmed);
    } catch (e) {
      // Offline or transient — notifications are not worth surfacing an error for.
      debugPrint('notification poll skipped: $e');
    }
  }

  Future<void> _show(AppNotification n) async {
    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannel.id,
        _androidChannel.name,
        channelDescription: _androidChannel.description,
        importance: Importance.high,
        priority: Priority.high,
        styleInformation: BigTextStyleInformation(n.body),
        ticker: n.title,
      ),
      iOS: const DarwinNotificationDetails(presentAlert: true, presentBadge: true, presentSound: true),
    );
    await _plugin.show(
      id: n.id.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: details,
      payload: n.id,
    );
  }

  Future<void> markAllRead() async {
    await _api.post('/notifications/read-all', const {});
    _unread = 0;
    _unreadController.add(0);
    await _plugin.cancelAll();
  }

  Future<void> markRead(String id) async {
    await _api.post('/notifications/$id/read', const {});
    if (_unread > 0) {
      _unread--;
      _unreadController.add(_unread);
    }
  }

  void dispose() {
    _poll?.cancel();
    _unreadController.close();
  }
}
