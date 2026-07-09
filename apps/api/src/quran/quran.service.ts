import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';

@Injectable()
export class QuranService {
  constructor(private readonly prisma: PrismaService) {}

  listSurahs(juz?: number[]) {
    return this.prisma.surah.findMany({
      where: juz && juz.length ? { juz: { in: juz } } : undefined,
      orderBy: { number: 'desc' },
    });
  }

  /** Ensures the teacher/admin may write to this student. */
  private async assertCanWrite(user: AuthUser, studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new ForbiddenException('Unknown student');
    // The secretariat (super admin / supervisor) may correct any pupil's record.
    if (isOrgWide(user)) return student;
    // A Sheikh may only record for pupils on their own roster.
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!teacher || student.primaryTeacherId !== teacher.id) {
      throw new ForbiddenException('Student is not in your roster');
    }
    return student;
  }

  /** Read access: org-wide roles see their whole org; school roles only their school. */
  private async assertCanRead(user: AuthUser, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { school: { select: { organizationId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (isOrgWide(user)) {
      if (student.school.organizationId !== user.organizationId) throw new ForbiddenException();
    } else if (student.schoolId !== user.schoolId) {
      throw new ForbiddenException('Different school');
    }
    return student;
  }

  /** The surah grid: students (rows) x surahs (cols) with memorized cells + per-student progress. */
  async grid(user: AuthUser, opts: { classId?: string; streamId?: string; juz?: number[] }) {
    const juz = opts.juz?.length ? opts.juz : [29, 30];

    const studentWhere: Prisma.StudentWhereInput = { status: 'ACTIVE' };
    if (opts.classId) studentWhere.classId = opts.classId;
    if (opts.streamId) studentWhere.streamId = opts.streamId;
    // scope
    if (isOrgWide(user)) {
      studentWhere.school = { organizationId: user.organizationId };
    } else {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      studentWhere.primaryTeacherId = teacher?.id ?? '__none__';
    }

    const [surahs, students] = await Promise.all([
      this.prisma.surah.findMany({ where: { juz: { in: juz } }, orderBy: { number: 'desc' } }),
      this.prisma.student.findMany({
        where: studentWhere,
        orderBy: { fullName: 'asc' },
        include: {
          primaryTeacher: { select: { fullName: true } },
          memorizations: { select: { surahId: true, fraction: true } },
        },
      }),
    ]);

    const rows = students.map((s) => {
      const cells: Record<string, number> = {};
      let memorizedFraction = 0;
      for (const m of s.memorizations) {
        cells[m.surahId] = Number(m.fraction);
        memorizedFraction += Number(m.fraction);
      }
      return {
        id: s.id,
        fullName: s.fullName,
        teacher: s.primaryTeacher?.fullName ?? null,
        cells,
        progress: {
          memorized: s.memorizations.length,
          target: TARGET_SURAH_COUNT,
          percent: progressPercent(memorizedFraction),
        },
      };
    });

    return { surahs, students: rows };
  }

  /** Upsert a single memorization cell. fraction 0 deletes the cell. */
  async upsertMemorization(
    user: AuthUser,
    data: { studentId: string; surahId: string; fraction?: number; memorizedAt?: string },
  ) {
    await this.assertCanWrite(user, data.studentId);
    const fraction = data.fraction ?? 1;

    if (fraction <= 0) {
      await this.prisma.memorizationRecord.deleteMany({
        where: { studentId: data.studentId, surahId: data.surahId },
      });
      return { studentId: data.studentId, surahId: data.surahId, fraction: 0 };
    }

    const memorizedAt = data.memorizedAt ? new Date(data.memorizedAt) : new Date();
    return this.prisma.memorizationRecord.upsert({
      where: { studentId_surahId: { studentId: data.studentId, surahId: data.surahId } },
      update: { fraction, memorizedAt, recordedById: user.id },
      create: {
        studentId: data.studentId,
        surahId: data.surahId,
        fraction,
        memorizedAt,
        recordedById: user.id,
      },
    });
  }

  /** Bulk upsert (also serves the future offline /sync path). */
  async bulkMemorization(
    user: AuthUser,
    items: { studentId: string; surahId: string; fraction?: number; memorizedAt?: string }[],
  ) {
    let applied = 0;
    for (const item of items) {
      await this.upsertMemorization(user, item);
      applied += 1;
    }
    return { applied };
  }

  // --- Revision ---
  async addRevision(
    user: AuthUser,
    data: { studentId: string; surahId?: string; juz?: number; performanceScore?: number; revisedAt?: string; note?: string },
  ) {
    await this.assertCanWrite(user, data.studentId);
    return this.prisma.revisionRecord.create({
      data: {
        studentId: data.studentId,
        surahId: data.surahId,
        juz: data.juz,
        performanceScore: data.performanceScore,
        revisedAt: data.revisedAt ? new Date(data.revisedAt) : new Date(),
        note: data.note,
        recordedById: user.id,
      },
      include: { surah: { select: { number: true, nameTransliteration: true } } },
    });
  }

  async listRevisions(user: AuthUser, studentId: string) {
    await this.assertCanRead(user, studentId);
    return this.prisma.revisionRecord.findMany({
      where: { studentId },
      orderBy: { revisedAt: 'desc' },
      include: { surah: { select: { number: true, nameTransliteration: true } } },
    });
  }

  // --- Assessment ---
  async addAssessment(
    user: AuthUser,
    data: { studentId: string; grade?: string; score?: number; assessedAt?: string; note?: string },
  ) {
    await this.assertCanWrite(user, data.studentId);
    return this.prisma.assessmentRecord.create({
      data: {
        studentId: data.studentId,
        grade: data.grade as any,
        score: data.score,
        assessedAt: data.assessedAt ? new Date(data.assessedAt) : new Date(),
        note: data.note,
        recordedById: user.id,
      },
    });
  }

  async listAssessments(user: AuthUser, studentId: string) {
    await this.assertCanRead(user, studentId);
    return this.prisma.assessmentRecord.findMany({
      where: { studentId },
      orderBy: { assessedAt: 'desc' },
    });
  }

  // --- Mistakes ---
  async addMistake(
    user: AuthUser,
    data: { studentId: string; type: string; count?: number; surahId?: string; occurredAt?: string; note?: string },
  ) {
    await this.assertCanWrite(user, data.studentId);
    return this.prisma.mistakeRecord.create({
      data: {
        studentId: data.studentId,
        type: data.type as any,
        count: data.count ?? 1,
        surahId: data.surahId,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        note: data.note,
        recordedById: user.id,
      },
      include: { surah: { select: { number: true, nameTransliteration: true } } },
    });
  }

  async listMistakes(user: AuthUser, studentId: string) {
    await this.assertCanRead(user, studentId);
    return this.prisma.mistakeRecord.findMany({
      where: { studentId },
      orderBy: { occurredAt: 'desc' },
      include: { surah: { select: { number: true, nameTransliteration: true } } },
    });
  }

  // --- Remarks ---
  async listRemarks(user: AuthUser, studentId: string) {
    await this.assertCanRead(user, studentId);
    return this.prisma.remark.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { fullName: true } } },
    });
  }

  async addRemark(user: AuthUser, studentId: string, body: string) {
    await this.assertCanWrite(user, studentId);
    return this.prisma.remark.create({
      data: { studentId, authorId: user.id, body },
      include: { author: { select: { fullName: true } } },
    });
  }
}
