import { TeacherTitle } from '@prisma/client';

/**
 * How a member of teaching staff is addressed, in one place so the abbreviation
 * never drifts between a report header, a ranking and a greeting.
 */
export function titleOf(title: TeacherTitle | null | undefined): string {
  return title === 'SHKT' ? 'Shkt' : 'Shk';
}

/** "Shk NYOMBI". Falls back to the bare name when there is no teaching record. */
export function addressed(title: TeacherTitle | null | undefined, fullName: string): string {
  return `${titleOf(title)} ${fullName}`.trim();
}
