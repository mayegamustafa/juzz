import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, Gender, Prisma, StudentStatus } from '@prisma/client';
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
    opts: {
      page: number;
      pageSize: number;
      q?: string;
      schoolId?: string;
      classId?: string;
      streamId?: string;
      teacherId?: string;
      status?: StudentStatus;
      enrollmentStatus?: EnrollmentStatus;
    },
  ) {
    const where: Prisma.StudentWhereInput = { ...(await this.baseWhere(user)) };
    if (opts.schoolId && isOrgWide(user)) where.schoolId = opts.schoolId;
    if (opts.classId) where.classId = opts.classId;
    if (opts.streamId) where.streamId = opts.streamId;
    if (opts.teacherId) where.primaryTeacherId = opts.teacherId;
    if (opts.status) where.status = opts.status;
    // The official roster only ever shows verified pupils by default. Pass
    // ?enrollmentStatus=PENDING to see the review queue instead.
    where.enrollmentStatus = opts.enrollmentStatus ?? 'APPROVED';
    // Search covers the two things a sheikh actually knows: the name and the admission number.
    if (opts.q) {
      where.OR = [
        { fullName: { contains: opts.q, mode: 'insensitive' } },
        { admissionNo: { contains: opts.q, mode: 'insensitive' } },
      ];
    }

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

  /**
   * A pupil's class, stream and sheikh must all belong to the same school as the
   * pupil, otherwise the roster and the tracking grid disagree.
   */
  private async assertConsistent(
    schoolId: string,
    data: { classId?: string; streamId?: string; primaryTeacherId?: string },
  ) {
    if (data.classId) {
      const klass = await this.prisma.schoolClass.findUnique({ where: { id: data.classId } });
      if (!klass) throw new NotFoundException('Class not found');
      if (klass.schoolId !== schoolId) throw new BadRequestException('That class belongs to another school');
    }
    if (data.streamId) {
      const stream = await this.prisma.stream.findUnique({ where: { id: data.streamId } });
      if (!stream) throw new NotFoundException('Stream not found');
      if (data.classId && stream.classId !== data.classId) {
        throw new BadRequestException('That stream belongs to another class');
      }
    }
    if (data.primaryTeacherId) {
      const teacher = await this.prisma.teacher.findUnique({ where: { id: data.primaryTeacherId } });
      if (!teacher) throw new NotFoundException('Sheikh not found');
      if (teacher.schoolId !== schoolId) throw new BadRequestException('That sheikh teaches at another school');
    }
  }

  /**
   * A Sheikh may register a pupil straight from their own classroom, but the
   * entry is PENDING until the secretariat verifies it — this catches typos,
   * duplicates and mistaken school/class assignment before it becomes the
   * pupil's official record. Admin-created pupils are trusted immediately.
   */
  async create(
    user: AuthUser,
    data: {
      schoolId?: string;
      classId: string;
      streamId?: string;
      admissionNo: string;
      fullName: string;
      gender?: Gender;
      guardianName?: string;
      guardianPhone?: string;
      primaryTeacherId?: string;
    },
  ) {
    const selfRegistering = !isOrgWide(user);
    let ownTeacherId: string | null = null;
    if (selfRegistering) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher) throw new ForbiddenException('Only a registered sheikh may add pupils');
      ownTeacherId = teacher.id;
    }

    // An org-wide caller is not bound to a school, so they must name one.
    const schoolId = isOrgWide(user) ? data.schoolId : user.schoolId;
    if (!schoolId) throw new BadRequestException('A school must be selected for this pupil');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== user.organizationId) throw new ForbiddenException();

    const admissionNo = data.admissionNo.trim();
    const clash = await this.prisma.student.findFirst({ where: { schoolId, admissionNo } });
    if (clash) throw new ConflictException(`Admission number "${admissionNo}" is already used at this school`);

    // A Sheikh registers straight onto their own roster; only the secretariat
    // may hand a new pupil to someone else.
    const primaryTeacherId = selfRegistering ? ownTeacherId : data.primaryTeacherId || null;
    await this.assertConsistent(schoolId, { ...data, primaryTeacherId: primaryTeacherId ?? undefined });

    const now = new Date();
    return this.prisma.student.create({
      data: {
        schoolId,
        classId: data.classId,
        streamId: data.streamId || null,
        admissionNo,
        fullName: data.fullName.trim(),
        gender: data.gender,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        primaryTeacherId,
        enrollmentStatus: selfRegistering ? 'PENDING' : 'APPROVED',
        enrolledById: user.id,
        approvedById: selfRegistering ? null : user.id,
        approvedAt: selfRegistering ? null : now,
      },
    });
  }

  /** Verifies a Sheikh-submitted registration, making it the pupil's official record. */
  async approve(user: AuthUser, id: string) {
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may verify an enrolment');
    const student = await this.assertCanRead(user, id);
    if (student.enrollmentStatus !== 'PENDING') {
      throw new ConflictException('This pupil is not awaiting verification');
    }
    return this.prisma.student.update({
      where: { id },
      data: { enrollmentStatus: 'APPROVED', approvedById: user.id, approvedAt: new Date(), rejectionReason: null },
    });
  }

  /** Declines a Sheikh-submitted registration; the record and its history are kept for audit. */
  async reject(user: AuthUser, id: string, reason?: string) {
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may verify an enrolment');
    const student = await this.assertCanRead(user, id);
    if (student.enrollmentStatus !== 'PENDING') {
      throw new ConflictException('This pupil is not awaiting verification');
    }
    return this.prisma.student.update({
      where: { id },
      data: {
        enrollmentStatus: 'REJECTED',
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });
  }

  async update(
    user: AuthUser,
    id: string,
    data: {
      classId?: string;
      streamId?: string | null;
      admissionNo?: string;
      fullName?: string;
      gender?: Gender;
      guardianName?: string;
      guardianPhone?: string;
      primaryTeacherId?: string | null;
      status?: StudentStatus;
    },
  ) {
    const student = await this.assertCanRead(user, id);
    // A sheikh may correct their pupil's details but not move them out of their roster.
    if (!isOrgWide(user) && (data.primaryTeacherId !== undefined || data.classId !== undefined)) {
      throw new ForbiddenException('Only the secretariat may reassign a pupil');
    }

    if (data.admissionNo && data.admissionNo.trim() !== student.admissionNo) {
      const clash = await this.prisma.student.findFirst({
        where: { schoolId: student.schoolId, admissionNo: data.admissionNo.trim(), id: { not: id } },
      });
      if (clash) throw new ConflictException(`Admission number "${data.admissionNo}" is already used`);
    }

    await this.assertConsistent(student.schoolId, {
      classId: data.classId,
      streamId: data.streamId ?? undefined,
      primaryTeacherId: data.primaryTeacherId ?? undefined,
    });

    return this.prisma.student.update({
      where: { id },
      data: {
        ...(data.classId ? { classId: data.classId } : {}),
        ...(data.streamId !== undefined ? { streamId: data.streamId || null } : {}),
        ...(data.admissionNo ? { admissionNo: data.admissionNo.trim() } : {}),
        ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.guardianName !== undefined ? { guardianName: data.guardianName } : {}),
        ...(data.guardianPhone !== undefined ? { guardianPhone: data.guardianPhone } : {}),
        ...(data.primaryTeacherId !== undefined ? { primaryTeacherId: data.primaryTeacherId || null } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  /** Reversible: a pupil who left keeps their history. */
  async setStatus(user: AuthUser, id: string, status: StudentStatus) {
    await this.assertCanRead(user, id);
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may change pupil status');
    return this.prisma.student.update({ where: { id }, data: { status } });
  }

  /**
   * Hard delete. Refused once a pupil has any Quran history — that record is the
   * whole point of the system. Archive them instead.
   */
  async remove(user: AuthUser, id: string) {
    await this.assertCanRead(user, id);
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may delete a pupil');

    const [memorizations, revisions, assessments, attendance] = await Promise.all([
      this.prisma.memorizationRecord.count({ where: { studentId: id } }),
      this.prisma.revisionRecord.count({ where: { studentId: id } }),
      this.prisma.assessmentRecord.count({ where: { studentId: id } }),
      this.prisma.attendanceRecord.count({ where: { studentId: id } }),
    ]);
    const records = memorizations + revisions + assessments + attendance;
    if (records > 0) {
      throw new ConflictException(
        `This pupil has ${records} progress record${records === 1 ? '' : 's'}. Deleting would erase their Quran history — archive them instead.`,
      );
    }

    await this.prisma.student.delete({ where: { id } });
    return { deleted: true };
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
