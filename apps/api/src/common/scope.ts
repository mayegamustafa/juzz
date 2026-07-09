import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './decorators';

/**
 * Returns a Prisma `where` fragment scoping School-level rows to what the user may see.
 * - SUPER_ADMIN / SUPERVISOR: whole organization.
 * - SCHOOL_ADMIN / TEACHER: their own school only.
 */
export function schoolScope(user: AuthUser): { schoolId?: string; school?: { organizationId: string } } {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.SUPERVISOR) {
    return { school: { organizationId: user.organizationId } };
  }
  if (!user.schoolId) throw new ForbiddenException('User is not bound to a school');
  return { schoolId: user.schoolId };
}

/** Throws if the user may not act on the given schoolId. */
export function assertSchoolAccess(user: AuthUser, schoolId: string): void {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.SUPERVISOR) return;
  if (user.schoolId !== schoolId) {
    throw new ForbiddenException('You do not have access to this school');
  }
}

export const isOrgWide = (user: AuthUser): boolean =>
  user.role === Role.SUPER_ADMIN || user.role === Role.SUPERVISOR;
