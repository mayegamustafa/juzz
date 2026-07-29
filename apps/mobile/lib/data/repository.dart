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

  /// Set a surah's memorization fraction (0, 0.25, 0.5, 0.75 or 1). The grid
  /// cell is a true upsert server-side, so this also serves as "unmark".
  Future<void> setMemorization({
    required String studentId,
    required String surahId,
    required double fraction,
  }) =>
      _sync.submit('PUT', '/quran/memorization', {
        'studentId': studentId,
        'surahId': surahId,
        'fraction': fraction,
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

  /// A Sheikh registers a pupil straight from their own classroom; the record
  /// is PENDING until the secretariat verifies it. Queued like any other
  /// write, so it captures fine even with no signal.
  Future<void> registerStudent({
    required String classId,
    String? streamId,
    required String admissionNo,
    required String fullName,
    String? gender,
    String? guardianName,
    String? guardianPhone,
  }) =>
      _sync.submit('POST', '/students', {
        'classId': classId,
        'streamId': ?streamId,
        'admissionNo': admissionNo,
        'fullName': fullName,
        'gender': ?gender,
        'guardianName': ?guardianName,
        'guardianPhone': ?guardianPhone,
      });

  // ---------- edit / delete (corrections; online, within the 24h window) ----------
  //
  // Unlike the writes above, these are not queued offline: they are
  // corrections to something already recorded, almost always made in the same
  // session, and the 24h-lock rule the server enforces needs a live response
  // (locked / not-locked / unlocked-by-admin) rather than a silent retry later.

  Future<void> updateRevision(String id, {int? performanceScore, String? note}) =>
      _api.patch('/quran/revision/$id', {'performanceScore': ?performanceScore, 'note': ?note});
  Future<void> removeRevision(String id) => _api.delete('/quran/revision/$id');
  Future<void> unlockRevision(String id) => _api.post('/quran/revision/$id/unlock', const {});

  Future<void> updateAssessment(String id, {String? grade, int? score}) =>
      _api.patch('/quran/assessment/$id', {'grade': ?grade, 'score': ?score});
  Future<void> removeAssessment(String id) => _api.delete('/quran/assessment/$id');
  Future<void> unlockAssessment(String id) => _api.post('/quran/assessment/$id/unlock', const {});

  Future<void> updateMistake(String id, {String? type, int? count}) =>
      _api.patch('/quran/mistakes/$id', {'type': ?type, 'count': ?count});
  Future<void> removeMistake(String id) => _api.delete('/quran/mistakes/$id');
  Future<void> unlockMistake(String id) => _api.post('/quran/mistakes/$id/unlock', const {});

  Future<void> updateRemark(String id, String body) => _api.patch('/remarks/$id', {'body': body});
  Future<void> removeRemark(String id) => _api.delete('/remarks/$id');
  Future<void> unlockRemark(String id) => _api.post('/remarks/$id/unlock', const {});

  Future<void> removeAttendance(String id) => _api.delete('/attendance/$id');
  Future<void> unlockAttendance(String id) => _api.post('/attendance/$id/unlock', const {});

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
                recordId: e['recordId'] as String?,
                canEdit: e['canEdit'] as bool? ?? true,
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
          canEdit: j['canEdit'] as bool? ?? false,
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
          canEdit: j['canEdit'] as bool? ?? false,
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
          canEdit: j['canEdit'] as bool? ?? false,
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
          canEdit: j['canEdit'] as bool? ?? false,
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
          canEdit: j['canEdit'] as bool? ?? false,
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
