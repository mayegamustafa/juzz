import 'package:flutter_test/flutter_test.dart';
import 'package:qpms_teacher/models/models.dart';

void main() {
  group('SessionUser', () {
    SessionUser withRole(String role) =>
        SessionUser(id: '1', email: 'a@b.c', fullName: 'Test', role: role);

    test('teachers and admins may record; supervisors and students may not', () {
      expect(withRole('TEACHER').canRecord, isTrue);
      expect(withRole('SCHOOL_ADMIN').canRecord, isTrue);
      expect(withRole('SUPER_ADMIN').canRecord, isTrue);
      expect(withRole('SUPERVISOR').canRecord, isFalse);
      expect(withRole('STUDENT').canRecord, isFalse);
    });
  });

  group('AttendanceStatus', () {
    test('round-trips its wire value', () {
      for (final s in AttendanceStatus.values) {
        expect(AttendanceStatus.tryParse(s.wire), s);
      }
    });

    test('returns null for unknown values', () {
      expect(AttendanceStatus.tryParse('LATE'), isNull);
      expect(AttendanceStatus.tryParse(null), isNull);
    });

    test('labels are title-cased', () {
      expect(AttendanceStatus.present.label, 'Present');
      expect(AttendanceStatus.permission.label, 'Permission');
    });
  });

  group('Bootstrap', () {
    test('parses the /sync/bootstrap payload', () {
      final b = Bootstrap.fromJson({
        'target': 48,
        'surahs': [
          {
            'id': 's1',
            'number': 114,
            'nameTransliteration': 'An-Nas',
            'nameArabic': 'الناس',
            'juz': 30,
            'ayahCount': 6,
          }
        ],
        'classes': [
          {'id': 'c1', 'name': 'P.1 A', 'level': 'P.1'}
        ],
        'students': [
          {
            'id': 'st1',
            'fullName': 'Abir Muhammed',
            'admissionNo': 'CPS-P1-005',
            'classId': 'c1',
            'className': 'P.1 A',
            'level': 'P.1',
            'schoolCode': 'CPS',
            'schoolName': 'Central Primary',
            'memorizedSurahIds': ['s1'],
            'memorized': 1,
            'percent': 2.1,
          }
        ],
      });

      expect(b.target, 48);
      expect(b.surahs.single.name, 'An-Nas');
      expect(b.classes.single.level, 'P.1');
      expect(b.students.single.memorizedSurahIds, contains('s1'));
      expect(b.students.single.percent, closeTo(2.1, 0.001));
    });

    test('tolerates missing optional fields', () {
      final b = Bootstrap.fromJson({'target': 48});
      expect(b.surahs, isEmpty);
      expect(b.students, isEmpty);
      expect(b.classes, isEmpty);
    });
  });

  group('Student.copyWith', () {
    test('replaces only the fields given', () {
      final s = Student(
        id: 'a',
        fullName: 'X',
        admissionNo: '1',
        classId: 'c',
        className: 'P.1',
        level: 'P.1',
        schoolCode: 'CPS',
        schoolName: 'Central',
        memorizedSurahIds: {'s1'},
        memorized: 1,
        percent: 2.0,
      );
      final updated = s.copyWith(memorized: 2, percent: 4.2);
      expect(updated.memorized, 2);
      expect(updated.percent, 4.2);
      expect(updated.fullName, 'X');
      expect(updated.memorizedSurahIds, {'s1'});
    });
  });
}
