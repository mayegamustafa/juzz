/// Build-time configuration.
///
/// Override per environment without touching code:
///   flutter run --dart-define=API_BASE_URL=https://api.qpms.example/api
class AppConfig {
  /// `10.0.2.2` is the Android emulator's alias for the host machine's localhost.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4010/api',
  );

  /// How often to poll the server for new notifications while the app is open.
  static const notificationPollInterval = Duration(seconds: 60);

  /// How often the outbox retries while the device is online.
  static const syncInterval = Duration(seconds: 30);

  static const appName = 'QPMS Teacher';
}
