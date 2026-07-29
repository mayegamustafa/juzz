import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { assertSchoolAccess, isOrgWide } from '../common/scope';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, schoolId?: string) {
    const where: Prisma.TeacherWhereInput = {};
    if (isOrgWide(user)) {
      if (schoolId) where.schoolId = schoolId;
      else where.school = { organizationId: user.organizationId };
    } else {
      where.schoolId = user.schoolId ?? '__none__';
    }
    return this.prisma.teacher.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: {
        school: { select: { id: true, code: true, name: true } },
        user: { select: { email: true, isActive: true } },
        _count: { select: { primaryStudents: true } },
      },
    });
  }

  /** A sheikh at another organisation's school must never be writable. */
  private async assertOwned(user: AuthUser, id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { school: { select: { organizationId: true } } },
    });
    if (!teacher) throw new NotFoundException('Shk / Shkt not found');
    if (teacher.school.organizationId !== user.organizationId) throw new ForbiddenException();
    if (!isOrgWide(user) && teacher.schoolId !== user.schoolId) throw new ForbiddenException();
    return teacher;
  }

  async create(
    user: AuthUser,
    data: { fullName: string; phone?: string; schoolId?: string; email?: string; password?: string },
  ) {
    // An org-wide caller is not bound to a school, so they must name one.
    const schoolId = isOrgWide(user) ? data.schoolId : user.schoolId;
    if (!schoolId) throw new BadRequestException('A school must be selected');
    assertSchoolAccess(user, schoolId);

    // Optionally create a linked login account so the sheikh can use the mobile app.
    let userId: string | undefined;
    if (data.email && data.password) {
      const email = data.email.trim().toLowerCase();
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash) throw new ConflictException(`A user with email "${email}" already exists`);

      const account = await this.prisma.user.create({
        data: {
          organizationId: user.organizationId,
          schoolId,
          role: Role.TEACHER,
          fullName: data.fullName,
          email,
          passwordHash: await argon2.hash(data.password),
        },
      });
      userId = account.id;
    }

    return this.prisma.teacher.create({
      data: { schoolId, fullName: data.fullName, phone: data.phone, userId },
      include: { school: { select: { code: true, name: true } } },
    });
  }

  async update(
    user: AuthUser,
    id: string,
    data: { fullName?: string; phone?: string; isActive?: boolean; schoolId?: string },
  ) {
    const teacher = await this.assertOwned(user, id);

    // Transferring a sheikh between schools is a secretariat action.
    if (data.schoolId && data.schoolId !== teacher.schoolId) {
      if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may transfer them');
      assertSchoolAccess(user, data.schoolId);
    }

    const updated = await this.prisma.teacher.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.schoolId ? { schoolId: data.schoolId } : {}),
      },
    });

    // Keep the linked login in step: name, school, and suspension follow the sheikh.
    if (teacher.userId) {
      await this.prisma.user.update({
        where: { id: teacher.userId },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.schoolId ? { schoolId: data.schoolId } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      });
    }
    return updated;
  }

  /**
   * A sheikh holding pupils cannot be deleted — that would orphan the roster.
   * Reassign the pupils first, or deactivate the sheikh instead.
   */
  async remove(user: AuthUser, id: string) {
    const teacher = await this.assertOwned(user, id);
    const pupils = await this.prisma.student.count({ where: { primaryTeacherId: id } });
    if (pupils > 0) {
      throw new ConflictException(
        `They still have ${pupils} pupil${pupils === 1 ? '' : 's'}. Reassign the pupils first, or deactivate instead.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { teacherId: id } });
      await tx.teacher.delete({ where: { id } });
      // Remove the login too, otherwise a deleted sheikh could still sign in.
      if (teacher.userId) await tx.user.delete({ where: { id: teacher.userId } });
    });
    return { deleted: true };
  }

  async resetPassword(user: AuthUser, id: string, newPassword: string) {
    const teacher = await this.assertOwned(user, id);
    if (!teacher.userId) throw new NotFoundException('They have no login account');
    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash: await argon2.hash(newPassword) },
    });
    // Force re-login everywhere; the old refresh tokens must not survive a reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { reset: true };
  }

  async studentsOf(user: AuthUser, teacherId: string) {
    // A sheikh may only read their own roster.
    if (user.role === Role.TEACHER) {
      const t = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!t || t.userId !== user.id) throw new ForbiddenException('Not your roster');
    } else {
      await this.assertOwned(user, teacherId);
    }
    return this.prisma.student.findMany({
      where: { primaryTeacherId: teacherId },
      orderBy: { fullName: 'asc' },
      include: { schoolClass: { select: { level: true } } },
    });
  }

  async assign(
    user: AuthUser,
    teacherId: string,
    data: { classId?: string; streamId?: string; studentId?: string; termId?: string },
  ) {
    const teacher = await this.assertOwned(user, teacherId);

    if (data.studentId) {
      const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
      if (!student) throw new NotFoundException('Pupil not found');
      // A sheikh teaches at one school; a pupil cannot be assigned across schools.
      if (student.schoolId !== teacher.schoolId) {
        throw new ConflictException('Pupil and Shk/Shkt belong to different schools');
      }
      await this.prisma.student.update({
        where: { id: data.studentId },
        data: { primaryTeacherId: teacherId },
      });
    }
    return this.prisma.assignment.create({ data: { teacherId, ...data } });
  }
}
