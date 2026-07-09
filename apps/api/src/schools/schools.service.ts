import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.school.findMany({
      where,
      orderBy: { code: 'asc' },
      include: { _count: { select: { students: true, teachers: true, classes: true } } },
    });
  }

  async get(user: AuthUser, id: string) {
    if (!isOrgWide(user) && user.schoolId !== id) {
      throw new ForbiddenException('No access to this school');
    }
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        classes: { orderBy: { order: 'asc' }, include: { _count: { select: { students: true } } } },
        _count: { select: { students: true, teachers: true } },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== user.organizationId) throw new ForbiddenException();
    return school;
  }

  /** A school from another organisation must never be writable. */
  private async assertOwned(user: AuthUser, id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== user.organizationId) throw new ForbiddenException();
    return school;
  }

  async create(user: AuthUser, data: { code: string; name: string; location?: string }) {
    const code = data.code.trim().toUpperCase();
    const clash = await this.prisma.school.findFirst({
      where: { organizationId: user.organizationId, code },
    });
    if (clash) throw new ConflictException(`A school with code "${code}" already exists`);

    return this.prisma.school.create({
      data: { ...data, code, organizationId: user.organizationId },
    });
  }

  async update(user: AuthUser, id: string, data: Partial<{ name: string; location: string; isActive: boolean }>) {
    await this.assertOwned(user, id);
    return this.prisma.school.update({ where: { id }, data });
  }

  /**
   * Deleting a school that still holds pupils would orphan years of Quran records,
   * so a populated school can only be archived (`isActive: false`). An empty school
   * is removed outright.
   */
  async remove(user: AuthUser, id: string) {
    await this.assertOwned(user, id);
    const counts = await this.prisma.school.findUnique({
      where: { id },
      select: { _count: { select: { students: true, teachers: true, classes: true } } },
    });
    const { students = 0, teachers = 0, classes = 0 } = counts?._count ?? {};

    if (students > 0 || teachers > 0) {
      const parts = [
        students > 0 ? `${students} pupil${students === 1 ? '' : 's'}` : null,
        teachers > 0 ? `${teachers} sheikh${teachers === 1 ? '' : 's'}` : null,
      ].filter(Boolean);
      throw new ConflictException(
        `This school still has ${parts.join(' and ')}. Move or remove them first, or archive the school instead.`,
      );
    }

    if (classes > 0) {
      await this.prisma.schoolClass.deleteMany({ where: { schoolId: id } });
    }
    await this.prisma.school.delete({ where: { id } });
    return { deleted: true };
  }

  /** Reversible alternative to deletion. */
  async setArchived(user: AuthUser, id: string, archived: boolean) {
    await this.assertOwned(user, id);
    return this.prisma.school.update({ where: { id }, data: { isActive: !archived } });
  }
}
