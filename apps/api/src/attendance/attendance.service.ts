import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { assertEditable, isEditable, unlockedUntilValue } from '../common/edit-lock';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Day sheet: every active student in a class + their status for the given date (if any). */
  async classDay(user: AuthUser, classId: string, date: string) {
    const day = new Date(date);
    const students = await this.prisma.student.findMany({
      where: { classId, status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    });
    if (students.length === 0) return { date, students: [] };

    // scope check: a teacher/admin may only read their own school's class
    if (!isOrgWide(user)) {
      const sample = await this.prisma.student.findFirst({ where: { classId }, select: { schoolId: true } });
      if (sample && user.schoolId !== sample.schoolId) throw new ForbiddenException('Different school');
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { date: day, studentId: { in: students.map((s) => s.id) } },
    });
    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    return {
      date,
      students: students.map((s) => {
        const rec = byStudent.get(s.id);
        return {
          id: s.id,
          fullName: s.fullName,
          status: rec?.status ?? null,
          recordId: rec?.id ?? null,
          canEdit: rec ? isEditable(user, rec) : true,
        };
      }),
    };
  }

  /**
   * Marking *today's* attendance is a normal upsert — a Sheikh fixes a same-day
   * mis-tap freely. Correcting an *older* mark (createdAt > 24h ago) is treated
   * as editing history and goes through the same lock as other records.
   */
  async upsert(user: AuthUser, data: { studentId: string; date: string; status: AttendanceStatus }) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new ForbiddenException('Unknown student');
    if (!isOrgWide(user)) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || student.primaryTeacherId !== teacher.id) {
        throw new ForbiddenException('Student is not in your roster');
      }
    }
    const day = new Date(data.date);
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { studentId_date: { studentId: data.studentId, date: day } },
    });
    if (existing) assertEditable(user, existing);

    return this.prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: data.studentId, date: day } },
      update: { status: data.status, recordedById: user.id },
      create: { studentId: data.studentId, date: day, status: data.status, recordedById: user.id },
    });
  }

  async remove(user: AuthUser, id: string) {
    const rec = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Attendance record not found');
    if (!isOrgWide(user)) {
      const student = await this.prisma.student.findUnique({ where: { id: rec.studentId } });
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!student || !teacher || student.primaryTeacherId !== teacher.id) {
        throw new ForbiddenException('Student is not in your roster');
      }
    }
    assertEditable(user, rec);
    await this.prisma.attendanceRecord.delete({ where: { id } });
    return { deleted: true };
  }

  async unlock(user: AuthUser, id: string) {
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may unlock an entry');
    const rec = await this.prisma.attendanceRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Attendance record not found');
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: { unlockedUntil: unlockedUntilValue(), unlockedById: user.id },
    });
  }

  async listForStudent(user: AuthUser, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { school: { select: { organizationId: true } } },
    });
    if (!student) throw new ForbiddenException('Unknown student');
    if (isOrgWide(user)) {
      if (student.school.organizationId !== user.organizationId) throw new ForbiddenException();
    } else if (student.schoolId !== user.schoolId) {
      throw new ForbiddenException('Different school');
    }
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 60,
    });
    return rows.map((r) => ({ ...r, canEdit: isEditable(user, r) }));
  }
}
