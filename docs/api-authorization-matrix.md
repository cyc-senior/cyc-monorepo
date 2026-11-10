# API authorization matrix

Generated from the live route table (`DiscoveryService` over the built application) plus the permission maps in `apps/backend/src/modules/access/`. Every route not listed as Public requires a valid token; every route with `:projectId` / `:organizationId` goes through a permission guard that resolves the caller's membership from the database. When this document was produced, no route with `:projectId` lacked `@Authorize` and no route with `:organizationId` lacked `@AuthorizeOrg` (checked by walking the route table, not by a test run).

Non-members always get **404**; members lacking the permission get **403**. Project roles: `DESIGNER`, `PROJECT_MANAGER`, `PRODUCT_OWNER`, `DEVELOPER`, `CLIENT`. Organization roles: `ADMIN`, `MEMBER`.

Routes: **129**.


## Audit log

*Resource-level rules:* Project-scoped; designers only.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/audit-logs` | User JWT | `audit:read` | DESIGNER |

## Authentication

*Resource-level rules:* Google OAuth2 with a CSRF `state` cookie; refresh tokens are single-use, rotate, and reuse revokes the whole family. `logout` only revokes a token that belongs to the caller.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/auth/google` | Public | — | anyone |
| GET | `/api/auth/google/callback` | Public | — | anyone |
| POST | `/api/auth/refresh` | Public | — | anyone |
| POST | `/api/auth/logout` | User JWT | — | any signed-in user |

## Current user

*Resource-level rules:* The user id always comes from the access token, never from the URL or body. Only `name`/`image` are editable.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/users/me` | User JWT | — | any signed-in user |
| PATCH | `/api/users/me` | User JWT | — | any signed-in user |

## Health

*Resource-level rules:* Liveness only.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/health` | Public | — | anyone |

## Organizations

*Resource-level rules:* Organization id is resolved through `organization_members` for the caller: non-members get **404**, members without the permission **403**. Creating an organization makes the caller its ADMIN. A member can only remove themselves unless ADMIN. The last ADMIN cannot be demoted/removed; removing someone also removes their project memberships (409 if they are a project's only designer). An organization with projects cannot be deleted. Joining by invitation is not implemented.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/organizations` | User JWT | — | any signed-in user |
| POST | `/api/organizations` | User JWT | — | any signed-in user |
| GET | `/api/organizations/:organizationId` | User JWT | `org:read` | ADMIN, MEMBER (org) |
| PATCH | `/api/organizations/:organizationId` | User JWT | `org:update` | ADMIN (org) |
| DELETE | `/api/organizations/:organizationId` | User JWT | `org:delete` | ADMIN (org) |
| GET | `/api/organizations/:organizationId/members` | User JWT | `org-member:read` | ADMIN, MEMBER (org) |
| POST | `/api/organizations/:organizationId/members` | User JWT | `org-member:manage` | ADMIN (org) |
| PATCH | `/api/organizations/:organizationId/members/:memberId` | User JWT | `org-member:manage` | ADMIN (org) |
| DELETE | `/api/organizations/:organizationId/members/:memberId` | User JWT | `org:read` | ADMIN, MEMBER (org) |

## Projects

*Resource-level rules:* Project id is resolved through `project_members` for the caller (404 for non-members). The project's organization is fixed at creation; the design intent has its own endpoint.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects` | User JWT | — | any signed-in user |
| GET | `/api/projects/:projectId` | User JWT | `project:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| PATCH | `/api/projects/:projectId` | User JWT | `project:update` | DESIGNER |
| DELETE | `/api/projects/:projectId` | User JWT | `project:delete` | DESIGNER |

## Projects (in an organization)

*Resource-level rules:* Creating needs the *organization* permission `org-project:create` (ADMIN). Body: name, client or product, description, platforms. `organizationId` comes from the URL and was verified against the caller's membership; it is never read from the body. Listing returns only projects the caller is a member of.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/organizations/:organizationId/projects` | User JWT | `org:read` | ADMIN, MEMBER (org) |
| POST | `/api/organizations/:organizationId/projects` | User JWT | `org-project:create` | ADMIN (org) |

## Project members

*Resource-level rules:* Project roles (DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, DEVELOPER, CLIENT) are separate from organization roles. The invitee must already be a member of the project's organization (service **and** composite foreign keys); unknown email and "not in organization" give the same 404. The last DESIGNER cannot be demoted/removed.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/members` | User JWT | `member:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| POST | `/api/projects/:projectId/members` | User JWT | `member:manage` | DESIGNER |
| PATCH | `/api/projects/:projectId/members/:memberId` | User JWT | `member:manage` | DESIGNER |
| DELETE | `/api/projects/:projectId/members/:memberId` | User JWT | `member:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |

## Design intent

*Resource-level rules:* One per project (`UNIQUE(projectId)`), looked up by the route's project. Colors must be `#RRGGBB` (DTO and DB check). Every PUT bumps `version`; queued jobs keep their own snapshot.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/design-intent` | User JWT | `design:read` | DESIGNER |
| PUT | `/api/projects/:projectId/design-intent` | User JWT | `design:write` | DESIGNER |

## User personas

*Resource-level rules:* Looked up with `{ id, projectId }`. AI personas (persona artifacts saved by generation jobs) are editable like manual ones; `origin` and `generationJobId` cannot be set by clients.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/personas` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/personas` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/personas/:personaId` | User JWT | `design:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/personas/:personaId` | User JWT | `design:write` | DESIGNER |
| DELETE | `/api/projects/:projectId/personas/:personaId` | User JWT | `design:write` | DESIGNER |

## User stories

*Resource-level rules:* Item lookups `where { id, projectId }`; AI drafts arrive as DRAFT.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/user-stories` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/user-stories` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/user-stories/:id` | User JWT | `design:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/user-stories/:id` | User JWT | `design:write` | DESIGNER |
| DELETE | `/api/projects/:projectId/user-stories/:id` | User JWT | `design:write` | DESIGNER |

## Design rounds

*Resource-level rules:* Round looked up with `{ id, projectId }`. Approving needs no running test session, is conditional (no double approval), freezes the round and writes a decision.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/rounds` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/rounds` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/rounds/:roundId` | User JWT | `design:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/rounds/:roundId` | User JWT | `design:write` | DESIGNER |
| POST | `/api/projects/:projectId/rounds/:roundId/approve` | User JWT | `design:approve` | DESIGNER |
| DELETE | `/api/projects/:projectId/rounds/:roundId` | User JWT | `design:write` | DESIGNER |

## Design generation jobs

*Resource-level rules:* Job looked up through round → project. Needs a defined design intent (409). `personaIds`, `storyIds`, `baseVariantId` must belong to the project. Payload is only the row id; the worker re-checks the requester still holds `design:write`, saves the persona artifact to the job's own project, and saves variants as READY. `idempotencyKey` returns the existing job. SSE `events` uses the same lookup and streams only that job.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/rounds/:roundId/generation-jobs` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/rounds/:roundId/generation-jobs` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/generation-jobs/:jobId` | User JWT | `design:read` | DESIGNER |
| GET | `/api/projects/:projectId/generation-jobs/:jobId/events` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/generation-jobs/:jobId/cancel` | User JWT | `design:write` | DESIGNER |
| DELETE | `/api/projects/:projectId/generation-jobs/:jobId` | User JWT | `design:write` | DESIGNER |

## UI variants (HTML)

*Resource-level rules:* Variant looked up through its round's project. `html` is sanitized and checked (422 with `issues`). `status` cannot be set to APPROVED by create/update (only `approve`, needing `design:approve`). A variant that is part of a test session cannot be edited, archived or deleted.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/rounds/:roundId/variants` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/rounds/:roundId/variants` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/variants/:variantId` | User JWT | `design:read` | DESIGNER |
| GET | `/api/projects/:projectId/variants/:variantId/history` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/variants/:variantId/approve` | User JWT | `design:approve` | DESIGNER |
| PATCH | `/api/projects/:projectId/variants/:variantId` | User JWT | `design:write` | DESIGNER |
| DELETE | `/api/projects/:projectId/variants/:variantId` | User JWT | `design:write` | DESIGNER |

## Iteration and decisions

*Resource-level rules:* Starting an iteration uses only themes selected from an APPROVED analysis of that round, not yet addressed; carried-forward variants must belong to the source round.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| POST | `/api/projects/:projectId/rounds/:roundId/iterate` | User JWT | `iteration:manage` | DESIGNER |
| GET | `/api/projects/:projectId/rounds/:roundId/trace` | User JWT | `design:read` | DESIGNER |
| GET | `/api/projects/:projectId/decisions` | User JWT | `design:read` | DESIGNER |

## Test sessions

*Resource-level rules:* Session looked up with `{ id, projectId }`. Only APPROVED variants of the (writable) round can be tested.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/test-sessions` | User JWT | `testing:read` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions` | User JWT | `testing:manage` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId` | User JWT | `testing:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/test-sessions/:sessionId` | User JWT | `testing:manage` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/activate` | User JWT | `testing:manage` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/end` | User JWT | `testing:manage` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/cancel` | User JWT | `testing:manage` | DESIGNER |
| DELETE | `/api/projects/:projectId/test-sessions/:sessionId` | User JWT | `testing:manage` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId/progress` | User JWT | `testing:read` | DESIGNER |

## Session tasks and participants

*Resource-level rules:* Session looked up with `{ id, projectId }`. Invitation tokens are shown once (hash stored).

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/test-sessions/:sessionId/tasks` | User JWT | `testing:read` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/tasks` | User JWT | `testing:manage` | DESIGNER |
| PATCH | `/api/projects/:projectId/test-sessions/:sessionId/tasks/:taskId` | User JWT | `testing:manage` | DESIGNER |
| DELETE | `/api/projects/:projectId/test-sessions/:sessionId/tasks/:taskId` | User JWT | `testing:manage` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId/participants` | User JWT | `testing:read` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/participants` | User JWT | `testing:manage` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/participants/:participantId/invitation` | User JWT | `testing:manage` | DESIGNER |
| POST | `/api/projects/:projectId/test-sessions/:sessionId/participants/:participantId/revoke` | User JWT | `testing:manage` | DESIGNER |
| DELETE | `/api/projects/:projectId/test-sessions/:sessionId/participants/:participantId` | User JWT | `testing:manage` | DESIGNER |

## Session results (raw)

*Resource-level rules:* Read-only, `{ id, projectId }` scoped. Feedback shows the participant id, never the email.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/test-sessions/:sessionId/feedback` | User JWT | `feedback:read` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId/events` | User JWT | `feedback:read` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId/task-runs` | User JWT | `testing:read` | DESIGNER |
| GET | `/api/projects/:projectId/test-sessions/:sessionId/consents` | User JWT | `testing:read` | DESIGNER |

## Tester entry

*Resource-level rules:* Public but rate-limited (20/min/IP). Unknown invitation → 401.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| POST | `/api/testing/join` | Public · rate limit 20/60s | — | anyone |

## Tester (session participant)

*Resource-level rules:* Requires a **tester token** (`aud: cyc-testing`); every call re-reads participant and session. Prototypes are returned as sanitized HTML only after consent.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/testing/session` | Tester token | — | participant of the session |
| GET | `/api/testing/consent` | Tester token | — | participant of the session |
| POST | `/api/testing/consent` | Tester token · rate limit 20/60s | — | participant of the session |
| POST | `/api/testing/consent/withdraw` | Tester token · rate limit 5/60s | — | participant of the session |
| POST | `/api/testing/onboarding/complete` | Tester token | — | participant of the session |
| GET | `/api/testing/variants/:variantId` | Tester token | — | participant of the session |
| POST | `/api/testing/tasks/:taskId/start` | Tester token | — | participant of the session |
| POST | `/api/testing/task-runs/:runId/finish` | Tester token | — | participant of the session |
| POST | `/api/testing/events` | Tester token · rate limit 120/60s | — | participant of the session |
| POST | `/api/testing/feedback` | Tester token · rate limit 60/60s | — | participant of the session |
| GET | `/api/testing/feedback` | Tester token | — | participant of the session |
| POST | `/api/testing/complete` | Tester token | — | participant of the session |

## Feedback analysis

*Resource-level rules:* Analysis looked up with `{ id, projectId }`; worker re-reads feedback from the same project.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/analyses` | User JWT | `analysis:read` | DESIGNER |
| POST | `/api/projects/:projectId/analyses` | User JWT | `analysis:write` | DESIGNER |
| GET | `/api/projects/:projectId/analyses/:analysisId` | User JWT | `analysis:read` | DESIGNER |
| GET | `/api/projects/:projectId/analyses/:analysisId/events` | User JWT | `analysis:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/analyses/:analysisId` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/approve` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/reject` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/cancel` | User JWT | `analysis:write` | DESIGNER |

## Analysis themes (designer review)

*Resource-level rules:* Theme looked up with `{ id, analysisId }` under the project's analysis; edits serialized per analysis.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/analyses/:analysisId/themes` | User JWT | `analysis:read` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes/merge` | User JWT | `analysis:write` | DESIGNER |
| GET | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId` | User JWT | `analysis:read` | DESIGNER |
| PATCH | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId/split` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId/wont-fix` | User JWT | `analysis:write` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId/select` | User JWT | `iteration:manage` | DESIGNER |
| POST | `/api/projects/:projectId/analyses/:analysisId/themes/:themeId/deselect` | User JWT | `iteration:manage` | DESIGNER |

## AI story drafting

*Resource-level rules:* Row-id payload, requester re-checked, results saved as DRAFT stories; the prompt uses the project, design intent and personas.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/story-generations` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/story-generations` | User JWT | `design:write` | DESIGNER |
| GET | `/api/projects/:projectId/story-generations/:generationId` | User JWT | `design:read` | DESIGNER |
| GET | `/api/projects/:projectId/story-generations/:generationId/events` | User JWT | `design:read` | DESIGNER |
| POST | `/api/projects/:projectId/story-generations/:generationId/cancel` | User JWT | `design:write` | DESIGNER |

## Shared rounds, handoff, status

*Resource-level rules:* Only APPROVED rounds (and APPROVED variants) are reachable; any other round id is 404.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/shared-rounds` | User JWT | `shared-round:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| GET | `/api/projects/:projectId/shared-rounds/:roundId` | User JWT | `shared-round:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| POST | `/api/projects/:projectId/shared-rounds/:roundId/acknowledge` | User JWT | `shared-round:respond` | CLIENT |
| GET | `/api/projects/:projectId/shared-rounds/:roundId/comments` | User JWT | `shared-round:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| POST | `/api/projects/:projectId/shared-rounds/:roundId/comments` | User JWT | `shared-round:respond` | CLIENT |
| GET | `/api/projects/:projectId/handoff` | User JWT | `handoff:read` | DEVELOPER |
| GET | `/api/projects/:projectId/handoff/variants/:variantId` | User JWT | `handoff:read` | DEVELOPER |
| GET | `/api/projects/:projectId/status` | User JWT | `status:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER |

## Reports

*Resource-level rules:* A reader only lists/reads reports written for their role; another audience's report id is 404.

| Method | Path | Access | Scope permission | Roles |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/reports` | User JWT | `report:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
| POST | `/api/projects/:projectId/reports` | User JWT | `report:generate` | DESIGNER |
| GET | `/api/projects/:projectId/reports/:reportId` | User JWT | `report:read` | DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER, CLIENT, DEVELOPER |
