import 'dart:async';
import 'package:dio/dio.dart';
import '../core/config.dart';
import 'token_store.dart';

/// Thrown when a request could not reach the server (as opposed to being
/// rejected by it). Callers use this to decide whether to queue the write.
class OfflineException implements Exception {
  final String message;
  const OfflineException([this.message = 'No connection']);
  @override
  String toString() => message;
}

class ApiException implements Exception {
  final int? status;
  final String message;
  const ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  final Dio _dio;
  final TokenStore _tokens;

  /// Invoked when the refresh token is dead — the session is unrecoverable.
  void Function()? onSessionExpired;

  Completer<bool>? _refreshing;

  ApiClient(this._tokens, {Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 20),
              // We inspect status codes ourselves so 4xx doesn't throw before
              // the refresh interceptor can act.
              validateStatus: (s) => s != null && s < 500,
            )) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokens.accessToken;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
      ),
    );
  }

  Dio get raw => _dio;

  bool _isNetworkError(DioException e) =>
      e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.sendTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.unknown;

  /// Refreshes at most once even if several requests 401 at the same time.
  Future<bool> _refresh() {
    if (_refreshing != null) return _refreshing!.future;
    final c = _refreshing = Completer<bool>();

    () async {
      try {
        final rt = await _tokens.refreshToken;
        if (rt == null) return c.complete(false);

        // A bare Dio: the interceptor above would attach the dead access token.
        final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl))
            .post('/auth/refresh', data: {'refreshToken': rt});

        final data = res.data as Map<String, dynamic>;
        await _tokens.saveTokens(
          access: data['accessToken'] as String,
          refresh: data['refreshToken'] as String,
        );
        c.complete(true);
      } catch (_) {
        c.complete(false);
      } finally {
        _refreshing = null;
      }
    }();

    return c.future;
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    String? idempotencyKey,
    bool retrying = false,
  }) async {
    try {
      final res = await _dio.request(
        path,
        data: body,
        queryParameters: query,
        options: Options(
          method: method,
          headers: idempotencyKey == null ? null : {'Idempotency-Key': idempotencyKey},
        ),
      );

      final code = res.statusCode ?? 0;

      if (code == 401 && !retrying) {
        if (await _refresh()) {
          return _send(method, path,
              body: body, query: query, idempotencyKey: idempotencyKey, retrying: true);
        }
        await _tokens.clear();
        onSessionExpired?.call();
        throw const ApiException(401, 'Session expired. Please sign in again.');
      }

      if (code >= 400) {
        throw ApiException(code, _messageOf(res.data) ?? 'Request failed ($code)');
      }
      return res.data;
    } on DioException catch (e) {
      if (_isNetworkError(e)) throw const OfflineException();
      throw ApiException(e.response?.statusCode, _messageOf(e.response?.data) ?? e.message ?? 'Network error');
    }
  }

  String? _messageOf(dynamic data) {
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      return m is List ? m.join(', ') : '$m';
    }
    return null;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);

  Future<dynamic> post(String path, Object body, {String? idempotencyKey}) =>
      _send('POST', path, body: body, idempotencyKey: idempotencyKey);

  Future<dynamic> put(String path, Object body, {String? idempotencyKey}) =>
      _send('PUT', path, body: body, idempotencyKey: idempotencyKey);

  Future<dynamic> patch(String path, Object body, {String? idempotencyKey}) =>
      _send('PATCH', path, body: body, idempotencyKey: idempotencyKey);

  Future<dynamic> delete(String path) => _send('DELETE', path);

  /// Login uses a clean client — there is no session to attach or refresh yet.
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final res = await Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 12),
        validateStatus: (s) => s != null && s < 500,
      )).post('/auth/login', data: {'email': email, 'password': password});

      if ((res.statusCode ?? 0) >= 400) {
        throw ApiException(res.statusCode, _messageOf(res.data) ?? 'Invalid email or password');
      }
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (_isNetworkError(e)) throw const OfflineException();
      throw ApiException(e.response?.statusCode, _messageOf(e.response?.data) ?? 'Login failed');
    }
  }
}
