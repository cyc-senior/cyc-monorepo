-- Rename Organization to Workspace, keeping every row.
--
-- Prisma's generated diff would drop the organization tables and create empty
-- workspace tables. This migration renames them in place instead, so existing
-- databases keep their workspaces, members, invitations and pictures.

-- Enum
ALTER TYPE "OrganizationRole" RENAME TO "WorkspaceRole";

-- Tables
ALTER TABLE "organizations" RENAME TO "workspaces";
ALTER TABLE "organization_avatars" RENAME TO "workspace_avatars";
ALTER TABLE "organization_invitations" RENAME TO "workspace_invitations";
ALTER TABLE "organization_members" RENAME TO "workspace_members";

-- Columns
ALTER TABLE "workspace_avatars" RENAME COLUMN "organizationId" TO "workspaceId";
ALTER TABLE "workspace_invitations" RENAME COLUMN "organizationId" TO "workspaceId";
ALTER TABLE "workspace_members" RENAME COLUMN "organizationId" TO "workspaceId";
ALTER TABLE "projects" RENAME COLUMN "organizationId" TO "workspaceId";
ALTER TABLE "project_members" RENAME COLUMN "organizationId" TO "workspaceId";

-- Primary keys
ALTER TABLE "workspaces" RENAME CONSTRAINT "organizations_pkey" TO "workspaces_pkey";
ALTER TABLE "workspace_avatars" RENAME CONSTRAINT "organization_avatars_pkey" TO "workspace_avatars_pkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "organization_invitations_pkey" TO "workspace_invitations_pkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "organization_members_pkey" TO "workspace_members_pkey";

-- Foreign keys
ALTER TABLE "workspaces" RENAME CONSTRAINT "organizations_createdById_fkey" TO "workspaces_createdById_fkey";
ALTER TABLE "workspace_avatars" RENAME CONSTRAINT "organization_avatars_organizationId_fkey" TO "workspace_avatars_workspaceId_fkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "organization_invitations_organizationId_fkey" TO "workspace_invitations_workspaceId_fkey";
ALTER TABLE "workspace_invitations" RENAME CONSTRAINT "organization_invitations_invitedById_fkey" TO "workspace_invitations_invitedById_fkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "organization_members_organizationId_fkey" TO "workspace_members_workspaceId_fkey";
ALTER TABLE "workspace_members" RENAME CONSTRAINT "organization_members_userId_fkey" TO "workspace_members_userId_fkey";
ALTER TABLE "projects" RENAME CONSTRAINT "projects_organizationId_fkey" TO "projects_workspaceId_fkey";
ALTER TABLE "project_members" RENAME CONSTRAINT "project_members_projectId_organizationId_fkey" TO "project_members_projectId_workspaceId_fkey";
ALTER TABLE "project_members" RENAME CONSTRAINT "project_members_organizationId_userId_fkey" TO "project_members_workspaceId_userId_fkey";

-- Indexes
ALTER INDEX "organizations_createdById_idx" RENAME TO "workspaces_createdById_idx";
ALTER INDEX "organizations_avatarKey_key" RENAME TO "workspaces_avatarKey_key";
ALTER INDEX "organization_invitations_email_idx" RENAME TO "workspace_invitations_email_idx";
ALTER INDEX "organization_invitations_organizationId_email_key" RENAME TO "workspace_invitations_workspaceId_email_key";
ALTER INDEX "organization_members_userId_idx" RENAME TO "workspace_members_userId_idx";
ALTER INDEX "organization_members_organizationId_userId_key" RENAME TO "workspace_members_workspaceId_userId_key";
ALTER INDEX "projects_organizationId_idx" RENAME TO "projects_workspaceId_idx";
ALTER INDEX "projects_id_organizationId_key" RENAME TO "projects_id_workspaceId_key";
ALTER INDEX "project_members_organizationId_userId_idx" RENAME TO "project_members_workspaceId_userId_idx";

-- A workspace's avatarKey is now null while it has no picture.
UPDATE "workspaces" w SET "avatarKey" = NULL
WHERE NOT EXISTS (SELECT 1 FROM "workspace_avatars" a WHERE a."workspaceId" = w."id");

-- Uploaded user profile photos
ALTER TABLE "users" ADD COLUMN "avatarKey" TEXT;
CREATE UNIQUE INDEX "users_avatarKey_key" ON "users"("avatarKey");

CREATE TABLE "user_avatars" (
    "userId" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
