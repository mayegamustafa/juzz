import 'package:intl/intl.dart';

import '../models/models.dart';
import 'api_client.dart';
import 'local_db.dart';
import 'sync_service.dart';

final _ymd = DateFormat('yyyy-MM-dd');

/// Offline-first data access.
///
/// Reads serve the cache immediately and refresh from the network when possible.
/// Writes go through [SyncService], so they succeed with or without a connection.
class Repository {
  final ApiClient _api;
  final LocalDb _db;
  final SyncService _sync;

  Repository(this._api, this._db, this._sync);

  static const _bootstrapKey = 'bootstrap';

  /// The teacher's whole working set. [forceRefresh] bypasses the cache.
  Future<Bootstrap?> bootstrap({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _db.getCache(_bootstrapKey);
      if (cached != null) {
        // Serve cache now, refresh in the background.
        _refreshBootstrap();
        return Bootstrap.fromJson(cached as Map<String, dynamic>);
      }
    }
    return _refreshBootstrap();
  }

  Future<Bootstrap?> _refreshBootstrap() async {
    try {
      final data = await _api.get('/sync/bootstrap') as Map<String, dynamic>;
      await _db.putCache(_bootstrapKey, data);
      return Bootstrap.fromJson(data);
    } on OfflineException {
      final cached = await _db.getCache(_bootstrapKey);
      return cached == null ? null : Bootstrap.fromJson(cached as Map<String, dynamic>);
    }
  }

  Future<DateTime?> lastSyncedAt() => _db.cacheAge(_bootstrapKey);

  // ---------- writes (offline-safe) ----------

  /// Mark/unmark a surah as memorized. The grid cell is a true upsert server-side.
  Future<void> setMemorization({
    required String studentId,
    required String surahId,
    required bool memorized,
  }) =>
      _sync.submit('PUT', '/quran/memorization', {
        'studentId': studentId,
        'surahId': surahId,
        'fraction': memorized ? 1 : 0,
      });

  Future<void> addRevision({
    required String studentId,
    String? surahId,
    int? performanceScore,
  }) =>
      _sync.submit('POST', '/quran/revision', {
        'studentId': studentId,
        'surahId': ?surahId,
        'performanceScore': ?performanceScore,
      });

  Future<void> addAssessment({
    required String studentId,
    required String grade,
    int? score,
  }) =>
      _sync.submit('POST', '/quran/assessment', {
        'studentId': studentId,
        'grade': grade,
        'score': ?score,
      });

  Future<void> addMistake({
    required String studentId,
    required String type,
    int count = 1,
    String? surahId,
  }) =>
      _sync.submit('POST', '/quran/mistakes', {
        'studentId': studentId,
        'type': type,
        'count': count,
        'surahId': ?surahId,
      });

  Future<void> addRemark({required String studentId, required String body}) =>
      _sync.submit('POST', '/students/$studentId/remarks', {'body': body});

  Future<void> setAttendance({
    required String studentId,
    required DateTime date,
    required AttendanceStatus status,
  }) =>
      _sync.submit('PUT', '/attendance', {
        'studentId': studentId,
        'date': _ymd.format(date),
        'status': status.wire,
      });

  // ---------- reads (network, cached where useful) ----------

  Future<List<AttendanceRow>> attendanceSheet(String classId, DateTime date) async {
    final key = 'attendance_${classId}_${_ymd.format(date)}';
    try {
      final data = await _api.get('/attendance', query: {
        'classId': classId,
        'date': _ymd.format(date),
      }) as Map<String, dynamic>;
      await _db.putCache(key, data);
      return _rows(data);
    } on OfflineException {
      final cached = await _db.getCache(key);
      if (cached == null) throw const OfflineException('Attendance unavailable offline');
      return _rows(cached as Map<String, dynamic>);
    }
  }

  List<AttendanceRow> _rows(Map<String, dynamic> data) =>
      ((data['students'] as List?) ?? const [])
          .map((e) => AttendanceRow(
                studentId: e['id'] as String,
                fullName: e['fullName'] as String,
                status: AttendanceStatus.tryParse(e['status'] as String?),
              ))
          .toList();

  Future<List<RecordEntry>> revisions(String studentId) async =>
      _entries('/students/$studentId/revisions', 'rev_$studentId', (j) {
        final s = j['surah'] as Map<String, dynamic>?;
        final label = s != null
            ? '${s['number']}. ${s['nameTransliteration']}'
            : (j['juz'] != null ? 'Juz ${j['juz']}' : 'General revision');
        final score = j['performanceScore'];
        return RecordEntry(
          id: j['id'] as String,
          label: label,
          detail: score == null ? null : '$score/100',
          date: DateTime.tryParse('${j['revisedAt']}') ?? DateTime.now(),
        );
      });

  Future<List<RecordEntry>> assessments(String studentId) async =>
      _entries('/students/$studentId/assessments', 'ass_$studentId', (j) {
        final score = j['score'];
        return RecordEntry(
          id: j['id'] as String,
          label: '${j['grade'] ?? '—'}'.replaceAll('_', ' '),
          detail: score == null ? null : '$score/100',
          date: DateTime.tryParse('${j['assessedAt']}') ?? DateTime.now(),
        );
      });

  Future<List<RecordEntry>> mistakes(String studentId) async =>
      _entries('/students/$studentId/mistakes', 'mis_$studentId', (j) {
        final s = j['surah'] as Map<String, dynamic>?;
        return RecordEntry(
          id: j['id'] as String,
          label: '${j['type']}',
          detail: [
            '×${j['count']}',
            if (s != null) '${s['number']}. ${s['nameTransliteration']}',
          ].join(' · '),
          date: DateTime.tryParse('${j['occurredAt']}') ?? DateTime.now(),
        );
      });

  Future<List<RecordEntry>> remarks(String studentId) async =>
      _entries('/students/$studentId/remarks', 'rem_$studentId', (j) {
        final author = j['author'] as Map<String, dynamic>?;
        return RecordEntry(
          id: j['id'] as String,
          label: j['body'] as String? ?? '',
          detail: author?['fullName'] as String?,
          date: DateTime.tryParse('${j['createdAt']}') ?? DateTime.now(),
        );
      });

  Future<List<RecordEntry>> attendanceHistory(String studentId) async =>
      _entries('/attendance/student/$studentId', 'att_$studentId', (j) {
        final d = DateTime.tryParse('${j['date']}') ?? DateTime.now();
        return RecordEntry(
          id: j['id'] as String,
          label: '${j['status']}',
          detail: DateFormat('EEE, d MMM yyyy').format(d),
          date: d,
        );
      });

  /// Fetch a list endpoint, caching the raw payload so it still renders offline.
  Future<List<RecordEntry>> _entries(
    String path,
    String cacheKey,
    RecordEntry Function(Map<String, dynamic>) map,
  ) async {
    try {
      final data = await _api.get(path) as List;
      await _db.putCache(cacheKey, data);
      return data.map((e) => map(e as Map<String, dynamic>)).toList();
    } on OfflineException {
      final cached = await _db.getCache(cacheKey) as List?;
      if (cached == null) return const [];
      return cached.map((e) => map((e as Map).cast<String, dynamic>())).toList();
    }
  }

  Future<List<AppNotification>> notifications() async {
    try {
      final data = await _api.get('/notifications', query: {'limit': 50}) as List;
      await _db.putCache('notifications', data);
      return data.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
    } on OfflineException {
      final cached = await _db.getCache('notifications') as List?;
      if (cached == null) return const [];
      return cached.map((e) => AppNotification.fromJson((e as Map).cast<String, dynamic>())).toList();
    }
  }
}
