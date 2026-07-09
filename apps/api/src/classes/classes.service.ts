import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { assertSchoolAccess } from '../common/scope';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /** A school outside the caller's organisation is invisible, whatever their role. */
  private async assertSchoolInOrg(user: AuthUser, schoolId: string) {
    assertSchoolAccess(user, schoolId);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== user.organizationId) throw new ForbiddenException();
    return school;
  }

  private async assertClass(user: AuthUser, id: string) {
    const klass = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: { school: { select: { id: true, organizationId: true } } },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (klass.school.organizationId !== user.organizationId) throw new ForbiddenException();
    assertSchoolAccess(user, klass.schoolId);
    return klass;
  }

  async listForSchool(user: AuthUser, schoolId: string) {
    await this.assertSchoolInOrg(user, schoolId);
    return this.prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { order: 'asc' },
      include: {
        streams: { orderBy: { name: 'asc' } },
        _count: { select: { students: true } },
      },
    });
  }

  async create(user: AuthUser, schoolId: string, data: { level: string; name?: string; order?: number }) {
    await this.assertSchoolInOrg(user, schoolId);
    const level = data.level.trim();

    const clash = await this.prisma.schoolClass.findFirst({ where: { schoolId, level } });
    if (clash) throw new ConflictException(`This school already has a ${level} class`);

    // Default the ordering to the end of the list so new classes don't all collide on 0.
    const order =
      data.order ??
      ((await this.prisma.schoolClass.count({ where: { schoolId } })) + 1);

    return this.prisma.schoolClass.create({
      data: { schoolId, level, name: data.name?.trim() || level, order },
    });
  }

  async update(user: AuthUser, id: string, data: { name?: string; order?: number }) {
    await this.assertClass(user, id);
    return this.prisma.schoolClass.update({ where: { id }, data });
  }

  /** Deleting a class holding pupils would orphan them, so it is refused. */
  async remove(user: AuthUser, id: string) {
    await this.assertClass(user, id);
    const pupils = await this.prisma.student.count({ where: { classId: id } });
    if (pupils > 0) {
      throw new ConflictException(
        `This class still has ${pupils} pupil${pupils === 1 ? '' : 's'}. Move them to another class first.`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.stream.deleteMany({ where: { classId: id } }),
      this.prisma.schoolClass.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async createStream(user: AuthUser, classId: string, name: string) {
    await this.assertClass(user, classId);
    const clash = await this.prisma.stream.findFirst({ where: { classId, name: name.trim() } });
    if (clash) throw new ConflictException(`Stream "${name}" already exists in this class`);
    return this.prisma.stream.create({ data: { classId, name: name.trim() } });
  }

  async removeStream(user: AuthUser, streamId: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    await this.assertClass(user, stream.classId);

    const pupils = await this.prisma.student.count({ where: { streamId } });
    if (pupils > 0) {
      throw new ConflictException(
        `This stream still has ${pupils} pupil${pupils === 1 ? '' : 's'}. Move them first.`,
      );
    }
    await this.prisma.stream.delete({ where: { id: streamId } });
    return { deleted: true };
  }
}
