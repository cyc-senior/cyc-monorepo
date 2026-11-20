-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('DESIGNER', 'PROJECT_MANAGER', 'PRODUCT_OWNER', 'CLIENT', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UiLibrary" AS ENUM ('SHADCN', 'MUI');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET');

-- CreateEnum
CREATE TYPE "PersonaOrigin" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "UserStoryStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StoryOrigin" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "DesignRoundStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UIVariantStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'ARCHIVED');

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

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID,
    "avatarKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "userId" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "workspace_avatars" (
    "workspaceId" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_avatars_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "invitedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "clientOrProduct" TEXT NOT NULL,
    "description" TEXT,
    "platforms" "Platform"[] DEFAULT ARRAY['DESKTOP']::"Platform"[],
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_intents" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "statement" TEXT,
    "designSystem" "UiLibrary" NOT NULL DEFAULT 'SHADCN',
    "designStandards" TEXT[] DEFAULT ARRAY['WCAG 2.1 AA']::TEXT[],
    "designGuidelines" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "brandGuidelines" TEXT,
    "toneOfVoice" TEXT,
    "legacyBrief" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_personas" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "origin" "PersonaOrigin" NOT NULL DEFAULT 'MANUAL',
    "generationJobId" UUID,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "shortDescription" TEXT NOT NULL,
    "behavioralConsiderations" TEXT[],
    "frustrations" TEXT[],
    "goals" TEXT[],
    "tasks" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stories" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "origin" "StoryOrigin" NOT NULL DEFAULT 'MANUAL',
    "generationId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "problemStatement" TEXT,
    "status" "UserStoryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_rounds" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "title" TEXT,
    "parentRoundId" UUID,
    "status" "DesignRoundStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "requestedById" UUID,
    "uiLibrary" "UiLibrary" NOT NULL,
    "prompt" TEXT,
    "baseVariantId" UUID,
    "idempotencyKey" TEXT,
    "variantCount" INTEGER NOT NULL,
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

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_variants" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "generationJobId" UUID,
    "parentVariantId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "label" TEXT,
    "uiLibrary" "UiLibrary" NOT NULL,
    "html" TEXT,
    "design" JSONB,
    "accessibility" JSONB NOT NULL DEFAULT '{}',
    "thumbnailUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "UIVariantStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "changes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
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
    "userId" UUID,
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

-- CreateTable
CREATE TABLE "_VariantStories" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_VariantStories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatarKey_key" ON "users"("avatarKey");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_avatarKey_key" ON "workspaces"("avatarKey");

-- CreateIndex
CREATE INDEX "workspaces_createdById_idx" ON "workspaces"("createdById");

-- CreateIndex
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_workspaceId_email_key" ON "workspace_invitations"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");

-- CreateIndex
CREATE INDEX "projects_createdById_idx" ON "projects"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_workspaceId_key" ON "projects"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "design_intents_projectId_key" ON "design_intents"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "user_personas_generationJobId_key" ON "user_personas"("generationJobId");

-- CreateIndex
CREATE INDEX "user_personas_projectId_createdAt_idx" ON "user_personas"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE INDEX "project_members_workspaceId_userId_idx" ON "project_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "user_stories_projectId_idx" ON "user_stories"("projectId");

-- CreateIndex
CREATE INDEX "user_stories_generationId_idx" ON "user_stories"("generationId");

-- CreateIndex
CREATE INDEX "design_rounds_parentRoundId_idx" ON "design_rounds"("parentRoundId");

-- CreateIndex
CREATE INDEX "design_rounds_approvedById_idx" ON "design_rounds"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "design_rounds_id_projectId_key" ON "design_rounds"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "design_rounds_projectId_roundNumber_key" ON "design_rounds"("projectId", "roundNumber");

-- CreateIndex
CREATE INDEX "generation_jobs_roundId_idx" ON "generation_jobs"("roundId");

-- CreateIndex
CREATE INDEX "generation_jobs_requestedById_idx" ON "generation_jobs"("requestedById");

-- CreateIndex
CREATE INDEX "generation_jobs_baseVariantId_idx" ON "generation_jobs"("baseVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_roundId_idempotencyKey_key" ON "generation_jobs"("roundId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ui_variants_roundId_idx" ON "ui_variants"("roundId");

-- CreateIndex
CREATE INDEX "ui_variants_generationJobId_idx" ON "ui_variants"("generationJobId");

-- CreateIndex
CREATE INDEX "ui_variants_parentVariantId_idx" ON "ui_variants"("parentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ui_variants_id_roundId_key" ON "ui_variants"("id", "roundId");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

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
CREATE INDEX "session_participants_userId_idx" ON "session_participants"("userId");

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
CREATE INDEX "_VariantStories_B_index" ON "_VariantStories"("B");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_avatars" ADD CONSTRAINT "workspace_avatars_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_intents" ADD CONSTRAINT "design_intents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "projects"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspaceId_userId_fkey" FOREIGN KEY ("workspaceId", "userId") REFERENCES "workspace_members"("workspaceId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stories" ADD CONSTRAINT "user_stories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stories" ADD CONSTRAINT "user_stories_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "story_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_rounds" ADD CONSTRAINT "design_rounds_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_rounds" ADD CONSTRAINT "design_rounds_parentRoundId_fkey" FOREIGN KEY ("parentRoundId") REFERENCES "design_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_rounds" ADD CONSTRAINT "design_rounds_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_baseVariantId_fkey" FOREIGN KEY ("baseVariantId") REFERENCES "ui_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "design_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_parentVariantId_fkey" FOREIGN KEY ("parentVariantId") REFERENCES "ui_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "_VariantStories" ADD CONSTRAINT "_VariantStories_A_fkey" FOREIGN KEY ("A") REFERENCES "ui_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VariantStories" ADD CONSTRAINT "_VariantStories_B_fkey" FOREIGN KEY ("B") REFERENCES "user_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
