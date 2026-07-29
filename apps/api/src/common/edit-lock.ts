import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from './decorators';
import { isOrgWide } from './scope';

/** How long a Sheikh may correct their own submission before it locks. */
export const EDIT_WINDOW_HOURS = 24;

export interface Lockable {
  recordedById?: string | null;
  authorId?: string | null;
  createdAt: Date;
  unlockedUntil?: Date | null;
}

/** Non-throwing check, for annotating list responses so the UI can grey out actions. */
export function isEditable(user: AuthUser, record: Lockable): boolean {
  if (isOrgWide(user)) return true;
  const ownerId = record.recordedById ?? record.authorId ?? null;
  if (ownerId !== user.id) return false;
  const ageMs = Date.now() - record.createdAt.getTime();
  const withinWindow = ageMs <= EDIT_WINDOW_HOURS * 60 * 60 * 1000;
  const unlocked = !!record.unlockedUntil && record.unlockedUntil.getTime() > Date.now();
  return withinWindow || unlocked;
}

/**
 * A Sheikh may edit or delete their own submission for 24 hours after
 * recording it — long enough to fix a same-session typo, not long enough to
 * quietly rewrite history. After that, only the secretariat (Super Admin /
 * Manager) can act, unless they explicitly extend the window via `unlock()`.
 *
 * The secretariat itself is never restricted by this check.
 */
export function assertEditable(user: AuthUser, record: Lockable): void {
  if (isOrgWide(user)) return;

  const ownerId = record.recordedById ?? record.authorId ?? null;
  if (ownerId !== user.id) {
    throw new ForbiddenException('This entry was recorded by someone else.');
  }

  const ageMs = Date.now() - record.createdAt.getTime();
  const withinWindow = ageMs <= EDIT_WINDOW_HOURS * 60 * 60 * 1000;
  const unlocked = !!record.unlockedUntil && record.unlockedUntil.getTime() > Date.now();

  if (!withinWindow && !unlocked) {
    throw new ForbiddenException(
      `This entry is more than ${EDIT_WINDOW_HOURS}h old and is locked. Ask the manager to unlock it.`,
    );
  }
}

/** How far in the future an admin unlock extends the Sheikh's edit window. */
export const UNLOCK_EXTENSION_HOURS = 24;

export function unlockedUntilValue(): Date {
  return new Date(Date.now() + UNLOCK_EXTENSION_HOURS * 60 * 60 * 1000);
}
