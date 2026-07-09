import 'dart:convert';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// A queued mutation. `id` doubles as the server-side `Idempotency-Key`, so a
/// retry after a lost response can never create a duplicate record.
class OutboxOp {
  final String id;
  final String method;
  final String path;
  final Map<String, dynamic> body;
  final int tries;
  final String? lastError;
  final DateTime createdAt;

  const OutboxOp({
    required this.id,
    required this.method,
    required this.path,
    required this.body,
    this.tries = 0,
    this.lastError,
    required this.createdAt,
  });

  factory OutboxOp.fromRow(Map<String, dynamic> r) => OutboxOp(
        id: r['id'] as String,
        method: r['method'] as String,
        path: r['path'] as String,
        body: jsonDecode(r['body'] as String) as Map<String, dynamic>,
        tries: r['tries'] as int? ?? 0,
        lastError: r['lastError'] as String?,
        createdAt: DateTime.fromMillisecondsSinceEpoch(r['createdAt'] as int),
      );
}

/// Local persistence: a key/value cache for read models and a durable outbox
/// for writes made while offline.
class LocalDb {
  Database? _db;

  Future<Database> get db async => _db ??= await _open();

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, 'qpms.db'),
      version: 1,
      onCreate: (d, _) async {
        await d.execute('''
          CREATE TABLE cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updatedAt INTEGER NOT NULL
          )
        ''');
        await d.execute('''
          CREATE TABLE outbox (
            id TEXT PRIMARY KEY,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            body TEXT NOT NULL,
            tries INTEGER NOT NULL DEFAULT 0,
            lastError TEXT,
            createdAt INTEGER NOT NULL
          )
        ''');
        await d.execute('CREATE INDEX idx_outbox_created ON outbox(createdAt)');
      },
    );
  }

  // ---- cache ----

  Future<void> putCache(String key, Object value) async {
    final d = await db;
    await d.insert(
      'cache',
      {
        'key': key,
        'value': jsonEncode(value),
        'updatedAt': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<dynamic> getCache(String key) async {
    final d = await db;
    final rows = await d.query('cache', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    try {
      return jsonDecode(rows.first['value'] as String);
    } catch (_) {
      return null;
    }
  }

  Future<DateTime?> cacheAge(String key) async {
    final d = await db;
    final rows = await d.query('cache', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    return DateTime.fromMillisecondsSinceEpoch(rows.first['updatedAt'] as int);
  }

  // ---- outbox ----

  Future<void> enqueue(OutboxOp op) async {
    final d = await db;
    await d.insert(
      'outbox',
      {
        'id': op.id,
        'method': op.method,
        'path': op.path,
        'body': jsonEncode(op.body),
        'tries': op.tries,
        'lastError': op.lastError,
        'createdAt': op.createdAt.millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Oldest first — replaying in submission order keeps later edits winning.
  Future<List<OutboxOp>> pending({int limit = 100}) async {
    final d = await db;
    final rows = await d.query('outbox', orderBy: 'createdAt ASC', limit: limit);
    return rows.map(OutboxOp.fromRow).toList();
  }

  Future<int> pendingCount() async {
    final d = await db;
    final r = await d.rawQuery('SELECT COUNT(*) AS c FROM outbox');
    return Sqflite.firstIntValue(r) ?? 0;
  }

  Future<void> remove(String id) async {
    final d = await db;
    await d.delete('outbox', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> markFailed(String id, String error, int tries) async {
    final d = await db;
    await d.update(
      'outbox',
      {'lastError': error, 'tries': tries},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Wipe everything on logout — the next user must not see this user's data.
  Future<void> clearAll() async {
    final d = await db;
    await d.delete('cache');
    await d.delete('outbox');
  }
}
