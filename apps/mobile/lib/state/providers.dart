import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// Riverpod 3 moved StateProvider / StateNotifierProvider / ChangeNotifierProvider here.
import 'package:flutter_riverpod/legacy.dart';

import '../data/api_client.dart';
import '../data/local_db.dart';
import '../data/notification_service.dart';
import '../data/repository.dart';
import '../data/sync_service.dart';
import '../data/token_store.dart';
import '../models/models.dart';

// ---------- singletons ----------

final tokenStoreProvider = Provider((_) => TokenStore());
final localDbProvider = Provider((_) => LocalDb());

final apiClientProvider = Provider<ApiClient>((ref) {
  final api = ApiClient(ref.watch(tokenStoreProvider));
  api.onSessionExpired = () => ref.read(authProvider.notifier).forceLogout();
  return api;
});

final syncServiceProvider = ChangeNotifierProvider<SyncService>((ref) {
  final s = SyncService(ref.watch(apiClientProvider), ref.watch(localDbProvider));
  ref.onDispose(s.dispose);
  return s;
});

final notificationServiceProvider = Provider<NotificationService>((ref) {
  final s = NotificationService(ref.watch(apiClientProvider), ref.watch(localDbProvider));
  ref.onDispose(s.dispose);
  return s;
});

final repositoryProvider = Provider<Repository>((ref) => Repository(
      ref.watch(apiClientProvider),
      ref.watch(localDbProvider),
      ref.watch(syncServiceProvider),
    ));

// ---------- auth ----------

sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthSignedOut extends AuthState {
  final String? message;
  const AuthSignedOut([this.message]);
}

class AuthSignedIn extends AuthState {
  final SessionUser user;
  const AuthSignedIn(this.user);
}

class AuthController extends StateNotifier<AuthState> {
  final Ref _ref;
  AuthController(this._ref) : super(const AuthLoading());

  Future<void> restore() async {
    final user = await _ref.read(tokenStoreProvider).user;
    final token = await _ref.read(tokenStoreProvider).accessToken;
    if (user != null && token != null) {
      state = AuthSignedIn(user);
      await _afterSignIn();
    } else {
      state = const AuthSignedOut();
    }
  }

  Future<void> login(String email, String password) async {
    final api = _ref.read(apiClientProvider);
    final data = await api.login(email.trim(), password);
    final user = SessionUser.fromJson(data['user'] as Map<String, dynamic>);

    // The app is for teachers and school staff. Anyone else belongs on the web panel.
    if (!user.canRecord) {
      throw const ApiException(403, 'This app is for teachers and administrators.');
    }

    await _ref.read(tokenStoreProvider).save(
          access: data['accessToken'] as String,
          refresh: data['refreshToken'] as String,
          user: user,
        );
    state = AuthSignedIn(user);
    await _afterSignIn();
  }

  Future<void> _afterSignIn() async {
    await _ref.read(syncServiceProvider).start();
    _ref.read(notificationServiceProvider).startPolling();
  }

  Future<void> logout() async {
    _ref.read(notificationServiceProvider).stopPolling();
    await _ref.read(tokenStoreProvider).clear();
    await _ref.read(localDbProvider).clearAll(); // never leak data to the next user
    state = const AuthSignedOut();
  }

  /// Called by the API client when the refresh token is dead.
  void forceLogout() {
    _ref.read(notificationServiceProvider).stopPolling();
    state = const AuthSignedOut('Your session expired. Please sign in again.');
  }
}

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref));

// ---------- data ----------

/// The teacher's working set. `refresh` re-fetches from the server.
final bootstrapProvider = FutureProvider<Bootstrap?>((ref) async {
  return ref.watch(repositoryProvider).bootstrap();
});

final unreadCountProvider = StreamProvider<int>((ref) {
  return ref.watch(notificationServiceProvider).unreadStream;
});

final notificationsProvider = FutureProvider<List<AppNotification>>(
  (ref) => ref.watch(repositoryProvider).notifications(),
);

/// Selected class on the attendance screen.
final selectedClassProvider = StateProvider<String?>((_) => null);
final selectedDateProvider = StateProvider<DateTime>((_) {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day);
});

final themeModeProvider = StateProvider<ThemeMode>((_) => ThemeMode.system);
