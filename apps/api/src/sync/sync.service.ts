import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';

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

    const [surahs, students] = await Promise.all([
      this.prisma.surah.findMany({
        where: { juz: { in: juz } },
        orderBy: { number: 'desc' },
        select: { id: true, number: true, nameTransliteration: true, nameArabic: true, juz: true, ayahCount: true },
      }),
      this.prisma.student.findMany({
        where,
        orderBy: { fullName: 'asc' },
        include: {
          schoolClass: { select: { id: true, name: true, level: true } },
          stream: { select: { id: true, name: true } },
          school: { select: { id: true, code: true, name: true } },
          memorizations: { select: { surahId: true, fraction: true, memorizedAt: true } },
        },
      }),
    ]);

    const classes = new Map<string, { id: string; name: string; level: string }>();
    for (const s of students) classes.set(s.schoolClass.id, s.schoolClass);

    return {
      serverTime: new Date().toISOString(),
      juz,
      target: TARGET_SURAH_COUNT,
      surahs,
      classes: [...classes.values()].sort((a, b) => a.level.localeCompare(b.level)),
      students: students.map((s) => ({
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
        memorizedSurahIds: s.memorizations.map((m) => m.surahId),
        memorized: s.memorizations.length,
        percent: progressPercent(s.memorizations.length),
      })),
    };
  }
}
