# cyc-senior

Turborepo monorepo with a Next.js frontend and a monolithic NestJS backend.

## Structure

```
apps/
  frontend/   Next.js (App Router) — default Next.js lint setup
  backend/    NestJS monolith — modules live under src/modules/
packages/     Shared packages (reserved)
```

The backend follows a modular monolith layout: every feature is a folder under
`apps/backend/src/modules/` (e.g. `health`) holding its controller, service and
module, all registered in `src/app.module.ts`.

## Commands

| Command                                  | Description                                               |
| ---------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                               | Run both apps in parallel (frontend :3000, backend :4000) |
| `pnpm dev:frontend` / `pnpm dev:backend` | Run a single app                                          |
| `pnpm build`                             | Build all apps via Turborepo                              |
| `pnpm lint`                              | Lint all apps                                             |
| `pnpm test`                              | Run unit tests (`test:ci`) across the workspace           |

## Backend

- API runs on `http://localhost:4000` (`PORT` env overrides it).
- Swagger docs available at `http://localhost:4000/api` (JSON at `/api-json`).
- API docs come from code via the `@nestjs/swagger` CLI plugin (`nest-cli.json`;
  `test/swagger-plugin.js` applies it under Jest). Don't hand-write what it
  infers:
  - **Operations:** the handler's JSDoc first line is the summary; `@remarks`
    is the description; `@throws {409} Why.` documents an error response; the
    success response comes from the return type and `@HttpCode`.
  - **DTOs:** property types, `?`/`| null`, class-validator limits (`@MaxLength`,
    `@Min`, `@ArrayMaxSize`, …), JSDoc text and `@example` become the schema.
    Keep `@ApiProperty` only for what types cannot express (`format: 'uuid'`,
    named `enum`s, free-form JSON via `JsonInput`/`JsonOutput`).
  - **Access:** `@Authorize(permission)` and `@ApiAuthenticated()` add the
    auth scheme and 401/403/404 responses.
- Lint rules mirror `project-veil/veil-microservice` services: ESLint 8 +
  `@typescript-eslint/recommended` + `plugin:prettier/recommended`, with
  `curly`, `eqeqeq`, `max-classes-per-file`, `no-console` (warn) and friends.
  Prettier: single quotes, no semicolons, trailing commas, LF line endings.

## Development setup

Prerequisites: Node 20.19+, 22.12+ or 24+ (Prisma 7's minimum), pnpm 9 (`corepack enable`), Docker.

```bash
pnpm install                                   # also runs `prisma generate`
docker compose up -d                           # Postgres on :5432, Redis on :6379
pnpm env:init                                  # creates apps/backend/.env + a random JWT secret
pnpm db:migrate                                # apply migrations
pnpm db:seed                                   # create the dev admin user
pnpm dev                                       # frontend :3000, backend :4000
```

### Signing in without Google (development only)

You do not need Google credentials to work locally. After seeding, mint a token
for the admin user:

```bash
pnpm dev:token                                 # prints access + refresh token
pnpm dev:token --email a@b.com                 # sign in as another existing user
```

Use the access token as a bearer token:

```bash
TOKEN=$(pnpm --silent dev:token --raw)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/users/me
```

In Swagger (`http://localhost:4000/api`) click **Authorize** and paste the token.
Access tokens last 15 minutes by default (`JWT_ACCESS_TTL_SECONDS`); run the
command again for a new one.

| Script           | Description                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm db:seed`   | Creates (or reuses) the admin user, `admin@senior.local` by default. Idempotent. Override with `DEV_ADMIN_EMAIL`. |
| `pnpm dev:token` | Issues a real access/refresh token pair for an existing user.                                                     |

Both scripts are plain CLI scripts in `apps/backend/scripts/`; there is **no
HTTP endpoint or flag that bypasses authentication**, so nothing changes in a
deployed server. They also refuse to run unless `NODE_ENV=development` is set
explicitly (it is in `.env.example`), so they exit with an error on staging and
production.

### Google sign-in (staging, production, or testing the real flow)

Google OAuth is the only way to sign in on a deployed environment. To use it
locally:

1. Google Cloud Console → APIs & Services → Credentials → create an OAuth client
   (type _Web application_).
2. Add `http://localhost:4000/api/auth/google/callback` as an authorized
   redirect URI (use your environment's URL for staging/production).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` in
   `apps/backend/.env`.
4. Open `http://localhost:4000/api/auth/google` in a browser. The callback
   returns `{ accessToken, refreshToken, tokenType, expiresIn }`.

For deployed environments, set a strong `JWT_ACCESS_SECRET` (`openssl rand
-base64 48`), `NODE_ENV=production`, the real `DATABASE_URL`, and run
`pnpm db:deploy` to apply migrations. Do not run `db:seed`.

### Auth reference

- Every route requires `Authorization: Bearer <accessToken>` unless marked
  `@Public()`. Use `@CurrentUser()` in a controller to read the user.
- `GET /api/auth/google` → Google → `GET /api/auth/google/callback`.
  `POST /api/auth/refresh` rotates the token pair, `POST /api/auth/logout`
  revokes it, `GET /api/users/me` returns the current user.
- Refresh tokens are single-use. If a rotation fails on the server, nothing is
  consumed and the client can retry. If the _response_ is lost in transit
  (e.g. the connection drops), the client no longer has the new token and the
  user must sign in again. This is accepted: allowing the old token to be
  reused would defeat theft detection.
- `NODE_ENV` is required (`development`, `test` or `production`); startup fails
  if it is omitted, so a forgotten variable never silently means "development".
  `JWT_ACCESS_SECRET` has no default and is empty in `.env.example`:
  `pnpm env:init` generates one per checkout, and the app refuses the old
  published example value in every environment. In `production` it also refuses
  the Google placeholders.
- Refresh and logout are serialized per token family with a Postgres advisory
  lock, so a logout (or reuse detection) racing a rotation cannot leave a live
  session behind.

### Domain, roles and permissions

CYC supports the life cycle *design intent & personas → AI-generated HTML alternatives → human
approval → usability testing → AI feedback analysis → designer review →
next iteration → stakeholder reports*. **The AI proposes; designers decide**:
nothing generated or analysed is approved, selected or applied without an
explicit designer action. The full, interactive reference (every endpoint, DTO,
and which roles may call it) is the Swagger UI at `/api`. Design documents:
[`docs/backend-architecture.md`](docs/backend-architecture.md),
[`docs/authorization.md`](docs/authorization.md),
[`docs/api-authorization-matrix.md`](docs/api-authorization-matrix.md),
[`docs/backend-audit.md`](docs/backend-audit.md),
[`docs/backend-implementation-report.md`](docs/backend-implementation-report.md).

**Organizations are the tenant boundary.** Any signed-in user can found one
(`POST /api/organizations`) and becomes its **ADMIN** (organization roles:
ADMIN, MEMBER). ADMINs create projects in it
(`POST /api/organizations/:organizationId/projects`) and add
people by email (people who have signed in once). Organization membership
never grants project access, and only organization members can be added to a
project (also enforced by composite foreign keys).

**Projects are the workspace.** The creator becomes the project's **DESIGNER**
and adds the team: more designers, a **PROJECT_MANAGER**, a **CLIENT**, a
**DEVELOPER**, a **PRODUCT_OWNER** (same permissions as the project manager for
now); `CLIENT` is also available. Project roles are separate from
organization roles. A user
has one role per project (`ProjectMember`). **Testers are not accounts or
project members**: a tester is a participant of one test session, invited by a
designer and let in with a secret invitation (see *Testing space*).

**Creating a project** takes its name, the client or product, a description
and the platforms to design and test for (`DESKTOP`, `MOBILE`, `TABLET`).
**The design intent is the next step** (`PUT
/api/projects/:projectId/design-intent`): design system (`SHADCN` or `MUI`) and
standards (default `WCAG 2.1 AA`), design guidelines, brand & CI (three hex
colors — primary, secondary, accent — and brand notes), tone of voice for the
LLM and the intent statement; every change bumps `version`. **User personas**
(`/api/projects/:projectId/personas`: name, age, short description, behavioral
considerations, frustrations, goals, tasks) belong to the project
(Organization → Project → User Persona). All of it goes into every design
prompt.

A role grants **permissions** (`src/modules/access/permissions.ts` is the single
source of truth, and the table below is generated from it):

| Permission | DESIGNER | PROJECT_MANAGER | PRODUCT_OWNER | CLIENT | DEVELOPER |
|---|:---:|:---:|:---:|:---:|:---:|
| `project:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project:update` | ✓ |  |  |  |  |
| `project:delete` | ✓ |  |  |  |  |
| `member:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `member:manage` | ✓ |  |  |  |  |
| `design:read` | ✓ |  |  |  |  |
| `design:write` | ✓ |  |  |  |  |
| `design:approve` | ✓ |  |  |  |  |
| `testing:read` | ✓ |  |  |  |  |
| `testing:manage` | ✓ |  |  |  |  |
| `feedback:read` | ✓ |  |  |  |  |
| `analysis:read` | ✓ |  |  |  |  |
| `analysis:write` | ✓ |  |  |  |  |
| `iteration:manage` | ✓ |  |  |  |  |
| `shared-round:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `shared-round:respond` |  |  |  | ✓ |  |
| `handoff:read` |  |  |  |  | ✓ |
| `status:read` | ✓ | ✓ | ✓ |  |  |
| `report:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report:generate` | ✓ |  |  |  |  |
| `audit:read` | ✓ |  |  |  |  |

How it is enforced (details in `docs/authorization.md`):

- A controller method declares `@Authorize(Permission.X)` (project) or
  `@AuthorizeOrg(OrgPermission.X)` (organization). The guard reads the id from
  the route, loads the caller's role from the database, and checks the
  permission. Not a member → `404` (ids cannot be probed); member without the
  permission → `403`. A guarded route with no id parameter fails closed.
- `test/rbac.e2e-spec.ts` is meant to fail if any route with `:projectId`
  lacks `@Authorize`, so a forgotten decorator cannot ship (this spec predates
  the current permission matrix and has not been updated yet).
- Item routes are always looked up _through_ the project
  (`common/scopes.ts`, `where { id, projectId }`), and ids inside request
  bodies (`storyIds`, `baseVariantId`, `variantIds`, `feedbackIds`, ...) are
  checked against the same project. Composite foreign keys make cross-project
  and cross-session links impossible to store.
- Membership rules: a project always keeps at least one DESIGNER, an
  organization at least one ADMIN (checked under advisory locks); anyone can
  leave.
- Approving a variant or a round records the approver and freezes it;
  approving a round shares it with stakeholders. Deleting a project cascades its
  data, the audit log included; run test sessions and their results are research
  data and cannot be deleted piecemeal.
- Every successful `POST`/`PUT`/`PATCH`/`DELETE` on a controller marked
  `@AuditEntity('…')` is written to `AuditLog` (actor, action such as
  `DesignRound.approve`, entity, redacted request body) and logged as a domain
  event. Read it with `GET /api/projects/:projectId/audit-logs`.

### Testing space (usability tests)

1. A designer creates a session for **approved** variants of a round
   (`POST /api/projects/:projectId/test-sessions`; one variant = usability test,
   several = comparative), adds tasks, invites testers by email
   (`POST …/participants`, `assignment: ALL | BALANCED` for within/between-group
   designs) and activates it (a deadline ≤ 60 days is required).
2. Each invitation is a secret shown once (only its SHA-256 is stored), returned
   as a link with the token in the URL **fragment**. The tester exchanges it at
   `POST /api/testing/join` (public, rate-limited) for a short-lived tester
   token (audience `cyc-testing`) that works only on `/api/testing/...` and
   expires with the session. Every tester request re-checks that the participant
   and session are still allowed (not revoked/withdrawn, session `ACTIVE` and
   inside its window).
3. **PDPA consent** is per session and per notice version, append-only, with
   the hash of the text shown; nothing (prototype, tasks, events, feedback) works
   without it, and withdrawing ends access.
4. Testers start/finish tasks, send interaction events and **contextual
   feedback** (component or whole page, or skip). Raw feedback is immutable.
   Designers read progress, raw feedback, events and the consent history.

### AI feedback analysis and iteration

`POST …/analyses` queues an analysis (BullMQ `ai-tasks`, SSE progress). The
worker sends the text of the round's feedback (no participant identity, contact
details masked, withdrawn participants excluded) to the text model, validates
the answer and saves proposed **themes**. The designer reviews them: edit,
accept/reject, **merge**, **split**, add, mark **won't fix** (with a reason),
then approves the analysis and **selects** accepted themes.
`POST …/rounds/:roundId/iterate` opens the next round, records which themes it
addresses (the reviewed text becomes part of the next generation prompt) and
optionally carries variants forward; `GET …/rounds/:roundId/trace` and
`GET …/decisions` explain how feedback led to the next design. AI-drafted user
stories (`POST …/story-generations`) arrive as `DRAFT` for review.

### Stakeholders and reports

Approved rounds are shared: `GET …/shared-rounds` (all non-tester roles),
`…/acknowledge` and `…/comments` (client), `GET …/handoff` (developer: design system,
tokens, components used, technical risks, design spec), `GET …/status`
(designer, PM). Designers generate **reports** (`POST …/reports`, types `CLIENT`,
`DEVELOPER`, `PROJECT_MANAGER`, `DESIGNER`); each role reads only the audience
written for it. Stakeholder views never include drafts, participants, raw or AI
feedback, or consent records.

### LLM design generation (persona artifact + high-fidelity HTML)

`POST /api/projects/:projectId/rounds/:roundId/generation-jobs`
(`{ prompt, variantCount? (1–4, default 2), personaIds?, storyIds?,
synthesizePersona? (default true), baseVariantId?, idempotencyKey? }`,
designers) answers `202` with a QUEUED job. The project needs a design intent
first (`409` otherwise). With `baseVariantId` the job *refines* that HTML
variant following `prompt`; repeating a request with the same `idempotencyKey`
returns the original job. The worker then:

1. **Saves a persona artifact**: the text model (`LLM_ANALYSIS_MODEL`)
   synthesizes a user persona from the prompt and the project context; it is
   validated and stored as a project persona (`origin: AI`, linked to the job)
   before any design is made, and leads the persona list of the prompt.
2. **Fills the design prompt template** with the project (name, client or
   product, description, platforms), the design intent (statement, design
   system & standards, brand colors and notes, tone of voice), the personas
   (the artifact plus the picked ones, or every designer-written persona), the
   user stories and the request. Earlier variants are listed so each takes a
   different approach.
3. **Generates high-fidelity HTML** with `LLM_MODEL` (`{ title, rationale,
   html }` under a JSON schema), **sanitizes** it (no scripts, handlers,
   frames, `javascript:` URLs or external resources except Google Fonts) and
   **checks** it: document structure, WCAG 2.1 AA as far as markup shows it
   (3.1.1 language, 2.4.2 title, 1.3.1 headings/landmarks, 1.1.1 alt text,
   3.3.2 labels, 4.1.2 control names, 2.4.4 link purpose), viewport and media
   queries for the target platforms, and use of the brand colors. A failing
   design goes back to the model with its issues, up to
   `DESIGN_REPAIR_ATTEMPTS` (default 2) times, then is dropped with its issues
   in the job's `outputMetadata`.

Passing designs are saved, in one transaction, as READY variants of the round
(never APPROVED: a designer approves with `POST …/variants/:variantId/approve`)
with `html` and `accessibility` (the check report). If none passes, the job is
FAILED (the persona artifact stays).

**Rendering.** A variant's `html` is a self-contained document (one `<style>`,
no scripts). The frontend must render it in `<iframe sandbox srcdoc="…">`
without `allow-scripts` or `allow-same-origin`. Hand-made or edited designs
(`POST …/rounds/:roundId/variants`, `PATCH …/variants/:variantId`, `{ html }`)
go through the same sanitizer and checks and are rejected with `422` and the
list of `issues` when they fail. Variants from before the switch keep their
Figma-like JSON in `design` (read-only). Full contract:
[`docs/design-generation-and-personas.md`](docs/design-generation-and-personas.md).

**Queue (BullMQ).** Jobs run on the `design-generation` queue in Redis
(`REDIS_URL`, namespace `QUEUE_PREFIX`). The database row is the source of
truth; the BullMQ job id is the generation job id. Transient failures (LLM
timeouts, network, 5xx) are retried 3 times with exponential backoff; designs
that cannot pass fail without retrying. Stalled jobs are recovered by BullMQ.
`POST …/generation-jobs/:jobId/cancel` takes a queued job off the queue, or
stops a running one within seconds without saving anything.
`GENERATION_WORKER=false` makes an instance API-only;
`GENERATION_CONCURRENCY` (default 2) sets jobs per worker. Give each
environment sharing a Redis its own `QUEUE_PREFIX`, or their workers take each
other's jobs.

**AI analysis queue.** Feedback analysis and user-story drafting run on a second
queue, `ai-tasks`, with the same guarantees (row id as payload, retries with
backoff, cancel, idempotency keys, boot-time reconciliation, requester
re-authorized at execution time, answers validated before saving) and the same
SSE shape (`GET …/analyses/:id/events`, `GET …/story-generations/:id/events`).
`LLM_ANALYSIS_MODEL` picks the text model (default `LLM_MODEL`).

**Live progress (SSE).** `GET …/generation-jobs/:jobId/events` is a
`text/event-stream` (bearer auth, so use a fetch-based EventSource such as
`@microsoft/fetch-event-source`; the browser's `EventSource` cannot send
headers):

| Event                                | `data`                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `status`                             | `{ jobId, status, error, startedAt, finishedAt, variantIds }`; sent first, then on every change                     |
| `progress`                           | `{ jobId, stage, variant, of, attempt, receivedChars?, errors? }` (`generating`, `checking`, `repairing`, `saving`) |
| `completed` / `failed` / `cancelled` | the final state; the stream then ends                                                                               |
| `heartbeat`                          | every 15 s                                                                                                          |

Events come from BullMQ `QueueEvents` (Redis), so the stream works whichever
instance runs the worker. It subscribes before reading the current state, so
nothing is lost in between, and a reconnecting client simply gets the current
state again. Events carry an `id`, and the first one a `retry` hint.

### Response cache (Redis)

`GET` responses of project routes (everything behind `@Authorize`) are cached in Redis (`REDIS_URL`, required in production; an
in-process store is used when unset elsewhere) for `CACHE_TTL_SECONDS`
(default 60, `0` disables). Responses carry `X-Cache: HIT|MISS`.

- **Access is never cached.** Guards run before the cache, so permissions are
  checked on every request; only the body is reused. Keys include the caller and
  their role, because bodies can differ by role.
- **Writes invalidate.** Keys embed a version token per project. Any
  `POST`/`PATCH`/`DELETE` in a project bumps that version before the response
  is sent, so clients always read their own writes and no `KEYS`/`SCAN` is
  needed; the generation worker bumps it when a job changes. Stale entries
  simply expire. The caller's own project list (`GET /api/projects`) and event
  streams are not cached.
- `@NoCache()` opts a route out (the audit log uses it); `@CacheTTL(ms)` from
  `@nestjs/cache-manager` overrides the lifetime.
- **Fails open.** Cache operations have a 250 ms deadline. While Redis is down,
  requests are served uncached and the store is only probed every 5 s, and the
  client reconnects in the background.

### Logging

Nest's built-in logger, configured by `LOG_LEVEL` (`fatal`…`verbose`, default
`log`) and `LOG_FORMAT` (`json` one object per line, default in production;
`pretty` elsewhere). Every line written while handling a request carries its
**request id** (`requestId` in JSON, a short prefix in pretty mode), taken from
a well-formed incoming `X-Request-Id` or generated, and echoed in the response.

- **Every HTTP request** gets one `http.request` line after the response is
  sent: method, path, status, duration, user, ip. Requests
  rejected by guards or unknown routes are included; event streams log when
  they close. 4xx log as `warn`, 5xx as `error`. Link secrets in paths and `code`/`token`/`state` query values are
  redacted.
- **Domain events:** every audited mutation is logged as `Entity.verb`
  (`DesignRound.approve`, `GenerationJob.create`, …) by the audit interceptor.
  Events without a member behind them are logged where they happen: sign-in,
  refresh, refresh-token reuse, logout; generation `queued`/`started`/
  `succeeded`/`failed`/`cancelled`, every design check (`design.checked`
  with error/warning counts and size; `persona.synthesized` / `persona.saved`) and LLM call (`llm.completion`
  with duration and token usage).
- **Security signals:** access denials with the reason (`not_a_member`,
  `missing_permission`) are `warn`.
- **Infrastructure:** startup/shutdown, database connect/disconnect, Prisma
  warnings/errors, queries slower than `SLOW_QUERY_MS` (default 500, without
  parameters), unexpected database errors with stack, Redis connection changes,
  queue and worker errors.

Lines read `event key=value …` so they grep well in both formats. Use
`logEvent()` from `src/common/logging/log-event.ts` for new ones.

Not included yet: rendering designs (the frontend draws the document with the
kit), checks that need a running UI (keyboard focus order, 1.4.4 resize,
dark themes), design-decision weights per role, email delivery (invitations to
tester sessions are links the designer sends; team members are added by the
email of a user who has already signed in), email/password sign-in with
verification and password recovery (Google is the only identity provider),
account disabling, a queue dashboard, and distributed rate limiting. See
`docs/backend-implementation-report.md` for the full list of remaining gaps.

### Database commands

| Command            | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `pnpm db:migrate`  | Create/apply migrations in development               |
| `pnpm db:deploy`   | Apply existing migrations (staging/production, CI)   |
| `pnpm db:generate` | Regenerate the Prisma client (output is git-ignored) |
| `pnpm db:studio`   | Browse data in Prisma Studio                         |
