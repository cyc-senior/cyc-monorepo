-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'DESIGNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "StoryOrigin" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "TestSessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'COMPLETED', 'WITHDRAWN', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentDecision" AS ENUM ('GRANTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TaskRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'CLICK', 'INPUT', 'NAVIGATE', 'SCROLL', 'HOVER', 'ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackScope" AS ENUM ('COMPONENT', 'PAGE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'APPROVED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('USABILITY', 'VISUAL_DESIGN', 'CONTENT', 'ACCESSIBILITY', 'PERFORMANCE', 'FUNCTIONALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ThemeOrigin" AS ENUM ('AI', 'DESIGNER');

-- CreateEnum
CREATE TYPE "ThemeStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'WONT_FIX', 'MERGED');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('VARIANT_APPROVED', 'ANALYSIS_APPROVED', 'ANALYSIS_REJECTED', 'FEEDBACK_SELECTED', 'FEEDBACK_DESELECTED', 'FEEDBACK_WONT_FIX', 'SESSION_ENDED', 'ROUND_APPROVED', 'ITERATION_STARTED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('DESIGNER', 'CLIENT', 'DEVELOPER', 'PROJECT_MANAGER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectRole" ADD VALUE 'CLIENT';
ALTER TYPE "ProjectRole" ADD VALUE 'DEVELOPER';

-- AlterEnum
ALTER TYPE "UIVariantStatus" ADD VALUE 'APPROVED';

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_projectId_fkey";

-- AlterTable
ALTER TABLE "generation_jobs" ADD COLUMN     "baseVariantId" UUID,
ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "project_members" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "organizationId" UUID;

-- AlterTable
ALTER TABLE "ui_variants" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "parentVariantId" UUID;

-- AlterTable
ALTER TABLE "user_stories" ADD COLUMN     "generationId" UUID,
ADD COLUMN     "origin" "StoryOrigin" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_generations" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "requestedById" UUID,
    "instruction" TEXT,
    "count" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputSnapshot" JSONB NOT NULL DEFAULT '{}',
    "outputMetadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sessions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TestSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "consentVersion" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedById" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_variants" (
    "sessionId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "label" TEXT,

    CONSTRAINT "session_variants_pkey" PRIMARY KEY ("sessionId","variantId")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "assignedVariantId" UUID,
    "inviteTokenHash" TEXT NOT NULL,
    "inviteIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "decision" "ConsentDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_tasks" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "successCriteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_runs" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "status" "TaskRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "taskRunId" UUID,
    "type" "InteractionType" NOT NULL,
    "screenId" TEXT,
    "nodeId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "taskRunId" UUID,
    "scope" "FeedbackScope" NOT NULL,
    "screenId" TEXT,
    "nodeId" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_analyses" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "sessionId" UUID,
    "requestedById" UUID,
    "idempotencyKey" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputFeedbackIds" JSONB NOT NULL DEFAULT '[]',
    "aiSummary" TEXT,
    "aiInsights" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "insights" JSONB NOT NULL DEFAULT '[]',
    "reviewNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "outputMetadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_themes" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "origin" "ThemeOrigin" NOT NULL,
    "status" "ThemeStatus" NOT NULL DEFAULT 'PROPOSED',
    "aiTitle" TEXT,
    "aiSummary" TEXT,
    "aiCategory" "FeedbackCategory",
    "aiSeverity" "FeedbackSeverity",
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "severity" "FeedbackSeverity" NOT NULL,
    "labels" TEXT[],
    "designerNote" TEXT,
    "wontFixReason" TEXT,
    "selectedForIteration" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "mergedIntoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_feedback" (
    "themeId" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,

    CONSTRAINT "theme_feedback_pkey" PRIMARY KEY ("themeId","feedbackId")
);

-- CreateTable
CREATE TABLE "design_decisions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "type" "DecisionType" NOT NULL,
    "variantId" UUID,
    "sessionId" UUID,
    "analysisId" UUID,
    "themeId" UUID,
    "resultingRoundId" UUID,
    "decidedById" UUID,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_feedback_links" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "themeId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_feedback_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_comments" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_acknowledgements" (
    "roundId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_acknowledgements_pkey" PRIMARY KEY ("roundId","userId")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundId" UUID,
    "type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "generatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_createdById_idx" ON "organizations"("createdById");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "story_generations_projectId_createdAt_idx" ON "story_generations"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "story_generations_requestedById_idx" ON "story_generations"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "story_generations_projectId_idempotencyKey_key" ON "story_generations"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "test_sessions_projectId_status_idx" ON "test_sessions"("projectId", "status");

-- CreateIndex
CREATE INDEX "test_sessions_roundId_status_idx" ON "test_sessions"("roundId", "status");

-- CreateIndex
CREATE INDEX "test_sessions_createdById_idx" ON "test_sessions"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "test_sessions_id_roundId_key" ON "test_sessions"("id", "roundId");

-- CreateIndex
CREATE INDEX "session_variants_variantId_idx" ON "session_variants"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_inviteTokenHash_key" ON "session_participants"("inviteTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_sessionId_email_key" ON "session_participants"("sessionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_id_sessionId_key" ON "session_participants"("id", "sessionId");

-- CreateIndex
CREATE INDEX "consent_records_participantId_createdAt_idx" ON "consent_records"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_records_sessionId_idx" ON "consent_records"("sessionId");

-- CreateIndex
CREATE INDEX "test_tasks_sessionId_position_idx" ON "test_tasks"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "test_tasks_id_sessionId_key" ON "test_tasks"("id", "sessionId");

-- CreateIndex
CREATE INDEX "task_runs_participantId_idx" ON "task_runs"("participantId");

-- CreateIndex
CREATE INDEX "task_runs_sessionId_idx" ON "task_runs"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "task_runs_taskId_participantId_variantId_key" ON "task_runs"("taskId", "participantId", "variantId");

-- CreateIndex
CREATE INDEX "interaction_events_sessionId_participantId_occurredAt_idx" ON "interaction_events"("sessionId", "participantId", "occurredAt");

-- CreateIndex
CREATE INDEX "interaction_events_taskRunId_idx" ON "interaction_events"("taskRunId");

-- CreateIndex
CREATE INDEX "feedback_sessionId_createdAt_idx" ON "feedback"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_participantId_idx" ON "feedback"("participantId");

-- CreateIndex
CREATE INDEX "feedback_analyses_projectId_createdAt_idx" ON "feedback_analyses"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_analyses_roundId_idx" ON "feedback_analyses"("roundId");

-- CreateIndex
CREATE INDEX "feedback_analyses_sessionId_idx" ON "feedback_analyses"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_analyses_roundId_idempotencyKey_key" ON "feedback_analyses"("roundId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "feedback_themes_analysisId_status_idx" ON "feedback_themes"("analysisId", "status");

-- CreateIndex
CREATE INDEX "feedback_themes_mergedIntoId_idx" ON "feedback_themes"("mergedIntoId");

-- CreateIndex
CREATE INDEX "theme_feedback_feedbackId_idx" ON "theme_feedback"("feedbackId");

-- CreateIndex
CREATE INDEX "design_decisions_projectId_createdAt_idx" ON "design_decisions"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "design_decisions_roundId_createdAt_idx" ON "design_decisions"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "round_feedback_links_themeId_idx" ON "round_feedback_links"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "round_feedback_links_roundId_themeId_key" ON "round_feedback_links"("roundId", "themeId");

-- CreateIndex
CREATE INDEX "round_comments_roundId_createdAt_idx" ON "round_comments"("roundId", "createdAt");

-- CreateIndex
CREATE INDEX "round_acknowledgements_userId_idx" ON "round_acknowledgements"("userId");

-- CreateIndex
CREATE INDEX "reports_projectId_type_createdAt_idx" ON "reports"("projectId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "design_rounds_id_projectId_key" ON "design_rounds"("id", "projectId");

-- CreateIndex
CREATE INDEX "generation_jobs_baseVariantId_idx" ON "generation_jobs"("baseVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_roundId_idempotencyKey_key" ON "generation_jobs"("roundId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "project_members_organizationId_userId_idx" ON "project_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organizationId_key" ON "projects"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ui_variants_parentVariantId_idx" ON "ui_variants"("parentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ui_variants_id_roundId_key" ON "ui_variants"("id", "roundId");

-- CreateIndex
CREATE INDEX "user_stories_generationId_idx" ON "user_stories"("generationId");

-- ---------------------------------------------------------------------------
-- Backfill: every existing project is put into an organization.
--   owner of a project = its creator, else its earliest DESIGNER;
--   one organization per distinct owner; a project nobody owns (no creator and
--   no designer) gets its own organization with no members.
-- Nothing is deleted or rewritten; existing members keep access through
-- organization membership (project DESIGNER -> organization DESIGNER).
-- ---------------------------------------------------------------------------
CREATE TABLE "_project_owner" AS
SELECT p."id" AS "project_id",
       COALESCE(
         p."createdById",
         (SELECT m."userId" FROM "project_members" m
           WHERE m."projectId" = p."id" AND m."role" = 'DESIGNER'
           ORDER BY m."joinedAt" LIMIT 1)
       ) AS "owner_id"
FROM "projects" p;

CREATE TABLE "_owner_org" AS
SELECT o."owner_id", gen_random_uuid() AS "org_id"
FROM (SELECT DISTINCT "owner_id" FROM "_project_owner" WHERE "owner_id" IS NOT NULL) o;

CREATE TABLE "_project_org" AS
SELECT po."project_id", COALESCE(oo."org_id", gen_random_uuid()) AS "org_id", (oo."org_id" IS NULL) AS "orphan"
FROM "_project_owner" po
LEFT JOIN "_owner_org" oo ON oo."owner_id" = po."owner_id";

INSERT INTO "organizations" ("id", "name", "createdById", "createdAt", "updatedAt")
SELECT oo."org_id", LEFT(COALESCE(NULLIF(u."name", ''), u."email") || '''s organization', 160), oo."owner_id", now(), now()
FROM "_owner_org" oo JOIN "users" u ON u."id" = oo."owner_id";

INSERT INTO "organizations" ("id", "name", "createdById", "createdAt", "updatedAt")
SELECT pr."org_id", LEFT(p."name", 160), NULL, now(), now()
FROM "_project_org" pr JOIN "projects" p ON p."id" = pr."project_id"
WHERE pr."orphan";

INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "joinedAt")
SELECT gen_random_uuid(), oo."org_id", oo."owner_id", 'OWNER', now() FROM "_owner_org" oo;

INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "joinedAt")
SELECT gen_random_uuid(), pr."org_id", m."userId",
       (CASE WHEN bool_or(m."role" = 'DESIGNER') THEN 'DESIGNER' ELSE 'MEMBER' END)::"OrganizationRole",
       now()
FROM "_project_org" pr JOIN "project_members" m ON m."projectId" = pr."project_id"
GROUP BY pr."org_id", m."userId"
ON CONFLICT ("organizationId", "userId") DO NOTHING;

UPDATE "projects" p SET "organizationId" = pr."org_id"
FROM "_project_org" pr WHERE pr."project_id" = p."id";

UPDATE "project_members" m SET "organizationId" = p."organizationId"
FROM "projects" p WHERE p."id" = m."projectId";

ALTER TABLE "projects" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "project_members" ALTER COLUMN "organizationId" SET NOT NULL;

DROP TABLE "_project_org";
DROP TABLE "_owner_org";
DROP TABLE "_project_owner";

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "projects"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "organization_members"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stories" ADD CONSTRAINT "user_stories_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "story_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_baseVariantId_fkey" FOREIGN KEY ("baseVariantId") REFERENCES "ui_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_parentVariantId_fkey" FOREIGN KEY ("parentVariantId") REFERENCES "ui_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_generations" ADD CONSTRAINT "story_generations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_generations" ADD CONSTRAINT "story_generations_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_roundId_projectId_fkey" FOREIGN KEY ("roundId", "projectId") REFERENCES "design_rounds"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_variants" ADD CONSTRAINT "session_variants_sessionId_roundId_fkey" FOREIGN KEY ("sessionId", "roundId") REFERENCES "test_sessions"("id", "roundId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_variants" ADD CONSTRAINT "session_variants_variantId_roundId_fkey" FOREIGN KEY ("variantId", "roundId") REFERENCES "ui_variants"("id", "roundId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_assignedVariantId_fkey" FOREIGN KEY ("sessionId", "assignedVariantId") REFERENCES "session_variants"("sessionId", "variantId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId") REFERENCES "session_participants"("id", "sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tasks" ADD CONSTRAINT "test_tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_taskId_sessionId_fkey" FOREIGN KEY ("taskId", "sessionId") REFERENCES "test_tasks"("id", "sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId") REFERENCES "session_participants"("id", "sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_sessionId_variantId_fkey" FOREIGN KEY ("sessionId", "variantId") REFERENCES "session_variants"("sessionId", "variantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId") REFERENCES "session_participants"("id", "sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_sessionId_variantId_fkey" FOREIGN KEY ("sessionId", "variantId") REFERENCES "session_variants"("sessionId", "variantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "task_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId") REFERENCES "session_participants"("id", "sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_sessionId_variantId_fkey" FOREIGN KEY ("sessionId", "variantId") REFERENCES "session_variants"("sessionId", "variantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "task_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_roundId_projectId_fkey" FOREIGN KEY ("roundId", "projectId") REFERENCES "design_rounds"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "feedback_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_themes" ADD CONSTRAINT "feedback_themes_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "feedback_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_feedback" ADD CONSTRAINT "theme_feedback_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "feedback_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_feedback" ADD CONSTRAINT "theme_feedback_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_roundId_projectId_fkey" FOREIGN KEY ("roundId", "projectId") REFERENCES "design_rounds"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "test_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "feedback_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "feedback_themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_feedback_links" ADD CONSTRAINT "round_feedback_links_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_feedback_links" ADD CONSTRAINT "round_feedback_links_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "feedback_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_comments" ADD CONSTRAINT "round_comments_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_comments" ADD CONSTRAINT "round_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_acknowledgements" ADD CONSTRAINT "round_acknowledgements_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_acknowledgements" ADD CONSTRAINT "round_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity rules Prisma cannot express
-- ---------------------------------------------------------------------------

-- Feedback is either a comment or an explicit skip; component feedback names its node.
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_comment_or_skipped_check"
  CHECK ("skipped" OR ("comment" IS NOT NULL AND length(btrim("comment")) > 0));
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_component_node_check"
  CHECK ("scope" <> 'COMPONENT' OR "nodeId" IS NOT NULL);
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_rating_range_check"
  CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_window_check"
  CHECK ("expiresAt" IS NULL OR "startsAt" IS NULL OR "expiresAt" > "startsAt");

-- Raw participant feedback is immutable: what the participant said is never
-- overwritten (analysis and designer edits live in feedback_themes).
CREATE FUNCTION "feedback_prevent_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'feedback is immutable (id %)', OLD."id" USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "feedback_immutable"
  BEFORE UPDATE ON "feedback"
  FOR EACH ROW
  WHEN (
    NEW."comment" IS DISTINCT FROM OLD."comment"
    OR NEW."skipped" IS DISTINCT FROM OLD."skipped"
    OR NEW."rating" IS DISTINCT FROM OLD."rating"
    OR NEW."scope" IS DISTINCT FROM OLD."scope"
    OR NEW."nodeId" IS DISTINCT FROM OLD."nodeId"
    OR NEW."screenId" IS DISTINCT FROM OLD."screenId"
    OR NEW."participantId" IS DISTINCT FROM OLD."participantId"
    OR NEW."variantId" IS DISTINCT FROM OLD."variantId"
    OR NEW."sessionId" IS DISTINCT FROM OLD."sessionId"
  )
  EXECUTE FUNCTION "feedback_prevent_update"();

-- Consent history is append-only.
CREATE FUNCTION "consent_records_prevent_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent records are append-only' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "consent_records_no_update"
  BEFORE UPDATE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION "consent_records_prevent_update"();
