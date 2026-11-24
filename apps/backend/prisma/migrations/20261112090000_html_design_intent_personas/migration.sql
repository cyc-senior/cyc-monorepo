-- Organization → Project → User Persona; design intent as its own step; HTML designs.
-- Additive and data-preserving: every value of the dropped project brief columns
-- is copied into design_intents (and the target persona into user_personas)
-- before the columns are dropped.

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET');

-- CreateEnum
CREATE TYPE "PersonaOrigin" AS ENUM ('MANUAL', 'AI');

-- ---------------------------------------------------------------------------
-- Organization roles: OWNER/DESIGNER/MEMBER -> ADMIN/MEMBER.
-- OWNER becomes ADMIN; DESIGNER becomes MEMBER (least privilege: an admin can
-- promote them). Nobody loses membership.
-- ---------------------------------------------------------------------------
CREATE TYPE "OrganizationRole_new" AS ENUM ('ADMIN', 'MEMBER');
ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE "OrganizationRole_new"
  USING (CASE "role"::text WHEN 'OWNER' THEN 'ADMIN' ELSE 'MEMBER' END)::"OrganizationRole_new";
ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";
ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";
DROP TYPE "public"."OrganizationRole_old";

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

-- CreateIndex
CREATE UNIQUE INDEX "design_intents_projectId_key" ON "design_intents"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "user_personas_generationJobId_key" ON "user_personas"("generationJobId");

-- CreateIndex
CREATE INDEX "user_personas_projectId_createdAt_idx" ON "user_personas"("projectId", "createdAt");

-- ---------------------------------------------------------------------------
-- Project: new creation fields (backfilled), then the brief moves out.
-- ---------------------------------------------------------------------------
ALTER TABLE "projects" ADD COLUMN "clientOrProduct" TEXT,
ADD COLUMN "platforms" "Platform"[] DEFAULT ARRAY['DESKTOP']::"Platform"[];

-- Existing projects did not record a client/product: use their name.
UPDATE "projects" SET "clientOrProduct" = "name" WHERE "clientOrProduct" IS NULL;
UPDATE "projects" SET "platforms" = ARRAY['DESKTOP']::"Platform"[] WHERE "platforms" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "clientOrProduct" SET NOT NULL;

INSERT INTO "design_intents" (
  "id", "projectId", "statement", "designSystem", "designGuidelines",
  "brandGuidelines", "toneOfVoice", "legacyBrief", "version", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  NULLIF(btrim(p."designIntent"), ''),
  p."uiLibrary",
  CASE WHEN p."designGuidelines" = '{}'::jsonb THEN NULL ELSE p."designGuidelines"::text END,
  CASE WHEN p."brandIdentity" = '{}'::jsonb THEN NULL ELSE p."brandIdentity"::text END,
  CASE WHEN p."toneOfVoice" = '{}'::jsonb THEN NULL ELSE p."toneOfVoice"::text END,
  jsonb_build_object(
    'targetPersona', p."targetPersona",
    'designGuidelines', p."designGuidelines",
    'brandIdentity', p."brandIdentity",
    'toneOfVoice', p."toneOfVoice",
    'designTokens', p."designTokens"
  ),
  p."designVersion",
  now(),
  now()
FROM "projects" p;

-- Brand colors, when the old tokens had them as hex values.
UPDATE "design_intents" d SET
  "primaryColor" = CASE WHEN d."legacyBrief" #>> '{designTokens,colors,primary}' ~ '^#[0-9A-Fa-f]{6}$'
                        THEN d."legacyBrief" #>> '{designTokens,colors,primary}' END,
  "secondaryColor" = CASE WHEN d."legacyBrief" #>> '{designTokens,colors,secondary}' ~ '^#[0-9A-Fa-f]{6}$'
                          THEN d."legacyBrief" #>> '{designTokens,colors,secondary}' END,
  "accentColor" = CASE WHEN d."legacyBrief" #>> '{designTokens,colors,accent}' ~ '^#[0-9A-Fa-f]{6}$'
                       THEN d."legacyBrief" #>> '{designTokens,colors,accent}' END;

-- The old free-form target persona becomes the project's first persona.
INSERT INTO "user_personas" (
  "id", "projectId", "origin", "name", "age", "shortDescription",
  "behavioralConsiderations", "frustrations", "goals", "tasks", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  'MANUAL',
  LEFT(COALESCE(NULLIF(btrim(p."targetPersona" ->> 'name'), ''), 'Primary persona'), 120),
  CASE WHEN (p."targetPersona" ->> 'age') ~ '^[0-9]{1,3}$' THEN (p."targetPersona" ->> 'age')::int END,
  LEFT(COALESCE(
    NULLIF(btrim(p."targetPersona" ->> 'description'), ''),
    NULLIF(btrim(p."targetPersona" ->> 'summary'), ''),
    p."targetPersona"::text
  ), 2000),
  CASE WHEN jsonb_typeof(p."targetPersona" -> 'behavioralConsiderations') = 'array'
       THEN ARRAY(SELECT jsonb_array_elements_text(p."targetPersona" -> 'behavioralConsiderations')) ELSE '{}' END,
  CASE WHEN jsonb_typeof(p."targetPersona" -> 'frustrations') = 'array'
       THEN ARRAY(SELECT jsonb_array_elements_text(p."targetPersona" -> 'frustrations')) ELSE '{}' END,
  CASE WHEN jsonb_typeof(p."targetPersona" -> 'goals') = 'array'
       THEN ARRAY(SELECT jsonb_array_elements_text(p."targetPersona" -> 'goals')) ELSE '{}' END,
  CASE WHEN jsonb_typeof(p."targetPersona" -> 'tasks') = 'array'
       THEN ARRAY(SELECT jsonb_array_elements_text(p."targetPersona" -> 'tasks')) ELSE '{}' END,
  now(),
  now()
FROM "projects" p
WHERE p."targetPersona" IS NOT NULL AND p."targetPersona" <> '{}'::jsonb;

-- Now that every value is copied, drop the brief columns from projects.
ALTER TABLE "projects" DROP COLUMN "brandIdentity",
DROP COLUMN "designGuidelines",
DROP COLUMN "designIntent",
DROP COLUMN "designTokens",
DROP COLUMN "designVersion",
DROP COLUMN "targetPersona",
DROP COLUMN "toneOfVoice",
DROP COLUMN "uiLibrary";

-- ---------------------------------------------------------------------------
-- Variants: high-fidelity HTML; the JSON design of older variants is kept.
-- ---------------------------------------------------------------------------
ALTER TABLE "ui_variants" ADD COLUMN "html" TEXT,
ALTER COLUMN "design" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "design_intents" ADD CONSTRAINT "design_intents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity rules Prisma cannot express
-- ---------------------------------------------------------------------------
ALTER TABLE "projects" ADD CONSTRAINT "projects_platforms_check"
  CHECK ("platforms" IS NOT NULL AND cardinality("platforms") >= 1);

ALTER TABLE "design_intents" ADD CONSTRAINT "design_intents_colors_check" CHECK (
  ("primaryColor" IS NULL OR "primaryColor" ~ '^#[0-9A-Fa-f]{6}$') AND
  ("secondaryColor" IS NULL OR "secondaryColor" ~ '^#[0-9A-Fa-f]{6}$') AND
  ("accentColor" IS NULL OR "accentColor" ~ '^#[0-9A-Fa-f]{6}$')
);

ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_age_check"
  CHECK ("age" IS NULL OR "age" BETWEEN 1 AND 120);

-- A variant has an HTML design or (legacy) a JSON one.
ALTER TABLE "ui_variants" ADD CONSTRAINT "ui_variants_design_present_check"
  CHECK ("html" IS NOT NULL OR "design" IS NOT NULL);
