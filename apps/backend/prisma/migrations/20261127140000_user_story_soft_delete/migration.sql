-- DropIndex
DROP INDEX "user_stories_projectId_idx";

-- AlterTable
ALTER TABLE "user_stories" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" UUID;

-- CreateIndex
CREATE INDEX "user_stories_projectId_deletedAt_idx" ON "user_stories"("projectId", "deletedAt");

