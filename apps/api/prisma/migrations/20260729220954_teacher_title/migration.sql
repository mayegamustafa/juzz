-- CreateEnum
CREATE TYPE "TeacherTitle" AS ENUM ('SHK', 'SHKT');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "title" "TeacherTitle" NOT NULL DEFAULT 'SHK';
