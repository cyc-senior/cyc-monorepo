-- CreateTable
CREATE TABLE "story_personas" (
    "storyId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_personas_pkey" PRIMARY KEY ("storyId","personaId")
);

-- CreateIndex
CREATE INDEX "story_personas_personaId_idx" ON "story_personas"("personaId");

-- AddForeignKey
ALTER TABLE "story_personas" ADD CONSTRAINT "story_personas_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "user_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_personas" ADD CONSTRAINT "story_personas_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "user_personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: stories used to keep their Scope personas as a
-- "Target Personas: <id>, <id>" line in the description. Move those ids
-- (only personas of the same project) into story_personas…
INSERT INTO "story_personas" ("storyId", "personaId")
SELECT DISTINCT s."id", p."id"
FROM "user_stories" s
CROSS JOIN LATERAL regexp_split_to_table(
  substring(s."description" from 'Target Personas:[ \t]*([^\n]*)'),
  ','
) AS raw(id)
JOIN "user_personas" p
  ON p."id"::text = btrim(raw.id)
 AND p."projectId" = s."projectId"
WHERE s."description" LIKE '%Target Personas:%'
ON CONFLICT DO NOTHING;

-- …and drop the line, so persona ids stop reaching the LLM in the story text.
UPDATE "user_stories"
SET "description" = NULLIF(
  btrim(regexp_replace("description", '(^|\n)Target Personas:[^\n]*', '', 'g'), E' \n'),
  ''
)
WHERE "description" LIKE '%Target Personas:%';
