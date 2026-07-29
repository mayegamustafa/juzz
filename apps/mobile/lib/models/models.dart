/// Plain data models mirroring the API payloads.
library;

int _int(dynamic v) => v is int ? v : int.tryParse('$v') ?? 0;
double _dbl(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

class SessionUser {
  final String id;
  final String email;
  final String fullName;
  final String role;
  final String? schoolName;

  const SessionUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.schoolName,
  });

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
        id: j['id'] as String,
        email: j['email'] as String? ?? '',
        fullName: j['fullName'] as String? ?? '',
        role: j['role'] as String? ?? 'TEACHER',
        schoolName: j['schoolName'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'fullName': fullName,
        'role': role,
        'schoolName': schoolName,
      };

  /// Sheikhs record progress; the secretariat may also correct records.
  bool get canRecord => role == 'TEACHER' || role == 'SUPERVISOR' || role == 'SUPER_ADMIN';

  /// The secretariat: verifies enrolments, unlocks locked entries, always
  /// editable regardless of the 24h window.
  bool get isAdmin => role == 'SUPERVISOR' || role == 'SUPER_ADMIN';
}

class Surah {
  final String id;
  final int number;
  final String name;
  final String nameArabic;
  final int juz;
  final int ayahCount;

  const Surah({
    required this.id,
    required this.number,
    required this.name,
    required this.nameArabic,
    required this.juz,
    required this.ayahCount,
  });

  factory Surah.fromJson(Map<String, dynamic> j) => Surah(
        id: j['id'] as String,
        number: _int(j['number']),
        name: j['nameTransliteration'] as String? ?? '',
        nameArabic: j['nameArabic'] as String? ?? '',
        juz: _int(j['juz']),
        ayahCount: _int(j['ayahCount']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'number': number,
        'nameTransliteration': name,
        'nameArabic': nameArabic,
        'juz': juz,
        'ayahCount': ayahCount,
      };
}

/// A class's stream/section (e.g. "P.1 A"). Named `SchoolStream`, not
/// `Stream`, to avoid colliding with dart:async's Stream type.
class SchoolStream {
  final String id;
  final String name;
  const SchoolStream({required this.id, required this.name});

  factory SchoolStream.fromJson(Map<String, dynamic> j) =>
      SchoolStream(id: j['id'] as String, name: j['name'] as String? ?? '');

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class SchoolClass {
  final String id;
  final String name;
  final String level;
  final List<SchoolStream> streams;

  const SchoolClass({required this.id, required this.name, required this.level, this.streams = const []});

  factory SchoolClass.fromJson(Map<String, dynamic> j) => SchoolClass(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        level: j['level'] as String? ?? '',
        streams: ((j['streams'] as List?) ?? const [])
            .map((e) => SchoolStream.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'level': level,
        'streams': streams.map((s) => s.toJson()).toList(),
      };
}

enum EnrollmentStatus {
  pending('PENDING'),
  approved('APPROVED'),
  rejected('REJECTED');

  const EnrollmentStatus(this.wire);
  final String wire;

  static EnrollmentStatus fromWire(String? v) =>
      values.firstWhere((s) => s.wire == v, orElse: () => EnrollmentStatus.approved);
}

class Student {
  final String id;
  final String fullName;
  final String admissionNo;
  final String? gender;
  final String? guardianName;
  final String? guardianPhone;
  final String classId;
  final String className;
  final String level;
  final String? streamName;
  final String schoolCode;
  final String schoolName;
  final EnrollmentStatus enrollmentStatus;

  /// surahId -> fraction memorized (0..1). A Sheikh may record partial
  /// progress, not just done/not-done. Mutated locally on optimistic edits.
  final Map<String, double> surahFractions;
  final int memorized;
  final double percent;

  Student({
    required this.id,
    required this.fullName,
    required this.admissionNo,
    this.gender,
    this.guardianName,
    this.guardianPhone,
    required this.classId,
    required this.className,
    required this.level,
    this.streamName,
    required this.schoolCode,
    required this.schoolName,
    this.enrollmentStatus = EnrollmentStatus.approved,
    required this.surahFractions,
    required this.memorized,
    required this.percent,
  });

  factory Student.fromJson(Map<String, dynamic> j) => Student(
        id: j['id'] as String,
        fullName: j['fullName'] as String? ?? '',
        admissionNo: j['admissionNo'] as String? ?? '',
        gender: j['gender'] as String?,
        guardianName: j['guardianName'] as String?,
        guardianPhone: j['guardianPhone'] as String?,
        classId: j['classId'] as String? ?? '',
        className: j['className'] as String? ?? '',
        level: j['level'] as String? ?? '',
        streamName: j['streamName'] as String?,
        schoolCode: j['schoolCode'] as String? ?? '',
        schoolName: j['schoolName'] as String? ?? '',
        enrollmentStatus: EnrollmentStatus.fromWire(j['enrollmentStatus'] as String?),
        surahFractions: ((j['surahFractions'] as Map?) ?? const {})
            .map((k, v) => MapEntry(k as String, _dbl(v))),
        memorized: _int(j['memorized']),
        percent: _dbl(j['percent']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'admissionNo': admissionNo,
        'gender': gender,
        'guardianName': guardianName,
        'guardianPhone': guardianPhone,
        'classId': classId,
        'className': className,
        'level': level,
        'streamName': streamName,
        'schoolCode': schoolCode,
        'schoolName': schoolName,
        'enrollmentStatus': enrollmentStatus.wire,
        'surahFractions': surahFractions,
        'memorized': memorized,
        'percent': percent,
      };

  Student copyWith({Map<String, double>? surahFractions, int? memorized, double? percent}) => Student(
        id: id,
        fullName: fullName,
        admissionNo: admissionNo,
        gender: gender,
        guardianName: guardianName,
        guardianPhone: guardianPhone,
        classId: classId,
        className: className,
        level: level,
        streamName: streamName,
        schoolCode: schoolCode,
        schoolName: schoolName,
        enrollmentStatus: enrollmentStatus,
        surahFractions: surahFractions ?? this.surahFractions,
        memorized: memorized ?? this.memorized,
        percent: percent ?? this.percent,
      );
}

/// Everything the app needs to work offline, fetched in one call.
class Bootstrap {
  final int target;
  /// How to address this user: "Shk", "Shkt", or null for the secretariat,
  /// who hold no teaching record.
  final String? title;
  final List<Surah> surahs;
  final List<SchoolClass> classes;
  final List<Student> students;

  const Bootstrap({
    required this.target,
    this.title,
    required this.surahs,
    required this.classes,
    required this.students,
  });

  factory Bootstrap.fromJson(Map<String, dynamic> j) => Bootstrap(
        target: _int(j['target']),
        title: j['title'] as String?,
        surahs: ((j['surahs'] as List?) ?? const [])
            .map((e) => Surah.fromJson(e as Map<String, dynamic>))
            .toList(),
        classes: ((j['classes'] as List?) ?? const [])
            .map((e) => SchoolClass.fromJson(e as Map<String, dynamic>))
            .toList(),
        students: ((j['students'] as List?) ?? const [])
            .map((e) => Student.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'target': target,
        'title': title,
        'surahs': surahs.map((e) => e.toJson()).toList(),
        'classes': classes.map((e) => e.toJson()).toList(),
        'students': students.map((e) => e.toJson()).toList(),
      };
}

class AppNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final DateTime createdAt;
  final DateTime? readAt;

  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.createdAt,
    this.readAt,
  });

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'] as String,
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        type: j['type'] as String? ?? 'INFO',
        createdAt: DateTime.tryParse('${j['createdAt']}') ?? DateTime.now(),
        readAt: j['readAt'] == null ? null : DateTime.tryParse('${j['readAt']}'),
      );
}

/// A school, for scoping an announcement to one of them.
class SchoolOption {
  final String id;
  final String code;
  final String name;

  const SchoolOption({required this.id, required this.code, required this.name});

  factory SchoolOption.fromJson(Map<String, dynamic> j) => SchoolOption(
        id: j['id'] as String,
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
      );
}

/// A pupil a Shk or Shkt registered, waiting on the secretariat to verify it.
class PendingPupil {
  final String id;
  final String fullName;
  final String admissionNo;
  final String? level;
  final String? schoolCode;
  final String? registeredBy;

  const PendingPupil({
    required this.id,
    required this.fullName,
    required this.admissionNo,
    this.level,
    this.schoolCode,
    this.registeredBy,
  });

  factory PendingPupil.fromJson(Map<String, dynamic> j) => PendingPupil(
        id: j['id'] as String,
        fullName: j['fullName'] as String? ?? '',
        admissionNo: j['admissionNo'] as String? ?? '',
        level: (j['schoolClass'] as Map<String, dynamic>?)?['level'] as String?,
        schoolCode: (j['school'] as Map<String, dynamic>?)?['code'] as String?,
        registeredBy: (j['primaryTeacher'] as Map<String, dynamic>?)?['fullName'] as String?,
      );
}

/// A memorization goal for the active term — set by the secretariat, either
/// for the whole organisation/school/class, or aimed at one pupil by name
/// (e.g. "memorize Surah Al-Mulk"). Read-only on mobile; assigning one is an
/// office task done from the web admin.
class StudentTarget {
  final String id;
  final String scope;
  final String unit;
  final double amount;
  final String? description;
  final String termName;

  const StudentTarget({
    required this.id,
    required this.scope,
    required this.unit,
    required this.amount,
    this.description,
    required this.termName,
  });

  factory StudentTarget.fromJson(Map<String, dynamic> j) => StudentTarget(
        id: j['id'] as String,
        scope: j['scope'] as String? ?? 'CLASS',
        unit: j['unit'] as String? ?? 'JUZ',
        amount: double.tryParse('${j['amount']}') ?? 0,
        description: j['description'] as String?,
        termName: (j['term'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      );

  String get unitLabel => switch (unit) {
        'JUZ' => 'Juzu',
        'SURAH' => 'Surah(s)',
        'AYAH' => 'Ayah(s)',
        _ => unit,
      };

  String get scopeLabel => switch (scope) {
        'STUDENT' => 'Personal goal',
        'ORGANIZATION' => 'Organisation goal',
        'SCHOOL' => 'School goal',
        _ => 'Class goal',
      };

  String get amountLabel => amount == amount.roundToDouble() ? amount.toInt().toString() : amount.toString();
}

class RecordEntry {
  final String id;
  final String label;
  final String? detail;
  final DateTime date;
  /// Whether the current user may still edit/delete this entry: they recorded
  /// it less than 24h ago (or the secretariat unlocked it), or they are the
  /// secretariat themselves.
  final bool canEdit;

  const RecordEntry({
    required this.id,
    required this.label,
    this.detail,
    required this.date,
    this.canEdit = false,
  });
}

enum AttendanceStatus {
  present('PRESENT'),
  absent('ABSENT'),
  sick('SICK'),
  permission('PERMISSION');

  const AttendanceStatus(this.wire);
  final String wire;

  static AttendanceStatus? tryParse(String? v) {
    for (final s in values) {
      if (s.wire == v) return s;
    }
    return null;
  }

  String get label => '${wire[0]}${wire.substring(1).toLowerCase()}';
}

class AttendanceRow {
  final String studentId;
  final String fullName;
  final AttendanceStatus? status;
  final String? recordId;
  final bool canEdit;

  const AttendanceRow({
    required this.studentId,
    required this.fullName,
    this.status,
    this.recordId,
    this.canEdit = true,
  });

  AttendanceRow copyWith({AttendanceStatus? status}) => AttendanceRow(
        studentId: studentId,
        fullName: fullName,
        status: status ?? this.status,
        recordId: recordId,
        canEdit: canEdit,
      );
}

/// One Shk or Shkt's standing in the org-wide ranking, as the secretariat
/// sees it: how their roster is doing on average, not their own progress.
class StaffRanking {
  final String id;
  final String name;
  final int pupils;
  final double avgPercent;
  final int? avgScore;

  const StaffRanking({
    required this.id,
    required this.name,
    required this.pupils,
    required this.avgPercent,
    this.avgScore,
  });

  factory StaffRanking.fromJson(Map<String, dynamic> j) => StaffRanking(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        pupils: _int(j['students']),
        avgPercent: _dbl(j['avgPercent']),
        avgScore: j['avgScore'] == null ? null : _int(j['avgScore']),
      );
}
