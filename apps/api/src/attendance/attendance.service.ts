import { ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';

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
    const byStudent = new Map(records.map((r) => [r.studentId, r.status]));

    return {
      date,
      students: students.map((s) => ({ id: s.id, fullName: s.fullName, status: byStudent.get(s.id) ?? null })),
    };
  }

  async upsert(user: AuthUser, data: { studentId: string; date: string; status: AttendanceStatus }) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new ForbiddenException('Unknown student');
    // A Sheikh may only mark attendance for pupils on their own roster; the
    // secretariat may mark for anyone in the organisation.
    if (!isOrgWide(user)) {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || student.primaryTeacherId !== teacher.id) {
        throw new ForbiddenException('Student is not in your roster');
      }
    }
    const day = new Date(data.date);
    return this.prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: data.studentId, date: day } },
      update: { status: data.status, recordedById: user.id },
      create: { studentId: data.studentId, date: day, status: data.status, recordedById: user.id },
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
    return this.prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }
}
