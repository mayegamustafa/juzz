import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { assertSchoolAccess } from '../common/scope';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForSchool(user: AuthUser, schoolId: string) {
    assertSchoolAccess(user, schoolId);
    return this.prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { order: 'asc' },
      include: {
        streams: true,
        _count: { select: { students: true } },
      },
    });
  }

  async create(user: AuthUser, schoolId: string, data: { level: string; name?: string; order?: number }) {
    assertSchoolAccess(user, schoolId);
    return this.prisma.schoolClass.create({
      data: {
        schoolId,
        level: data.level,
        name: data.name ?? data.level,
        order: data.order ?? 0,
      },
    });
  }

  update(id: string, data: { name?: string; order?: number }) {
    return this.prisma.schoolClass.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.schoolClass.delete({ where: { id } });
  }

  createStream(classId: string, name: string) {
    return this.prisma.stream.create({ data: { classId, name } });
  }
}
