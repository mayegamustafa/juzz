import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';
import { titleOf } from '../common/teacher-title';

/**
 * One-shot hydration for the mobile app. On a poor connection we want a single
 * round-trip that carries everything the teacher needs to work fully offline.
 */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  private async studentScope(user: AuthUser): Promise<Prisma.StudentWhereInput> {
    if (isOrgWide(user)) return { school: { organizationId: user.organizationId } };
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    return { primaryTeacherId: teacher?.id ?? '__none__' };
  }

  async bootstrap(user: AuthUser, juz: number[] = [29, 30]) {
    const where = { ...(await this.studentScope(user)), status: 'ACTIVE' as const };

    const [surahs, students, teacher] = await Promise.all([
      this.prisma.surah.findMany({
        where: { juz: { in: juz } },
        orderBy: { number: 'desc' },
        select: { id: true, number: true, nameTransliteration: true, nameArabic: true, juz: true, ayahCount: true },
      }),
      this.prisma.student.findMany({
        where,
        orderBy: { fullName: 'asc' },
        include: {
          schoolClass: { select: { id: true, name: true, level: true, streams: { select: { id: true, name: true } } } },
          stream: { select: { id: true, name: true } },
          school: { select: { id: true, code: true, name: true } },
          memorizations: { select: { surahId: true, fraction: true, memorizedAt: true } },
        },
      }),
      isOrgWide(user) ? null : this.prisma.teacher.findUnique({ where: { userId: user.id } }),
    ]);

    const classes = new Map<string, { id: string; name: string; level: string; streams: { id: string; name: string }[] }>();
    for (const s of students) classes.set(s.schoolClass.id, s.schoolClass);
    // A brand-new Sheikh has no pupils yet, so no classes would derive from
    // `students` above — but they still need the class list to register their
    // first one. Pull every class at their own school as a fallback.
    if (teacher && classes.size === 0) {
      const schoolClasses = await this.prisma.schoolClass.findMany({
        where: { schoolId: teacher.schoolId },
        select: { id: true, name: true, level: true, streams: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      });
      for (const c of schoolClasses) classes.set(c.id, c);
    }

    return {
      serverTime: new Date().toISOString(),
      juz,
      target: TARGET_SURAH_COUNT,
      // How to address the signed-in user. Null for the secretariat, who have
      // no teaching record and are not addressed as Shk or Shkt.
      title: teacher ? titleOf(teacher.title) : null,
      surahs,
      classes: [...classes.values()].sort((a, b) => a.level.localeCompare(b.level)),
      students: students.map((s) => {
        // A cell can be partially memorized (0 < fraction < 1); count *and*
        // weight by fraction, otherwise a half-done surah is over-counted the
        // same as a finished one.
        const memorizedFraction = s.memorizations.reduce((sum, m) => sum + Number(m.fraction), 0);
        return {
          id: s.id,
          fullName: s.fullName,
          admissionNo: s.admissionNo,
          gender: s.gender,
          guardianName: s.guardianName,
          guardianPhone: s.guardianPhone,
          classId: s.schoolClass.id,
          className: s.schoolClass.name,
          level: s.schoolClass.level,
          streamName: s.stream?.name ?? null,
          schoolCode: s.school.code,
          schoolName: s.school.name,
          enrollmentStatus: s.enrollmentStatus,
          // surahId -> fraction (0..1), so the app can render a partial tick
          // instead of a plain memorized/not-memorized boolean.
          surahFractions: Object.fromEntries(s.memorizations.map((m) => [m.surahId, Number(m.fraction)])),
          memorized: s.memorizations.length,
          percent: progressPercent(memorizedFraction),
        };
      }),
    };
  }
}
