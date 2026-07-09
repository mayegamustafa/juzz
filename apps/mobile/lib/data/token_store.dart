import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

/// Tokens live in the platform keystore/keychain, never in plain preferences.
class TokenStore {
  static const _access = 'qpms_access';
  static const _refresh = 'qpms_refresh';
  static const _user = 'qpms_user';

  final FlutterSecureStorage _s;

  TokenStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();

  Future<String?> get accessToken => _s.read(key: _access);
  Future<String?> get refreshToken => _s.read(key: _refresh);

  Future<SessionUser?> get user async {
    final raw = await _s.read(key: _user);
    if (raw == null) return null;
    try {
      return SessionUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> save({
    required String access,
    required String refresh,
    required SessionUser user,
  }) async {
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
    await _s.write(key: _user, value: jsonEncode(user.toJson()));
  }

  Future<void> saveTokens({required String access, required String refresh}) async {
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    await _s.delete(key: _access);
    await _s.delete(key: _refresh);
    await _s.delete(key: _user);
  }
}
