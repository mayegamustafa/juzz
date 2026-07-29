import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';

/**
 * Staff accounts: the secretariat manager (SUPERVISOR) and the system owner
 * (SUPER_ADMIN).
 *
 * Sheikh logins are deliberately NOT created here. A TEACHER user is only
 * meaningful alongside a Teacher record (the mobile bootstrap resolves a
 * teacher's roster through it), so those go through TeachersService, which
 * creates both together. Allowing a bare TEACHER user here would produce an
 * account that signs in and then sees nothing.
 */
const MANAGEABLE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SUPERVISOR];

const PUBLIC_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  school: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, opts: { role?: Role; includeTeachers?: boolean } = {}) {
    return this.prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        ...(opts.role
          ? { role: opts.role }
          : opts.includeTeachers
            ? {}
            : { role: { in: MANAGEABLE_ROLES } }),
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: PUBLIC_FIELDS,
    });
  }

  /**
   * Only a super admin may mint or promote another super admin. A supervisor
   * managing supervisors is ordinary delegation; a supervisor granting itself
   * peers at the highest level is privilege escalation.
   */
  private assertMayAssign(actor: AuthUser, role: Role) {
    if (!MANAGEABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        'Sheikh accounts are created on the Sheikhs page, so their teaching record is created with them.',
      );
    }
    if (role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can create another super admin');
    }
  }

  private async assertOwned(actor: AuthUser, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.organizationId !== actor.organizationId) throw new ForbiddenException();
    return target;
  }

  /** Refuse to strip the organisation of its last way back in. */
  private async assertNotLastSuperAdmin(targetId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== Role.SUPER_ADMIN || !target.isActive) return;

    const others = await this.prisma.user.count({
      where: {
        organizationId: target.organizationId,
        role: Role.SUPER_ADMIN,
        isActive: true,
        id: { not: targetId },
      },
    });
    if (others === 0) {
      throw new ConflictException(
        'This is the only active super admin. Promote someone else before changing this account.',
      );
    }
  }

  async create(
    actor: AuthUser,
    data: { fullName: string; email: string; password: string; role: Role; phone?: string; schoolId?: string },
  ) {
    this.assertMayAssign(actor, data.role);

    const email = data.email.trim().toLowerCase();
    const clash = await this.prisma.user.findUnique({ where: { email } });
    if (clash) throw new ConflictException(`A user with email "${email}" already exists`);

    const created = await this.prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        schoolId: data.schoolId ?? null,
        role: data.role,
        fullName: data.fullName.trim(),
        email,
        phone: data.phone,
        passwordHash: await argon2.hash(data.password),
      },
      select: PUBLIC_FIELDS,
    });
    return created;
  }

  async update(
    actor: AuthUser,
    id: string,
    data: { fullName?: string; email?: string; phone?: string; role?: Role; schoolId?: string | null },
  ) {
    const target = await this.assertOwned(actor, id);

    if (data.role && data.role !== target.role) {
      this.assertMayAssign(actor, data.role);
      // Demoting yourself would take away the very permission you are using.
      if (target.id === actor.id) {
        throw new ForbiddenException('You cannot change your own role');
      }
      // Moving a teacher account here would leave its Teacher record dangling.
      if (!MANAGEABLE_ROLES.includes(target.role)) {
        throw new BadRequestException('Sheikh accounts are managed on the Sheikhs page');
      }
      await this.assertNotLastSuperAdmin(id);
    }

    if (data.email) {
      const email = data.email.trim().toLowerCase();
      if (email !== target.email) {
        const clash = await this.prisma.user.findUnique({ where: { email } });
        if (clash) throw new ConflictException(`A user with email "${email}" already exists`);
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.schoolId !== undefined ? { schoolId: data.schoolId } : {}),
      },
      select: PUBLIC_FIELDS,
    });
  }

  /**
   * Suspend or restore an account. Deactivating is preferred over deleting: it
   * keeps the audit trail and authored remarks intact while stopping sign-in.
   */
  async setActive(actor: AuthUser, id: string, isActive: boolean) {
    const target = await this.assertOwned(actor, id);
    if (target.id === actor.id) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    if (target.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can suspend another super admin');
    }
    if (!isActive) await this.assertNotLastSuperAdmin(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: PUBLIC_FIELDS,
    });
  }

  async resetPassword(actor: AuthUser, id: string, password: string) {
    const target = await this.assertOwned(actor, id);
    if (target.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN && target.id !== actor.id) {
      throw new ForbiddenException("Only a super admin can reset another super admin's password");
    }

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password) },
    });
    // Existing sessions must not survive a password reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { reset: true };
  }
}
