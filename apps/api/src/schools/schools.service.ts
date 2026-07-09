import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const where = isOrgWide(user)
      ? { organizationId: user.organizationId }
      : { id: user.schoolId ?? '__none__' };
    const schools = await this.prisma.school.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { _count: { select: { students: true, teachers: true, classes: true } } },
    });
    return schools;
  }

  async get(user: AuthUser, id: string) {
    if (!isOrgWide(user) && user.schoolId !== id) {
      throw new ForbiddenException('No access to this school');
    }
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        classes: { orderBy: { order: 'asc' } },
        _count: { select: { students: true, teachers: true } },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  create(user: AuthUser, data: { code: string; name: string; location?: string }) {
    return this.prisma.school.create({
      data: { ...data, organizationId: user.organizationId },
    });
  }

  async update(user: AuthUser, id: string, data: Partial<{ name: string; location: string; isActive: boolean }>) {
    if (user.role === Role.SCHOOL_ADMIN && user.schoolId !== id) {
      throw new ForbiddenException('No access to this school');
    }
    return this.prisma.school.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.school.update({ where: { id }, data: { isActive: false } });
  }
}
