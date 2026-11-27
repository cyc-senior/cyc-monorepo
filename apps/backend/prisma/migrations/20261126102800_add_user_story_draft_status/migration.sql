-- CreateEnum
CREATE TYPE "PromptDraftStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "user_stories" ADD COLUMN "draftStatus" "PromptDraftStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN "draftError" TEXT;
