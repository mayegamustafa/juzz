-- AlterEnum
ALTER TYPE "TargetScope" ADD VALUE 'STUDENT';

-- AlterTable
ALTER TABLE "Target" ADD COLUMN     "studentId" TEXT;

-- CreateIndex
CREATE INDEX "Target_studentId_idx" ON "Target"("studentId");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
