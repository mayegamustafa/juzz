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

class SchoolClass {
  final String id;
  final String name;
  final String level;

  const SchoolClass({required this.id, required this.name, required this.level});

  factory SchoolClass.fromJson(Map<String, dynamic> j) => SchoolClass(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        level: j['level'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'level': level};
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

  /// Surah ids this student has memorized. Mutated locally on optimistic edits.
  final Set<String> memorizedSurahIds;
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
    required this.memorizedSurahIds,
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
        memorizedSurahIds: ((j['memorizedSurahIds'] as List?) ?? const [])
            .map((e) => e as String)
            .toSet(),
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
        'memorizedSurahIds': memorizedSurahIds.toList(),
        'memorized': memorized,
        'percent': percent,
      };

  Student copyWith({Set<String>? memorizedSurahIds, int? memorized, double? percent}) => Student(
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
        memorizedSurahIds: memorizedSurahIds ?? this.memorizedSurahIds,
        memorized: memorized ?? this.memorized,
        percent: percent ?? this.percent,
      );
}

/// Everything the app needs to work offline, fetched in one call.
class Bootstrap {
  final int target;
  final List<Surah> surahs;
  final List<SchoolClass> classes;
  final List<Student> students;

  const Bootstrap({
    required this.target,
    required this.surahs,
    required this.classes,
    required this.students,
  });

  factory Bootstrap.fromJson(Map<String, dynamic> j) => Bootstrap(
        target: _int(j['target']),
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

class RecordEntry {
  final String id;
  final String label;
  final String? detail;
  final DateTime date;

  const RecordEntry({
    required this.id,
    required this.label,
    this.detail,
    required this.date,
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

  const AttendanceRow({required this.studentId, required this.fullName, this.status});

  AttendanceRow copyWith({AttendanceStatus? status}) =>
      AttendanceRow(studentId: studentId, fullName: fullName, status: status ?? this.status);
}
