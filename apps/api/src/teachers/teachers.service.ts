import { ForbiddenException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { assertSchoolAccess, isOrgWide } from '../common/scope';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, schoolId?: string) {
    const where: any = {};
    if (isOrgWide(user)) {
      if (schoolId) where.schoolId = schoolId;
      else where.school = { organizationId: user.organizationId };
    } else {
      where.schoolId = user.schoolId;
    }
    return this.prisma.teacher.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: {
        school: { select: { code: true, name: true } },
        _count: { select: { primaryStudents: true } },
      },
    });
  }

  async create(
    user: AuthUser,
    data: { fullName: string; phone?: string; schoolId?: string; email?: string; password?: string },
  ) {
    const schoolId = isOrgWide(user) ? data.schoolId! : user.schoolId!;
    assertSchoolAccess(user, schoolId);

    // optionally create a linked login user
    let userId: string | undefined;
    if (data.email && data.password) {
      const account = await this.prisma.user.create({
        data: {
          organizationId: user.organizationId,
          schoolId,
          role: Role.TEACHER,
          fullName: data.fullName,
          email: data.email,
          passwordHash: await argon2.hash(data.password),
        },
      });
      userId = account.id;
    }

    return this.prisma.teacher.create({
      data: { schoolId, fullName: data.fullName, phone: data.phone, userId },
    });
  }

  async update(id: string, data: { fullName?: string; phone?: string; isActive?: boolean }) {
    return this.prisma.teacher.update({ where: { id }, data });
  }

  async studentsOf(user: AuthUser, teacherId: string) {
    // a teacher may only read their own roster
    if (user.role === Role.TEACHER) {
      const t = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!t || t.userId !== user.id) throw new ForbiddenException('Not your roster');
    }
    return this.prisma.student.findMany({
      where: { primaryTeacherId: teacherId },
      orderBy: { fullName: 'asc' },
      include: { schoolClass: { select: { level: true } } },
    });
  }

  async assign(teacherId: string, data: { classId?: string; streamId?: string; studentId?: string; termId?: string }) {
    if (data.studentId) {
      await this.prisma.student.update({
        where: { id: data.studentId },
        data: { primaryTeacherId: teacherId },
      });
    }
    return this.prisma.assignment.create({ data: { teacherId, ...data } });
  }
}
