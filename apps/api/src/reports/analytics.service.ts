import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';

/** Progress bands used across the dashboard, ordered worst to best. */
const BANDS = [
  { key: '0%', min: 0, max: 0 },
  { key: '1–24%', min: 0.01, max: 24.99 },
  { key: '25–49%', min: 25, max: 49.99 },
  { key: '50–74%', min: 50, max: 74.99 },
  { key: '75–99%', min: 75, max: 99.99 },
  { key: '100%', min: 100, max: Infinity },
] as const;

/** A pupil below this fraction of the term target is flagged for follow-up. */
const AT_RISK_PERCENT = 25;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(user: AuthUser): Promise<Prisma.StudentWhereInput> {
    if (isOrgWide(user)) return { school: { organizationId: user.organizationId } };
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    return { primaryTeacherId: teacher?.id ?? '__none__' };
  }

  /**
   * One call powering the analytics screen. Everything derives from a single
   * pupil fetch rather than N queries per school/sheikh/class.
   */
  async overview(user: AuthUser, opts: { schoolId?: string; level?: string } = {}) {
    // Pending/rejected registrations must not skew the organisation's official numbers.
    const where: Prisma.StudentWhereInput = {
      ...(await this.scope(user)),
      status: 'ACTIVE',
      enrollmentStatus: 'APPROVED',
    };
    if (opts.schoolId && isOrgWide(user)) where.schoolId = opts.schoolId;
    if (opts.level) where.schoolClass = { level: opts.level };

    const students = await this.prisma.student.findMany({
      where,
      include: {
        school: { select: { id: true, code: true, name: true } },
        schoolClass: { select: { id: true, name: true, level: true } },
        primaryTeacher: { select: { id: true, fullName: true } },
        _count: { select: { memorizations: true, revisions: true, mistakes: true } },
        assessments: { select: { score: true } },
      },
    });

    const pct = (s: (typeof students)[number]) => progressPercent(s._count.memorizations);

    // ---- KPIs ----
    const total = students.length;
    const avgPercent = total ? round1(students.reduce((a, s) => a + pct(s), 0) / total) : 0;
    const completed = students.filter((s) => pct(s) >= 100).length;
    const atRiskCount = students.filter((s) => pct(s) < AT_RISK_PERCENT).length;
    const allScores = students.flatMap((s) => s.assessments.map((a) => a.score).filter(isNum));
    const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

    // ---- Distribution across progress bands ----
    const distribution = BANDS.map((b) => ({
      band: b.key,
      count: students.filter((s) => {
        const p = pct(s);
        return b.min === 0 && b.max === 0 ? p === 0 : p >= b.min && p <= b.max;
      }).length,
    }));

    // ---- Grouped roll-ups ----
    const bySchool = groupBy(
      students,
      (s) => s.school.id,
      (s) => ({ id: s.school.id, code: s.school.code, name: s.school.name }),
    ).sort((a, b) => b.avgPercent - a.avgPercent);

    const byLevel = groupBy(
      students,
      (s) => s.schoolClass.level,
      (s) => ({ id: s.schoolClass.level, code: s.schoolClass.level, name: s.schoolClass.level }),
    ).sort((a, b) => a.code.localeCompare(b.code));

    const bySheikh = groupBy(
      students.filter((s) => s.primaryTeacher),
      (s) => s.primaryTeacher!.id,
      (s) => ({ id: s.primaryTeacher!.id, code: s.school.code, name: s.primaryTeacher!.fullName }),
    ).sort((a, b) => b.avgPercent - a.avgPercent);

    // ---- Pupils needing attention ----
    const atRisk = students
      .filter((s) => pct(s) < AT_RISK_PERCENT)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        admissionNo: s.admissionNo,
        school: s.school.code,
        level: s.schoolClass.level,
        sheikh: s.primaryTeacher?.fullName ?? null,
        memorized: s._count.memorizations,
        percent: pct(s),
        mistakes: s._count.mistakes,
      }))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 50);

    // ---- Surah coverage: which surahs the organisation is weakest on ----
    const surahCoverage = await this.surahCoverage(where, total);

    return {
      generatedAt: new Date().toISOString(),
      target: TARGET_SURAH_COUNT,
      atRiskThreshold: AT_RISK_PERCENT,
      kpis: {
        students: total,
        avgPercent,
        completed,
        atRisk: atRiskCount,
        avgScore,
        totalRevisions: students.reduce((a, s) => a + s._count.revisions, 0),
        totalMistakes: students.reduce((a, s) => a + s._count.mistakes, 0),
      },
      distribution,
      bySchool,
      byLevel,
      bySheikh,
      atRisk,
      surahCoverage,
    };
  }

  /** How many pupils have memorized each surah, hardest first. */
  private async surahCoverage(where: Prisma.StudentWhereInput, totalStudents: number) {
    const [surahs, grouped] = await Promise.all([
      this.prisma.surah.findMany({
        where: { juz: { in: [29, 30] } },
        select: { id: true, number: true, nameTransliteration: true },
      }),
      this.prisma.memorizationRecord.groupBy({
        by: ['surahId'],
        where: { student: where },
        _count: { surahId: true },
      }),
    ]);

    const counts = new Map(grouped.map((g) => [g.surahId, g._count.surahId]));
    return surahs
      .map((s) => {
        const count = counts.get(s.id) ?? 0;
        return {
          number: s.number,
          name: s.nameTransliteration,
          count,
          percent: totalStudents ? round1((count / totalStudents) * 100) : 0,
        };
      })
      .sort((a, b) => a.count - b.count || b.number - a.number);
  }
}

// ---------- helpers ----------

const isNum = (n: number | null): n is number => n != null;
const round1 = (n: number) => Math.round(n * 10) / 10;

type Studentish = {
  _count: { memorizations: number; revisions: number; mistakes: number };
  assessments: { score: number | null }[];
};

/** Collapse pupils into a named group with the same summary shape everywhere. */
function groupBy<T extends Studentish>(
  students: T[],
  keyOf: (s: T) => string,
  labelOf: (s: T) => { id: string; code: string; name: string },
) {
  const groups = new Map<string, { label: ReturnType<typeof labelOf>; items: T[] }>();
  for (const s of students) {
    const k = keyOf(s);
    if (!groups.has(k)) groups.set(k, { label: labelOf(s), items: [] });
    groups.get(k)!.items.push(s);
  }

  return [...groups.values()].map(({ label, items }) => {
    const percents = items.map((s) => progressPercent(s._count.memorizations));
    const scores = items.flatMap((s) => s.assessments.map((a) => a.score).filter(isNum));
    return {
      ...label,
      students: items.length,
      avgPercent: round1(percents.reduce((a, b) => a + b, 0) / items.length),
      completed: percents.filter((p) => p >= 100).length,
      atRisk: percents.filter((p) => p < AT_RISK_PERCENT).length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      mistakes: items.reduce((a, s) => a + s._count.mistakes, 0),
    };
  });
}
