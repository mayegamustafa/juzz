import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../core/config.dart';
import 'api_client.dart';
import 'local_db.dart';

enum SyncState { idle, syncing, offline, error }

/// Owns the offline write path.
///
/// Writes are always recorded in the outbox first, then drained. That means a
/// teacher in a classroom with no signal records exactly as they would online,
/// and the queue flushes when connectivity returns.
class SyncService extends ChangeNotifier {
  final ApiClient _api;
  final LocalDb _db;
  final Connectivity _connectivity;
  static const _uuid = Uuid();

  SyncState _state = SyncState.idle;
  int _pending = 0;
  bool _online = true;
  Timer? _timer;
  StreamSubscription? _connSub;
  bool _draining = false;

  SyncService(this._api, this._db, {Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity();

  SyncState get state => _state;
  int get pendingCount => _pending;
  bool get isOnline => _online;
  bool get hasPending => _pending > 0;

  Future<void> start() async {
    _online = await _checkOnline();
    await _refreshPending();

    _connSub = _connectivity.onConnectivityChanged.listen((results) {
      final wasOnline = _online;
      _online = !results.contains(ConnectivityResult.none) && results.isNotEmpty;
      if (!wasOnline && _online) {
        drain(); // back online — flush immediately
      } else {
        _setState(_online ? SyncState.idle : SyncState.offline);
      }
    });

    _timer = Timer.periodic(AppConfig.syncInterval, (_) {
      if (_online && _pending > 0) drain();
    });

    if (_online && _pending > 0) unawaited(drain());
  }

  Future<bool> _checkOnline() async {
    final r = await _connectivity.checkConnectivity();
    return r.isNotEmpty && !r.contains(ConnectivityResult.none);
  }

  void _setState(SyncState s) {
    if (_state == s) return;
    _state = s;
    notifyListeners();
  }

  Future<void> _refreshPending() async {
    _pending = await _db.pendingCount();
    notifyListeners();
  }

  /// Queue a mutation. Returns immediately; the UI updates optimistically.
  ///
  /// Tries the network first when online so the common case stays instant and
  /// consistent; on any network failure the op lands in the outbox.
  Future<void> submit(String method, String path, Map<String, dynamic> body) async {
    final op = OutboxOp(
      id: _uuid.v4(), // doubles as the Idempotency-Key
      method: method,
      path: path,
      body: body,
      createdAt: DateTime.now(),
    );
    await _db.enqueue(op);
    await _refreshPending();

    if (_online) {
      unawaited(drain());
    } else {
      _setState(SyncState.offline);
    }
  }

  /// Replay queued ops oldest-first. Stops at the first network failure so
  /// ordering is preserved; permanent (4xx) failures are dropped, not retried
  /// forever.
  Future<void> drain() async {
    if (_draining) return;
    _draining = true;
    _setState(SyncState.syncing);

    try {
      final ops = await _db.pending();
      for (final op in ops) {
        try {
          if (op.method == 'PUT') {
            await _api.put(op.path, op.body, idempotencyKey: op.id);
          } else {
            await _api.post(op.path, op.body, idempotencyKey: op.id);
          }
          await _db.remove(op.id);
        } on OfflineException {
          _online = false;
          _setState(SyncState.offline);
          return; // keep the rest queued, in order
        } on ApiException catch (e) {
          final status = e.status ?? 0;
          if (status == 409) {
            // Server already processed this op (idempotency replay) — done.
            await _db.remove(op.id);
          } else if (status >= 400 && status < 500) {
            // Rejected on its merits (validation/permission). Retrying can't help.
            debugPrint('Dropping unsyncable op ${op.path}: ${e.message}');
            await _db.remove(op.id);
          } else {
            await _db.markFailed(op.id, e.message, op.tries + 1);
            _setState(SyncState.error);
            return;
          }
        }
      }
      _setState(SyncState.idle);
    } finally {
      _draining = false;
      await _refreshPending();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _connSub?.cancel();
    super.dispose();
  }
}
