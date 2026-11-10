# Backend implementation report

Branch `feat/backend-domain-rbac`, on top of commit `03b0ab0`. Scope: `apps/backend`
only (no frontend changes). Companion documents:
[`backend-audit.md`](./backend-audit.md) (findings),
[`backend-architecture.md`](./backend-architecture.md),
[`authorization.md`](./authorization.md),
[`api-authorization-matrix.md`](./api-authorization-matrix.md).

## 1. Validation status — read this first

The task restricted automated validation to **linting**. No unit, integration or
end-to-end test was written or run, and no test file was modified.

| Check | Result |
|---|---|
| **Lint** — `pnpm lint` in `apps/backend` (= `eslint "{src,test,scripts}/**/*.ts" --fix`, ESLint 8 + `@typescript-eslint/recommended` + `prettier`) | **exit 0, 0 errors, 0 warnings** (run after the last code change; `--fix` is part of the repo's script and reformatted some new files) |
| Type-check — `tsc --noEmit -p tsconfig.json` | 0 errors in `src/` non-spec files; **2 errors in existing spec files** (stale, see §6) |
| Build — `pnpm build` (`nest build`) | exit 0 |

Additional non-test checks I ran, so they are reported rather than hidden. They
show the code *loads and the schema is consistent*; they do **not** show that any
feature behaves correctly:

* Prisma migration applied to a fresh scratch database and to one pre-loaded with
  pre-migration rows (organizations backfilled as designed); `prisma migrate diff`
  between the migrated database and `schema.prisma`: *No difference detected*.
* 12 hand-written SQL statements against the migrated scratch database confirmed
  the database-level rules: cross-organization / cross-project / cross-session /
  cross-round inserts rejected by foreign keys, feedback check constraints, feedback
  and consent update triggers, organization-with-projects delete restricted, whole-
  project delete cascades cleanly. (Scratch database dropped afterwards.)
* The application context booted once with the real module graph (Nest dependency
  injection resolved, 124 routes registered) and the OpenAPI document was generated
  (87 paths, 124 operations, all with summaries). This caught and fixed one defect
  (inline response types the Swagger plugin could not resolve). No HTTP request was
  served, no queue job ran, no LLM call was made, no SSE stream was opened.
* A walk of the route table confirmed every `:projectId` route has `@Authorize`
  and every `:organizationId` route has `@AuthorizeOrg`.

**Security and functional correctness have not been proven by automated tests.**
Everything below under "implemented" means the code exists, compiles and lints.

## 2. What was implemented

### Authorization foundation
* Organization layer: `Organization`, `OrganizationMember` (OWNER / DESIGNER /
  MEMBER), `@AuthorizeOrg` + `OrganizationPermissionsGuard`; projects now belong to
  an organization; only org OWNER/DESIGNER create projects; project members must
  belong to the organization (service **and** composite foreign keys).
* Project roles `CLIENT` and `DEVELOPER` added; permission matrix rewritten to the
  proposal baseline (21 permissions); stakeholders no longer read drafts, generation
  inputs or the audit log.
* Tester modelled as a **session-scoped participant identity** (rationale in
  `authorization.md`), with its own token audience and `TesterGuard`.
* JWT issuer/audience enforced for user and tester tokens.

### Domain
* **Design**: variant approval (`POST …/variants/:id/approve`, human only, status
  `APPROVED` not settable by PATCH), variant lineage + `…/history`, refinement via
  generation job `baseVariantId`, `idempotencyKey` on generation jobs, requester
  re-authorization in the worker, designer-reviewed themes injected into the next
  prompt.
* **Testing space**: sessions (DRAFT→ACTIVE→COMPLETED/CANCELLED, window, ≤ 60 days),
  tasks, participants with hashed single-display invitations (A/B `BALANCED` or
  comparative `ALL` assignment), reissue/revoke, tester join, PDPA consent (append-
  only, per session and notice version, text hash), withdrawal, onboarding flag,
  task runs, interaction events, component/page feedback and skip, completion,
  designer views of progress / raw feedback / events / task runs / consents.
* **Feedback analysis**: `ai-tasks` BullMQ queue and worker, schema-validated model
  output, PII-minimised input, themes (`PROPOSED`), designer review (edit, accept/
  reject, merge, split, add, won't-fix with reason, approve/reject analysis,
  select/deselect), SSE progress. Raw feedback / AI output / reviewed values /
  decisions are separate columns or tables.
* **Story drafting**: `POST …/story-generations` (async, SSE) producing `DRAFT`
  stories with `origin=AI` (problem statements included).
* **Rounds and history**: `…/iterate` opens the next round from selected themes
  (`round_feedback_links`), optional variant carry-forward, `…/trace`,
  `…/decisions`; round approval now needs no running session and writes a decision.
* **Stakeholders**: shared (approved) rounds, acknowledge, comments, developer
  handoff (+ per-variant spec), live project status, reports (generate/list/get) for
  CLIENT / DEVELOPER / PROJECT_MANAGER / DESIGNER with audience filtering.

### Infrastructure and security
* BullMQ `ai-tasks` queue (retry/backoff, 10-min timeout, cancel, idempotency,
  boot-time reconciliation, drain, requester re-check), SSE helper shared by the new
  streams.
* Rate limiting (public join, per-participant writes), security headers,
  `TRUST_PROXY`, `SWAGGER_ENABLED`, audit entries that omit bodies containing emails,
  organization events logged, `Cache-Control: no-store`.

## 3. Modules

**New:** `organizations`, `testing`, `ai`, `iteration`, `stakeholders`;
`common/rate-limit`, `common/decisions.ts`, `common/pii.ts`,
`common/security-headers.middleware.ts`; `access/org-permissions.ts`,
`access/organization-permissions.guard.ts`, `access/authorize-org.decorator.ts`;
`auth/auth.constants.ts`; `projects/organization-projects.controller.ts`.

**Modified:** `access` (permissions, types, service, decorator, module), `auth`
(module, JWT strategy), `projects` (service, controllers, DTOs; `POST /projects`
removed), `rounds` (variants, jobs, rounds service/DTOs, `round-state`),
`generation` (processor, prompts, `LlmClient`), `design` (story DTO, exported
helper), `audit` (interceptor, decorators), `config/env.validation`, `main.ts`,
`app.module.ts`, `swagger.ts`, README, `.env.example`.

## 4. Database changes and migration

Migration `20261111090000_organizations_testing_analysis` (additive; the two
earlier migrations are untouched).

* New enums and tables: `organizations`, `organization_members`, `story_generations`,
  `test_sessions`, `session_variants`, `session_participants`, `consent_records`,
  `test_tasks`, `task_runs`, `interaction_events`, `feedback`, `feedback_analyses`,
  `feedback_themes`, `theme_feedback`, `design_decisions`, `round_feedback_links`,
  `round_comments`, `round_acknowledgements`, `reports`.
* Altered: `projects.organizationId` (required), `project_members.organizationId`
  (required, composite FKs), `ui_variants` (`parentVariantId`, `approvedById`,
  `approvedAt`, status `APPROVED`), `generation_jobs` (`baseVariantId`,
  `idempotencyKey`), `user_stories` (`origin`, `generationId`), `ProjectRole`
  (`CLIENT`, `DEVELOPER`).
* **Backfill**: every existing project gets an organization (owner = creator, else
  earliest designer; one organization per owner; an ownerless project gets its own
  organization), members are added to it (project DESIGNER → org DESIGNER, others →
  MEMBER) before the columns become `NOT NULL`. Nothing is deleted.
* Hand-written in the same file (Prisma cannot express them): feedback check
  constraints, session window check, immutability triggers for `feedback` and
  `consent_records`.
* Deploy with `pnpm db:deploy`. Because of the composite foreign keys and the
  trigger-protected tables, do not edit these tables by hand in production.

## 5. Behaviour changes to be aware of

* `POST /api/projects` is gone; use `POST /api/organizations/:id/projects`. Existing
  users get an organization from the backfill; new users must create one.
* Project managers / product owners lost `design:read` and `audit:read`.
* `POST …/members` now requires the invitee to be in the project's organization and
  answers one generic 404 otherwise.
* Access tokens issued before deployment (15 min) are rejected (new audience).
* `status: APPROVED` is not accepted by variant create/update.
* Variants that belong to a test session cannot be edited, archived or deleted;
  rounds with test sessions cannot be deleted; a round with a running session cannot
  be approved.

## 6. Remaining gaps and known limitations

Not implemented (each is a deliberate scope decision or a gap, not an oversight):

1. **Email/password registration, email verification, password recovery** — skipped
   by product decision (no mail transport); Google remains the only identity
   provider. Consequently also no account enumeration surface to protect and no
   brute-force protection beyond the new tester-endpoint limits.
2. **Account status** (disable/suspend) and account/user deletion (deleting a user
   row that still has organization memberships would be blocked by design).
3. **Email delivery** — tester invitations are links the designer shares; org members
   are added by the email of a user who already signed in.
4. **PDPA erasure workflow** — withdrawal ends access and excludes data from later AI
   analysis, but there is no endpoint/job that deletes a participant's data or
   enforces a retention period; interaction-event `metadata` is free-form (≤ 2 KB) and
   could contain personal data if a client sends it.
5. **Persona Artifact synthesis** and the **frontier-model baseline comparison**
   from the proposal's model table are not implemented. The generation model default
   is still `qwen3.8-27b` (`LLM_MODEL`); set it to `muse-glimmer-30b` per environment.
6. **Queue monitoring** is logs + row status + `outputMetadata`; no Bull Board or
   metrics endpoint.
7. **Rate limiting is per process**, not distributed. SSE authorization is evaluated
   at connect time only. There are no SSE streams for live session activity (designers
   poll `progress`).
8. **Organization-level audit** is logged but not persisted (the audit table is
   per project).
9. Reports are synchronous snapshots without export (PDF/CSV); onboarding is a flag
   with no step content; role-specific decision weights (planned in the existing
   code) are not implemented.
10. **Existing tests are stale and were not touched** (task restriction). Known to
    need updates before CI can run them: `permissions.spec.ts` (new matrix),
    `permissions.guard.spec.ts`, `members.service.spec.ts` (new `add` signature —
    a type error today), `audit.interceptor.spec.ts` (new `organizationId` in
    `AccessContext` — a type error today), `test/rbac.e2e-spec.ts` and the other e2e
    specs (Prisma mocks lack the new delegates; `FakeGenerationModule` lacks
    `analysisModel`). The repository's CI workflow runs lint and build only.
11. Design/analysis answers depend on the LLM gateway; schema validation and retries
    reduce but cannot remove bad answers. None of the AI paths has been exercised
    against the real gateway in this change set.

Interpretations of ambiguous proposal items are listed in `authorization.md` §3
("End user story session", `PRODUCT_OWNER`, stakeholder tightening, "shared" =
approved).

## 7. Change set 2 — design intent, user personas, HTML generation (M1–M3, designer)

Requested: HTML design generation sent to the frontend; automatic persona
artifacts from design prompts; Organization → Project → User Persona;
organization roles ADMIN / MEMBER, separate project roles; project creation
data (name, client or product, description, platforms) before a separate design
intent step (personas, design system & standards, brand & CI with three
colors, tone of voice); everything in the LLM prompt template; backend only;
joining organizations/projects deferred. Full description:
[`design-generation-and-personas.md`](./design-generation-and-personas.md).

### Implemented
* **Organization roles** ADMIN / MEMBER (`org-permissions.ts`); only ADMIN
  creates projects and manages members; the last ADMIN is protected.
* **Projects** are created with `name`, `clientOrProduct`, `description`,
  `platforms[]`; `PATCH /projects/:id/design` removed; `hasDesignIntent` on the DTO.
* **Design intent** (`GET/PUT /projects/:id/design-intent`) and **user
  personas** (`/projects/:id/personas` CRUD) in the design module.
* **Generation**: `prompt` required; `personaIds`, `synthesizePersona`;
  `PersonaSynthesizer` saves an AI persona per job before designing;
  `DesignGenerator` produces `{ title, rationale, html }`; new prompt template;
  repair loop on check errors; variants store `html`.
* **HTML safety and checks** (`design/html/`): `sanitize-html` allowlist +
  CSS cleaning; `htmlparser2`-based checks (structure, WCAG 2.1 AA markup,
  platforms, brand colors, what was removed).
* Dependents moved to HTML / the new intent: variants (create/update with
  `html`), tester prototype, shared rounds, developer handoff (`elementUsage`,
  brand colors, platforms), reports, iteration carry-forward, story drafting.
* **Removed**: the Figma-like JSON design pipeline (`design/document/*`, the
  UI-kit catalogue and `GET /ui-kits/:uiLibrary`) and the two unit spec files
  that tested only that removed code (`check-design.spec.ts`,
  `design-generator.service.spec.ts`).
* **Dependencies added**: `sanitize-html`, `htmlparser2` (`@types/sanitize-html`
  dev) — needed to sanitize untrusted HTML with a real parser.
* **Migration** `20261112090000_html_design_intent_personas` (data-preserving,
  see the design doc §6).

### Validation status
| Check | Result |
|---|---|
| `pnpm lint` (apps/backend) | exit 0, no errors or warnings |
| `tsc --noEmit` (source) | 0 errors (stale spec files still fail, see §6 item 10) |
| `pnpm build` | exit 0 |
| Migration on a scratch DB seeded with pre-migration rows | applied; roles mapped, brief and persona carried over, invalid color dropped (kept in `legacyBrief`), JSON variant kept |
| Boot + OpenAPI generation (built app) | 129 operations, all with summaries; no `:projectId`/`:organizationId` route without its guard |
| Sanitizer/checker probe (one hand-written sample document) | scripts, handlers, iframe, `javascript:` URL, foreign stylesheet and CSS `@import` removed; alt/label/button-name errors and brand-color warning reported; SVG gradients kept |

Not done: no unit, integration or e2e tests were written or run; no request was
served; **no LLM call was made** (persona and HTML prompts, repair rates and
output quality are unverified against the gateway).

**Note on the dev database:** while testing the migration, a command without
the scratch `DATABASE_URL` applied `20261112090000_html_design_intent_personas`
to the local dev database `senior` (from `.env`). That database had no projects,
organization members or variants, so no data changed; it is simply already
migrated. The migration file was not modified afterwards.

### Behaviour changes
* Organization OWNER → ADMIN, DESIGNER → MEMBER; MEMBERs can no longer create projects.
* `POST /organizations/:id/projects` body changed (no design fields);
  `PATCH /projects/:id/design` and `GET /ui-kits/:uiLibrary` are gone.
* Generation needs a design intent and a `prompt`; variants carry `html`
  (`design` only for legacy rows); hand-made variants send `html`.
* Jobs queued before this change fail with "created before HTML generation".

### Remaining gaps (in addition to §6)
* Contrast, focus order and zoom are not checked (static markup only).
* Persona artifacts are not de-duplicated; legacy JSON variants cannot be refined.
* Joining organizations/projects (invitations) is not implemented.
* `test/generation.e2e-spec.ts` and the other e2e specs still describe the JSON
  pipeline and old project body; they were not updated.
