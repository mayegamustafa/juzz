import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';

@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  listTerms(user: AuthUser) {
    return this.prisma.term.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startDate: 'desc' },
    });
  }

  createTerm(user: AuthUser, data: { name: string; startDate: string; endDate: string; isActive?: boolean }) {
    return this.prisma.term.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive ?? false,
      },
    });
  }

  updateTerm(id: string, data: any) {
    const patch: any = { ...data };
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    return this.prisma.term.update({ where: { id }, data: patch });
  }

  listTargets(user: AuthUser) {
    return this.prisma.target.findMany({
      where: { term: { organizationId: user.organizationId } },
      orderBy: { createdAt: 'desc' },
      include: { term: { select: { name: true } } },
    });
  }

  createTarget(
    user: AuthUser,
    data: { termId: string; scope: any; unit: any; amount: number; description?: string; schoolId?: string; classId?: string },
  ) {
    return this.prisma.target.create({
      data: {
        termId: data.termId,
        scope: data.scope,
        unit: data.unit,
        amount: data.amount,
        description: data.description,
        organizationId: data.scope === 'ORGANIZATION' ? user.organizationId : null,
        schoolId: data.scope === 'SCHOOL' ? data.schoolId : null,
        classId: data.scope === 'CLASS' ? data.classId : null,
      },
    });
  }
}
