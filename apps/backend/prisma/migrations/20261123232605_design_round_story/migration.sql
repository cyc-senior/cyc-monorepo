-- AlterTable
ALTER TABLE "design_rounds" ADD COLUMN     "storyId" UUID;

-- CreateIndex
CREATE INDEX "design_rounds_storyId_idx" ON "design_rounds"("storyId");

-- AddForeignKey
ALTER TABLE "design_rounds" ADD CONSTRAINT "design_rounds_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "user_stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
