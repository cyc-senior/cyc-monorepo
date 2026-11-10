# CYC backend audit

Scope: `apps/backend` (NestJS 11, Prisma 7 / PostgreSQL, BullMQ / Redis).
Snapshot: branch `feat/backend-domain-rbac` at commit `03b0ab0`, **before** the
changes described in [`backend-implementation-report.md`](./backend-implementation-report.md).
Method: full read of the source tree, schema, migrations, scripts, env
validation, and README. No tests were run (task restriction); findings below come
from code inspection only.

## 1. Existing architecture (as found)

Modular monolith, one NestJS app, global prefix `/api`.

| Concern | Implementation |
|---|---|
| API | REST, Swagger generated from code (`@nestjs/swagger` CLI plugin), paginated envelope `{data,total,limit,offset}` |
| Persistence | Prisma 7 + `@prisma/adapter-pg`, one squashed migration `20261110090000_projects_design_generation` on top of `20261031133548_init_auth` |
| Auth | Google OAuth2 (state cookie CSRF check) → HS256 access JWT (15 min) + opaque rotating refresh token (hash stored, token families, reuse detection, advisory lock) |
| Authz | Global `JwtAuthGuard`; `@Authorize(Permission)` → `PermissionsGuard` loads the caller's `ProjectMember.role` for `:projectId`, maps role→permission (`access/permissions.ts`); non-member = 404, member without permission = 403; item lookups scoped through the project (`common/scopes.ts`) |
| Background jobs | BullMQ queue `design-generation`; DB row is source of truth, job id = row id (idempotent enqueue), retries/backoff, cancel, orphan reconciliation on boot, graceful drain |
| AI | `LlmClient` (OpenAI-compatible, CPE AI Gateway, JSON-schema output, streaming, abort); `DesignGenerator` generates → checks (UI-kit guardrail + WCAG 2.0 AA) → repair loop |
| Real time | SSE for one generation job (`Observable` over BullMQ `QueueEvents`), heartbeat, bearer auth + project permission |
| Cache | Redis response cache of `@Authorize`d GETs, per-project version token invalidation, fail-open |
| Audit/logging | `AuditInterceptor` (writes `AuditLog` per audited mutation), structured request/domain logs with request id |
| Validation | Global `ValidationPipe({whitelist, forbidNonWhitelisted, transform})` — blocks mass assignment |

### Module inventory

`access` (permissions, guard) · `audit` · `auth` · `users` · `projects` (+members) ·
`design` (user stories, UI-kit catalogue, design document + checker) ·
`rounds` (rounds, variants, generation jobs, SSE) · `generation` (queue, worker,
LLM, prompts) · `health` · `cache` · `prisma` · `config` · `common`.

### Database model (as found)

`User`, `Account`, `RefreshToken` · `Project` (design brief on the project),
`ProjectMember(role: DESIGNER | PROJECT_MANAGER | PRODUCT_OWNER)` · `UserStory` ·
`DesignRound` (sequential per project, parent link, approve/freeze) ·
`GenerationJob` · `UIVariant` · `AuditLog`.
No Organization, no testing/feedback/analysis/decision/report tables.

## 2. Findings

Severity: **C**ritical · **H**igh · **M**edium · **L**ow · **I**nformational.

### Security

| # | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | H | Access JWTs carry no `iss`/`aud`; the strategy accepts any HS256 token signed with the secret. Any second token type (tester tokens) signed with the same secret would be accepted as a user token. | Tokens now carry issuer + per-purpose audience (`cyc-api`, `cyc-testing`); both verifiers enforce them. |
| S2 | H | Stakeholder roles over-privileged: `PROJECT_MANAGER`/`PRODUCT_OWNER` hold every `*:read`, including draft designs, generation inputs (prompts/briefs) and the audit log (request bodies). The proposal gives them approved rounds, project status and reports only. | Permission set re-derived from the proposal matrix; stakeholders read approved/shared data only. |
| S3 | M | `POST /projects/:id/members` answers “No registered user has that email” — any designer can enumerate registered emails. | Invitee must already belong to the project's organization; one generic error for “unknown” and “not in organization”. |
| S4 | M | No tenant boundary above the project: a designer can attach any registered user to any project, and any user can create projects. Proposal requires organizations and “only Designers create projects”. | Organization + OrganizationMember added; project creation requires an organization role that may create projects; project membership requires organization membership (enforced in the service, in the same transaction). |
| S5 | M | Audit log stores summarised request bodies and is readable by every member. | `audit:read` restricted to designers; sensitive-key redaction kept. |
| S6 | M | No rate limiting on any endpoint; relevant to the new public tester endpoints (invite exchange). | Per-IP in-process limiter on public endpoints (documented limitation: per instance). |
| S7 | L | No security headers, `X-Powered-By` exposed. | Headers middleware (nosniff, frame-deny, referrer, HSTS in production, no `X-Powered-By`). |
| S8 | L | Swagger UI + `api-json` always exposed (route/DTO disclosure). | `SWAGGER_ENABLED` (default on outside production). |
| S9 | M | A queued/running generation job keeps running after its requester lost access (removed from the project / demoted). | Worker re-checks the requester's permission before running. |
| S10 | M | Duplicate submissions (double click / client retry) create duplicate generation jobs and duplicate variants. | Optional `idempotencyKey` (unique per round) returns the existing job. |
| S11 | I | SSE authorizes once at connect; a revoked member keeps an open stream until the job ends. Streams are job-scoped and short-lived. | Documented. |
| S12 | I | Queue payload is only the row id; project/round/requester are read from the database by the worker — no client-supplied ownership reaches the worker. | Kept as the pattern for the new analysis queue. |
| S13 | I | `ValidationPipe` whitelist + forbid-non-whitelisted, UUID param pipes, project-scoped lookups (`inProject`) — no IDOR found in existing routes. | Pattern extended to all new routes. |

### Authentication

| # | Sev | Finding | Resolution |
|---|---|---|---|
| A1 | M | Only Google sign-in exists. Proposal workflow expects email/password registration, email verification and password recovery. | **Out of scope by product decision** (no mail transport; Google remains the sole identity provider). Listed as a remaining gap. |
| A2 | L | No account status (disabled/suspended) check at login/refresh. No admin surface to set one either. | Documented gap. |
| A3 | I | Refresh-token rotation, reuse detection, family locking, OAuth state CSRF, `NODE_ENV`/secret validation are solid. | Kept. |

### Functional gaps vs the proposal

| # | Sev | Finding |
|---|---|---|
| F1 | H | No testing space: sessions, invitations, tester identity, PDPA consent, tasks, interaction events, contextual feedback. |
| F2 | H | No feedback analysis (categorise / summarise / group), no designer review of AI output, no “won't fix”, no selection for next iteration. |
| F3 | H | No decision / iteration history linking feedback → next round → variants. |
| F4 | H | No stakeholder surfaces (shared rounds, acknowledge/comment, developer handoff, project status, reports). |
| F5 | M | Roles: `CLIENT` and `DEVELOPER` do not exist; `PRODUCT_OWNER` is not in the proposal. |
| F6 | M | Variant approval does not exist (only whole-round approval); nothing prevents testing unapproved AI output. |
| F7 | M | No conversational refinement of a variant; no variant lineage. |
| F8 | M | Story / problem-statement generation by AI is missing (stories are manual CRUD). |
| F9 | L | Generated variants are never linked to the feedback that motivated the round. |

### Technical debt

* Existing unit/e2e tests mock Prisma at the method level and encode the previous
  permission matrix; they must be revisited when tests are in scope again.
* `GenerationEvents` / `GenerationQueue` are bound to one queue name; a second
  queue needs its own copies (small, accepted duplication).
* `AuditLog` is project-scoped only; organization-level changes are logged but not persisted.
* `rounds.service.ts` doc comment mentions “sessions and results” that did not exist.
* No data-retention job (PDPA) yet; no account deletion flow.

## 3. Proposal compliance matrix (before → after)

“After” reflects the implementation in this change set; see the implementation
report for validation status (lint only).

| Proposal requirement | Before | After |
|---|---|---|
| Organization & membership | ✗ | ✓ |
| Project, status, membership, reusable design requirements | ✓ (no org) | ✓ |
| Roles Designer / Client / Developer / PM | partial | ✓ (+ legacy PO) |
| Tester as separate concept | ✗ | ✓ session-scoped participant identity |
| Design intent / prompts / 2-alternative generation | ✓ | ✓ |
| UI refinement by instruction | ✗ | ✓ (job with base variant) |
| Variant approval by a human | ✗ | ✓ |
| User-story & problem-statement generation (AI) | ✗ | ✓ (async, drafts for review) |
| Test session, invitation, expiry, status | ✗ | ✓ |
| PDPA consent with history & version | ✗ | ✓ |
| Tasks, completion tracking, interaction events | ✗ | ✓ |
| Component / page feedback, skip | ✗ | ✓ |
| AI analysis (categorise, summarise, group, key issues) | ✗ | ✓ BullMQ + SSE |
| Designer review: edit, split, merge, won't-fix, approve/reject | ✗ | ✓ |
| Raw vs AI vs reviewed vs decision separation | ✗ | ✓ |
| Rounds, decision history, feedback→round traceability | partial | ✓ |
| Stakeholder views (client / developer / PM) | ✗ | ✓ |
| Reports (client / developer / PM / designer) | ✗ | ✓ |
| SSE for AI progress with authz | ✓ (generation) | ✓ (+ analysis, story generation) |
| Email/password auth, verification, recovery | ✗ | ✗ (decision: skipped) |
| Frontend | n/a | n/a |

## 4. Prioritised plan (executed in this order)

1. Authorization foundation: roles, permission matrix, organization guard, token audience.
2. Organization + project isolation; migration with backfill.
3. Variant approval, refinement, idempotency.
4. Testing space (sessions, invitations, consent, tasks, events, feedback).
5. AI feedback analysis + designer review + decisions/iteration.
6. Stakeholder views and reports.
7. Hardening (headers, rate limit, swagger flag, worker re-authorization), docs, lint.

## 5. Status after implementation

“Resolved” means the code change exists, compiles and lints; it has **not** been
verified by automated tests (see `backend-implementation-report.md` §1).

| Finding | Status |
|---|---|
| S1 JWT issuer/audience | Resolved (user and tester tokens) |
| S2 Stakeholder over-privilege | Resolved (matrix rewritten; PM/PO lose `design:read`, `audit:read`) |
| S3 Email enumeration via invitations | Resolved for project invitations. Organization owners can still learn whether an email has an account (needed to add them); owner-only |
| S4 No tenant boundary | Resolved (organizations + composite foreign keys) |
| S5 Audit log exposure | Resolved (`audit:read` = designers); invitation bodies are not stored |
| S6 Rate limiting | **Partial** — per-process limits on the public tester endpoints; none on user endpoints; not distributed |
| S7 Security headers | Resolved |
| S8 Swagger exposure | Resolved (`SWAGGER_ENABLED`, off by default in production) |
| S9 Jobs outliving access | Resolved for both queues (requester re-checked at run time) |
| S10 Duplicate submissions | Resolved for generation, analysis, story jobs (`idempotencyKey`); analysis/story also guarded by status-conditional saves |
| S11 SSE auth at connect only | Unchanged (documented) |
| A1 Email/password auth | **Not implemented** (product decision) |
| A2 Account status | **Not implemented** |
| F1–F4, F6–F9 | Implemented (see report) |
| F5 Roles | Implemented (`CLIENT`, `DEVELOPER`; `PRODUCT_OWNER` kept as legacy alias) |

Found while implementing:

| # | Sev | Finding | Status |
|---|---|---|---|
| N1 | M | `UpdateUIVariantDto.status` accepted any enum value; once `APPROVED` exists, `design:write` alone could have approved a variant. | Fixed: PATCH accepts DRAFT / READY / ARCHIVED only; `approve` needs `design:approve`. |
| N2 | M | Variants and rounds used by a test session could be edited or deleted, orphaning or rewriting what testers saw. | Fixed: blocked in the service. |
| N3 | L | Inline response types made OpenAPI generation throw at startup for `/api`. | Fixed (explicit DTO classes); found by generating the document, not by lint. |
| N4 | I | Existing unit / e2e specs encode the old permission matrix and signatures. | Open — out of scope for this task; listed in the report. |
