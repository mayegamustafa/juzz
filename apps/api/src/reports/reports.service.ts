import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(user: AuthUser): Prisma.StudentWhereInput {
    if (isOrgWide(user)) return { school: { organizationId: user.organizationId } };
    return { schoolId: user.schoolId ?? '__none__' };
  }

  /**
   * GENERAL roll-up: for a given class LEVEL (e.g. "P.1") across schools, count how many
   * students in each school have memorized each surah. Mirrors the GENERAL tab.
   */
  async general(user: AuthUser, opts: { level?: string; juz?: number[]; schoolId?: string }) {
    const juz = opts.juz?.length ? opts.juz : [29, 30];
    const where: Prisma.StudentWhereInput = { ...this.scopeWhere(user), status: 'ACTIVE' };
    if (opts.schoolId && isOrgWide(user)) where.schoolId = opts.schoolId;
    if (opts.level) where.schoolClass = { level: opts.level };

    const [surahs, students] = await Promise.all([
      this.prisma.surah.findMany({ where: { juz: { in: juz } }, orderBy: { number: 'desc' } }),
      this.prisma.student.findMany({
        where,
        include: {
          school: { select: { id: true, code: true, name: true } },
          memorizations: { select: { surahId: true } },
        },
      }),
    ]);

    // schools present
    const schoolsMap = new Map<string, { id: string; code: string; name: string; enrolled: number }>();
    for (const s of students) {
      const e = schoolsMap.get(s.school.id) ?? { ...s.school, enrolled: 0 };
      e.enrolled += 1;
      schoolsMap.set(s.school.id, e);
    }
    const schools = [...schoolsMap.values()].sort((a, b) => a.code.localeCompare(b.code));

    // counts[surahId][schoolId] = number of students who memorized it
    const rows = surahs.map((surah) => {
      const perSchool: Record<string, number> = {};
      let total = 0;
      for (const s of students) {
        if (s.memorizations.some((m) => m.surahId === surah.id)) {
          perSchool[s.school.id] = (perSchool[s.school.id] ?? 0) + 1;
          total += 1;
        }
      }
      return { surah: { number: surah.number, name: surah.nameTransliteration }, perSchool, total };
    });

    return { schools, surahs, rows };
  }

  /** Role-aware dashboard KPIs. */
  async dashboard(user: AuthUser) {
    const where = this.scopeWhere(user);
    const [studentCount, memoCount, schoolCount, teacherCount] = await Promise.all([
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.memorizationRecord.count({ where: { student: where } }),
      isOrgWide(user)
        ? this.prisma.school.count({ where: { organizationId: user.organizationId } })
        : Promise.resolve(1),
      this.prisma.teacher.count({
        where: isOrgWide(user)
          ? { school: { organizationId: user.organizationId } }
          : { schoolId: user.schoolId ?? '__none__' },
      }),
    ]);

    const avgPercent = studentCount > 0 ? progressPercent(memoCount / studentCount) : 0;

    // progress per school (org-wide) for a bar chart
    let bySchool: { code: string; name: string; percent: number; students: number }[] = [];
    if (isOrgWide(user)) {
      const schools = await this.prisma.school.findMany({
        where: { organizationId: user.organizationId },
        include: {
          _count: { select: { students: true } },
          students: { select: { _count: { select: { memorizations: true } } } },
        },
        orderBy: { code: 'asc' },
      });
      bySchool = schools.map((s) => {
        const totalMemo = s.students.reduce((sum, st) => sum + st._count.memorizations, 0);
        const n = s.students.length;
        return {
          code: s.code,
          name: s.name,
          students: n,
          percent: n > 0 ? progressPercent(totalMemo / n) : 0,
        };
      });
    }

    return {
      kpis: { studentCount, memorizationCount: memoCount, schoolCount, teacherCount, avgPercent, target: TARGET_SURAH_COUNT },
      bySchool,
    };
  }

  /** Full single-student report payload (profile + all records + summaries). */
  async student(user: AuthUser, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: { select: { code: true, name: true, organizationId: true } },
        schoolClass: { select: { name: true, level: true } },
        stream: { select: { name: true } },
        primaryTeacher: { include: { user: { select: { fullName: true } } } },
        memorizations: {
          orderBy: { surah: { number: 'asc' } },
          include: { surah: { select: { number: true, nameTransliteration: true, juz: true } } },
        },
        revisions: {
          orderBy: { revisedAt: 'desc' },
          include: { surah: { select: { number: true, nameTransliteration: true } } },
        },
        assessments: { orderBy: { assessedAt: 'desc' } },
        mistakes: {
          orderBy: { occurredAt: 'desc' },
          include: { surah: { select: { number: true, nameTransliteration: true } } },
        },
        attendance: { orderBy: { date: 'desc' } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    // scope check
    if (isOrgWide(user)) {
      if (student.school.organizationId !== user.organizationId) throw new ForbiddenException();
    } else if (student.schoolId !== user.schoolId) {
      throw new ForbiddenException();
    }

    const memorized = student.memorizations.length;
    const attendanceSummary = student.attendance.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    const scores = student.assessments.map((a) => a.score).filter((s): s is number => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
      generatedAt: new Date().toISOString(),
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: student.fullName,
        gender: student.gender,
        status: student.status,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        enrollmentDate: student.enrollmentDate,
        school: student.school.name,
        schoolCode: student.school.code,
        className: student.schoolClass.name,
        level: student.schoolClass.level,
        stream: student.stream?.name ?? null,
        teacher: student.primaryTeacher?.user?.fullName ?? null,
      },
      summary: {
        memorized,
        target: TARGET_SURAH_COUNT,
        percent: progressPercent(memorized),
        revisions: student.revisions.length,
        assessments: student.assessments.length,
        avgScore,
        mistakes: student.mistakes.reduce((a, m) => a + m.count, 0),
        attendance: attendanceSummary,
      },
      memorizations: student.memorizations.map((m) => ({
        surah: `${m.surah.number}. ${m.surah.nameTransliteration}`,
        juz: m.surah.juz,
        ayahFrom: m.startAyah,
        ayahTo: m.endAyah,
        date: m.memorizedAt,
      })),
      revisions: student.revisions.map((r) => ({
        surah: r.surah ? `${r.surah.number}. ${r.surah.nameTransliteration}` : r.juz ? `Juz ${r.juz}` : 'General',
        score: r.performanceScore,
        date: r.revisedAt,
      })),
      assessments: student.assessments.map((a) => ({ grade: a.grade, score: a.score, date: a.assessedAt })),
      mistakes: student.mistakes.map((m) => ({
        type: m.type,
        count: m.count,
        surah: m.surah ? `${m.surah.number}. ${m.surah.nameTransliteration}` : null,
        date: m.occurredAt,
      })),
      attendances: student.attendance.map((a) => ({ date: a.date, status: a.status })),
    };
  }

  /** Leaderboards. */
  async leaderboard(user: AuthUser, type: 'students' | 'schools') {
    if (type === 'schools' && isOrgWide(user)) {
      const data = await this.dashboard(user);
      return data.bySchool.sort((a, b) => b.percent - a.percent).slice(0, 20);
    }
    const students = await this.prisma.student.findMany({
      where: { ...this.scopeWhere(user), status: 'ACTIVE' },
      include: {
        school: { select: { code: true } },
        schoolClass: { select: { level: true } },
        _count: { select: { memorizations: true } },
      },
    });
    return students
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        school: s.school.code,
        level: s.schoolClass.level,
        memorized: s._count.memorizations,
        percent: progressPercent(s._count.memorizations),
      }))
      .sort((a, b) => b.memorized - a.memorized)
      .slice(0, 20);
  }
}
