import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TargetScope, TargetUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';

type TermInput = { name: string; startDate: string; endDate: string; isActive?: boolean };
type TargetInput = {
  termId: string;
  scope: TargetScope;
  unit: TargetUnit;
  amount: number;
  description?: string;
  schoolId?: string;
  classId?: string;
};

@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- terms ----------

  listTerms(user: AuthUser) {
    return this.prisma.term.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { targets: true } } },
    });
  }

  /** A term from another organisation must never be readable or writable. */
  private async assertTerm(user: AuthUser, id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.organizationId !== user.organizationId) throw new ForbiddenException();
    return term;
  }

  createTerm(user: AuthUser, data: TermInput) {
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

  async updateTerm(user: AuthUser, id: string, data: Partial<TermInput>) {
    await this.assertTerm(user, id);
    const patch: Prisma.TermUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.startDate) patch.startDate = new Date(data.startDate);
    if (data.endDate) patch.endDate = new Date(data.endDate);
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return this.prisma.term.update({ where: { id }, data: patch });
  }

  async removeTerm(user: AuthUser, id: string) {
    await this.assertTerm(user, id);
    const targets = await this.prisma.target.count({ where: { termId: id } });
    if (targets > 0) {
      throw new ForbiddenException(
        `This term still has ${targets} target${targets === 1 ? '' : 's'}. Delete them first.`,
      );
    }
    await this.prisma.term.delete({ where: { id } });
    return { deleted: true };
  }

  /** Exactly one term is the active one; activating a term deactivates the rest. */
  async activateTerm(user: AuthUser, id: string) {
    await this.assertTerm(user, id);
    await this.prisma.$transaction([
      this.prisma.term.updateMany({
        where: { organizationId: user.organizationId },
        data: { isActive: false },
      }),
      this.prisma.term.update({ where: { id }, data: { isActive: true } }),
    ]);
    return this.prisma.term.findUnique({ where: { id } });
  }

  // ---------- targets ----------

  listTargets(user: AuthUser, termId?: string) {
    return this.prisma.target.findMany({
      where: {
        term: { organizationId: user.organizationId },
        ...(termId ? { termId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        term: { select: { id: true, name: true, isActive: true } },
        school: { select: { id: true, code: true, name: true } },
        schoolClass: { select: { id: true, name: true, level: true } },
      },
    });
  }

  private async assertTarget(user: AuthUser, id: string) {
    const target = await this.prisma.target.findUnique({ where: { id }, include: { term: true } });
    if (!target) throw new NotFoundException('Target not found');
    if (target.term.organizationId !== user.organizationId) throw new ForbiddenException();
    return target;
  }

  /** A target's scope decides which foreign key it hangs off; the others must be null. */
  private scopeLinks(user: AuthUser, data: Pick<TargetInput, 'scope' | 'schoolId' | 'classId'>) {
    if (data.scope === 'SCHOOL' && !data.schoolId) {
      throw new ForbiddenException('A school-scoped target needs a school');
    }
    if (data.scope === 'CLASS' && !data.classId) {
      throw new ForbiddenException('A class-scoped target needs a class');
    }
    return {
      organizationId: data.scope === 'ORGANIZATION' ? user.organizationId : null,
      schoolId: data.scope === 'SCHOOL' ? data.schoolId : null,
      classId: data.scope === 'CLASS' ? data.classId : null,
    };
  }

  async createTarget(user: AuthUser, data: TargetInput) {
    await this.assertTerm(user, data.termId);
    return this.prisma.target.create({
      data: {
        termId: data.termId,
        scope: data.scope,
        unit: data.unit,
        amount: data.amount,
        description: data.description,
        ...this.scopeLinks(user, data),
      },
    });
  }

  async updateTarget(user: AuthUser, id: string, data: Partial<TargetInput>) {
    const existing = await this.assertTarget(user, id);
    if (data.termId) await this.assertTerm(user, data.termId);

    const scope = data.scope ?? existing.scope;
    return this.prisma.target.update({
      where: { id },
      data: {
        ...(data.termId ? { termId: data.termId } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        scope,
        ...this.scopeLinks(user, {
          scope,
          schoolId: data.schoolId ?? existing.schoolId ?? undefined,
          classId: data.classId ?? existing.classId ?? undefined,
        }),
      },
    });
  }

  async removeTarget(user: AuthUser, id: string) {
    await this.assertTarget(user, id);
    await this.prisma.target.delete({ where: { id } });
    return { deleted: true };
  }
}
