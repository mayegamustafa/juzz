import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './decorators';

/**
 * Who can see across the whole organisation.
 *
 * The secretariat — SUPER_ADMIN and the SUPERVISOR (EMT manager) — oversees every
 * school. A TEACHER (Sheikh) is bound to the school they teach at.
 */
export const isOrgWide = (user: AuthUser): boolean =>
  user.role === Role.SUPER_ADMIN || user.role === Role.SUPERVISOR;

/** Roles allowed to create/update/delete organisation data (schools, sheikhs, pupils, targets). */
export const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SUPERVISOR];

/** Roles allowed to record pupil progress. Sheikhs record for their own roster. */
export const RECORDING_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SUPERVISOR, Role.TEACHER];

/**
 * Returns a Prisma `where` fragment scoping School-level rows to what the user may see.
 * Org-wide roles get the whole organisation; a teacher gets their own school.
 */
export function schoolScope(user: AuthUser): { schoolId?: string; school?: { organizationId: string } } {
  if (isOrgWide(user)) {
    return { school: { organizationId: user.organizationId } };
  }
  if (!user.schoolId) throw new ForbiddenException('User is not bound to a school');
  return { schoolId: user.schoolId };
}

/** Throws if the user may not act on the given schoolId. */
export function assertSchoolAccess(user: AuthUser, schoolId: string): void {
  if (isOrgWide(user)) return;
  if (user.schoolId !== schoolId) {
    throw new ForbiddenException('You do not have access to this school');
  }
}
