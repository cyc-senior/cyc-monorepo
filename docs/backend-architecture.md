# Backend architecture

NestJS 11 modular monolith (`apps/backend`), REST + Server-Sent Events,
PostgreSQL via Prisma 7, Redis for the response cache and BullMQ, an OpenAI-
compatible client for the CPE AI Gateway. Everything is under the global prefix
`/api`. Authorization is described in [`authorization.md`](./authorization.md),
endpoints in [`api-authorization-matrix.md`](./api-authorization-matrix.md).

## 1. Modules and boundaries

```
src/
  app.module.ts            wiring, global ValidationPipe + Prisma exception filter
  common/                  db-lock, crypto, scopes, decisions, pii, rate-limit, logging, security headers, DTO helpers
  config/                  environment validation (fails fast)
  prisma/ cache/           database client; Redis response cache (fail-open)
  modules/
    access/                roles → permissions (project + organization), guards, @Authorize / @AuthorizeOrg
    auth/ users/           Google OAuth, access JWT (iss/aud), rotating refresh tokens; profile
    organizations/         tenant boundary: organizations and their members
    projects/              projects (name, client/product, description, platforms), project members
    design/                design intent, user personas, user stories; html/ = sanitizer + WCAG/brand/platform checker
    rounds/                design rounds, UI variants (approve, lineage), generation jobs + SSE
    generation/            design-generation queue, worker, persona synthesizer, HTML generator, prompt template, LLM client   (BullMQ `design-generation`)
    testing/               test sessions, tasks, participants, consent, tester API, raw results
    ai/                    feedback analysis, theme review, story drafting       (BullMQ `ai-tasks`)
    iteration/             next-round from selected feedback, decision history, round trace
    stakeholders/          shared rounds, handoff, project status, reports
    audit/ health/
```

Dependency direction: feature modules depend on `access`, `common`, `prisma`,
`cache`; `ai` depends on `generation` (LLM client) and reads testing data;
`stakeholders` and `iteration` read what the others write. Nothing depends on a
controller. Cross-module reuse is by plain helpers (`rounds/round-state.ts`,
`common/decisions.ts`) rather than service imports, so there are no module
cycles.

## 2. Data model

```
User ─┬─ OrganizationMember (ADMIN | MEMBER) ── Organization ──< Project
      └─ ProjectMember ────────┐ (organizationId, userId) → OrganizationMember
                               └ (projectId, organizationId) → Project
Project ─┬─ DesignIntent (1:1: design system & standards, 3 brand colors, tone of voice, version)
         ├─ UserPersona (MANUAL | AI) ◄─ GenerationJob (persona artifact, 1 per job)
         ├─ UserStory ◄─ StoryGeneration
         ├─ DesignRound ─┬─ UIVariant (html; legacy design JSON; parentVariantId, approvedBy/At)
         │               ├─ GenerationJob (prompt, baseVariantId, idempotencyKey)
         │               ├─ RoundFeedbackLink ──► FeedbackTheme
         │               ├─ RoundComment, RoundAcknowledgement
         │               └─ TestSession ─┬─ SessionVariant (variant ∈ round)
         │                               ├─ TestTask ◄─ TaskRun
         │                               ├─ SessionParticipant ─┬─ ConsentRecord (append-only)
         │                               │                      ├─ InteractionEvent
         │                               │                      └─ Feedback (immutable)
         ├─ FeedbackAnalysis ── FeedbackTheme ── ThemeFeedback ──► Feedback
         ├─ DesignDecision (append-only)
         ├─ Report
         └─ AuditLog
```

Conceptual models of the proposal → tables: Organization, Project, User Persona
(`user_personas`), Design Intent (`design_intents`), Story
(`user_stories`), Variant (`ui_variants`), Session (`test_sessions`), Task
(`test_tasks` / `task_runs`), Feedback (`feedback`), Round (`design_rounds`),
Report (`reports`), plus Membership, SessionParticipant, ConsentRecord,
InteractionEvent, AIAnalysis
(`feedback_analyses` + `feedback_themes`), DesignDecision, and the invitation
(`session_participants.inviteTokenHash`).

### Four layers of feedback, never merged

| Layer | Where | Who writes | Mutable |
|---|---|---|---|
| Raw participant feedback | `feedback` | the participant, once | **no** (DB trigger) |
| AI-generated analysis | `feedback_analyses.ai*`, `feedback_themes.ai*` | the worker, once | no |
| Designer-reviewed analysis | `feedback_analyses.summary/insights`, `feedback_themes.title/summary/category/severity/labels/designerNote/status` | designers | yes, while READY |
| Final design decisions | `design_decisions`, `round_feedback_links`, `ui_variants.approved*`, `design_rounds.approved*` | designers | append-only |

### Integrity rules (migration `20261111090000_organizations_testing_analysis`)

* Composite foreign keys keep children inside their tenant: project members ⊂
  project's organization; sessions/analyses/decisions ⊂ round's project;
  session variants ⊂ session's round; participant data ⊂ participant's
  session; assigned group ⊂ session variants.
* `ON DELETE`: project deletion cascades its data (explicit, irreversible, as
  before); an organization with projects cannot be deleted (`RESTRICT`);
  removing an organization member is done in a transaction that first removes
  their project memberships.
* Check constraints: feedback is a comment *or* a skip; component feedback has a
  node; rating 1–5; session window ordering. Triggers: feedback and consent rows
  cannot be updated.
* Indexes on every foreign key used for scoping and on the hot listing paths.
* The migration backfills an organization for every existing project (owner =
  creator or earliest designer) before making `organizationId` required; it
  deletes and rewrites nothing. It was applied to an empty database and to a
  database holding pre-migration data, and `prisma migrate diff` reported no
  drift between migrations and `schema.prisma`.
* Transactions + advisory locks (`common/db-lock.ts`) serialise read-then-write
  rules: last owner/designer, round numbering, task positions, participant
  balancing, analysis review.

## 3. Major flows

**Design loop (M1–M3).** `POST /organizations` (creator = ADMIN) →
`POST /organizations/:org/projects` (ADMIN; name, client/product, description,
platforms) → `PUT …/design-intent` + `POST …/personas` →
`POST …/rounds/:r/generation-jobs` (202; `prompt`, optional `personaIds`,
`baseVariantId`, `idempotencyKey`) → BullMQ `design-generation` → worker:
synthesizes and saves a **persona artifact** (text model), fills the prompt
template (project, intent, personas, stories, prompt), generates **HTML**,
sanitizes and checks it (structure, WCAG 2.1 AA markup, platforms, brand
colors), repairs, saves READY variants → `POST …/variants/:v/approve`
(designer) → APPROVED. Details: [`design-generation-and-personas.md`](./design-generation-and-personas.md).

**Testing.** `POST …/test-sessions` (approved variants only) → tasks →
`POST …/participants` (invitations shown once) → `activate` → tester:
`POST /testing/join` → consent → onboarding → `tasks/:id/start`,
`events`, `feedback` → `complete`. Designer: `progress`, raw `feedback`/`events`/
`consents`, `end`.

**Analysis and iteration.** `POST …/analyses` (snapshot of the feedback ids,
202) → BullMQ `ai-tasks` → worker: re-authorize requester, load text of that
project's non-withdrawn feedback, mask contact details, call the text model with
a JSON schema, validate and resolve references, save themes `PROPOSED` and
analysis `READY` (transaction guarded by status) → designer reviews (edit,
merge, split, accept/reject, won't-fix with reason) → `approve` → `select` themes
→ `POST …/rounds/:r/iterate` (new round, `round_feedback_links`, optional
carried-forward variants, `ITERATION_STARTED` decision) → generation in the new
round receives the reviewed themes in its prompt → …

**Stakeholders.** Approving a round shares it: `shared-rounds` (client,
developer, PM), `acknowledge`/`comments` (client), `handoff` (developer),
`status` (designer, PM), `reports` (generated by designers; each role lists only
its own audience).

## 4. AI processing and BullMQ

| Queue | Jobs | Model (env) | Result |
|---|---|---|---|
| `design-generation` | persona artifact, then HTML design variants / refinements | persona: `LLM_ANALYSIS_MODEL`; designs: `LLM_MODEL` (proposal: muse-glimmer-30b; checked-in default `qwen3.8-27b`, set per environment) | AI persona + READY HTML variants |
| `ai-tasks` | `feedback-analysis`, `story-generation` | `LLM_ANALYSIS_MODEL` (default `LLM_MODEL`; proposal: qwen3.8-27b) | READY analysis / DRAFT stories |

Both follow the same reliability pattern:

* The database row is the source of truth; BullMQ job id = row id (enqueue is
  idempotent); payload is only the row id (and kind).
* HTTP returns `202` immediately; clients follow progress over SSE.
* Retries: 3 attempts, exponential backoff for transient errors (LLM timeout,
  network, 5xx, malformed/unmatched answer); `UnrecoverableError` for permanent
  ones. AI tasks also have a 10-minute hard timeout (design generation relies on the LLM client timeout). Cancel is cooperative
  (status poll → abort signal) and never saves partial output.
* Results are validated (zod schemas; references resolved against the input;
  HTML sanitized and checked) before persistence and saved in one transaction conditional on the row still
  being `RUNNING`; a retried or duplicated job cannot save twice.
* The worker re-checks the requester's permission at execution time; boot-time
  reconciliation re-queues jobs the queue lost and fails ones it settled; graceful
  drain on shutdown; `GENERATION_WORKER=false` makes an instance API-only (the
  switch covers both queues).
* The persona artifact is saved before the designs (kept if they fail) and is
  unique per job, so a retry reuses it.
* Client `idempotencyKey` (unique per round / project) makes repeated submits
  return the original job.
* Monitoring: structured logs (`ai.queued`, `analysis.started/succeeded`,
  `ai.task_failed`, `llm.completion` with token usage), queue errors, row status
  and `outputMetadata`. There is no queue dashboard (Bull Board) yet.

### SSE

`GET …/generation-jobs/:id/events`, `…/analyses/:id/events`,
`…/story-generations/:id/events`: bearer auth, project permission, the id is
looked up through the project **before** the stream opens, and the stream carries
only that job's state, re-read from the database on each queue signal
(subscribed before the first read, so nothing is lost; reconnect-safe).
Heartbeat 15 s. Nothing is broadcast globally. Limitation: authorization is
evaluated at connect time (a member removed mid-stream keeps the stream until the
job ends).

## 5. Cross-cutting

* **Auth tokens**: access JWT HS256 15 min with `iss=cyc-backend`,
  `aud=cyc-api`; refresh tokens opaque, hashed, rotating, reuse-detecting.
  Tester tokens `aud=cyc-testing`, ≤ `TESTER_TOKEN_TTL_SECONDS` and never past the
  session deadline.
* **Rate limiting**: in-process sliding window on the public tester endpoint
  (20/min/IP) and per-participant limits on consent, events, feedback
  (`TRUST_PROXY` for real client IPs behind a proxy). Per instance, not
  distributed.
* **Headers**: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, `Cache-Control: no-store`, HSTS in production, no
  `X-Powered-By`. CORS limited to `FRONTEND_URL`. Swagger can be switched off
  (`SWAGGER_ENABLED`; default off in production).
* **Logging**: request id on every line; denial reasons logged; participant
  emails and feedback text are not logged; Prisma query parameters are never
  logged; audit entries for invitation calls omit bodies.
* **Cache**: GET responses of project routes (per user and role), invalidated by
  any write in the project; live testing/analysis endpoints are `@NoCache()`;
  tester writes invalidate explicitly.
* **Pagination**: every list returns `{data,total,limit,offset}`, `limit ≤ 100`.
