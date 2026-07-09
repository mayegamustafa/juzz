-- The organisation runs its schools from a central secretariat, so there is no
-- per-school administrator role. Existing SCHOOL_ADMINs become SUPERVISORs
-- (secretariat managers / EMT) with org-wide powers.
--
-- Order matters: rows must stop referencing SCHOOL_ADMIN before the value can be
-- dropped from the enum type.

-- 1. Migrate existing rows off the doomed value.
UPDATE "User" SET role = 'SUPERVISOR' WHERE role = 'SCHOOL_ADMIN';

-- 2. A supervisor is org-wide, so it must not be pinned to a single school.
UPDATE "User" SET "schoolId" = NULL WHERE role = 'SUPERVISOR';

-- 3. Recreate the enum without SCHOOL_ADMIN.
--    Postgres cannot drop an enum value in place, so swap the type.
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SUPERVISOR', 'TEACHER', 'STUDENT');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING ("role"::text::"Role");

DROP TYPE "Role_old";
