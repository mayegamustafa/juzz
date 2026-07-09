import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { paginated } from '../common/dto';
import { TARGET_SURAH_COUNT, progressPercent } from '../common/progress';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds the visibility filter for the current user. */
  private async baseWhere(user: AuthUser): Promise<Prisma.StudentWhereInput> {
    if (isOrgWide(user)) return { school: { organizationId: user.organizationId } };
    // TEACHER: only the pupils on their own roster
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    return { primaryTeacherId: teacher?.id ?? '__none__' };
  }

  async list(
    user: AuthUser,
    opts: { page: number; pageSize: number; q?: string; schoolId?: string; classId?: string; streamId?: string; teacherId?: string },
  ) {
    const where: Prisma.StudentWhereInput = { ...(await this.baseWhere(user)) };
    if (opts.schoolId && isOrgWide(user)) where.schoolId = opts.schoolId;
    if (opts.classId) where.classId = opts.classId;
    if (opts.streamId) where.streamId = opts.streamId;
    if (opts.teacherId) where.primaryTeacherId = opts.teacherId;
    if (opts.q) where.fullName = { contains: opts.q, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        include: {
          schoolClass: { select: { level: true } },
          stream: { select: { name: true } },
          school: { select: { code: true } },
          primaryTeacher: { select: { fullName: true } },
          _count: { select: { memorizations: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    const data = rows.map((s) => ({
      ...s,
      progress: {
        memorized: s._count.memorizations,
        target: TARGET_SURAH_COUNT,
        percent: progressPercent(s._count.memorizations),
      },
    }));
    return paginated(data, total, opts.page, opts.pageSize);
  }

  private async assertCanRead(user: AuthUser, studentId: string) {
    const where = await this.baseWhere(user);
    const found = await this.prisma.student.findFirst({ where: { AND: [{ id: studentId }, where] } });
    if (!found) throw new ForbiddenException('No access to this student');
    return found;
  }

  async get(user: AuthUser, id: string) {
    await this.assertCanRead(user, id);
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        schoolClass: true,
        stream: true,
        school: true,
        primaryTeacher: true,
      },
    });
    if (!student) throw new NotFoundException();
    const progress = await this.progress(user, id);
    return { ...student, progress };
  }

  async create(
    user: AuthUser,
    data: {
      schoolId?: string;
      classId: string;
      streamId?: string;
      admissionNo: string;
      fullName: string;
      gender?: 'MALE' | 'FEMALE';
      guardianName?: string;
      guardianPhone?: string;
      primaryTeacherId?: string;
    },
  ) {
    const schoolId = isOrgWide(user) ? data.schoolId! : user.schoolId!;
    return this.prisma.student.create({
      data: {
        schoolId,
        classId: data.classId,
        streamId: data.streamId,
        admissionNo: data.admissionNo,
        fullName: data.fullName,
        gender: data.gender as any,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        primaryTeacherId: data.primaryTeacherId,
      },
    });
  }

  update(id: string, data: any) {
    return this.prisma.student.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.student.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async progress(user: AuthUser, id: string) {
    await this.assertCanRead(user, id);
    const records = await this.prisma.memorizationRecord.findMany({
      where: { studentId: id },
      include: { surah: { select: { number: true, nameTransliteration: true, juz: true } } },
      orderBy: { surah: { number: 'desc' } },
    });
    const memorizedFraction = records.reduce((sum, r) => sum + Number(r.fraction), 0);
    return {
      memorized: records.length,
      memorizedFraction,
      target: TARGET_SURAH_COUNT,
      percent: progressPercent(memorizedFraction),
      surahs: records.map((r) => ({
        surahId: r.surahId,
        number: r.surah.number,
        name: r.surah.nameTransliteration,
        juz: r.surah.juz,
        fraction: Number(r.fraction),
      })),
    };
  }
}
