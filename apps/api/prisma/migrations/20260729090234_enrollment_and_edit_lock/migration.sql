-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AssessmentRecord" ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "unlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "unlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MistakeRecord" ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "unlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Remark" ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "unlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RevisionRecord" ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "unlockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "enrolledById" TEXT,
ADD COLUMN     "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL DEFAULT 'mobile',
    "platform" TEXT NOT NULL DEFAULT 'android',
    "versionCode" INTEGER NOT NULL,
    "versionName" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "publishedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_enrollmentStatus_idx" ON "Student"("enrollmentStatus");
