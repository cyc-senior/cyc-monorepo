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

The API models LLM-driven UI design: **project** (with its design brief)
**→ design rounds** (plus user stories) **→ generation jobs → UI variants**,
and an audit log. The full, interactive reference (every endpoint, DTO, and
which roles may call it) is the Swagger UI at `/api`; the raw document is at
`/api-json`.

**Projects are the workspace.** Any signed-in user can create one
(`POST /api/projects`) and becomes its **DESIGNER**, the owner of the project
and its design. They invite the team by the email of a user who has signed in
once (`POST /api/projects/:projectId/members`, `{ email, role }`): more
designers, or a **PROJECT_MANAGER** / **PRODUCT_OWNER**, who read everything
and change nothing (their say in design decisions is planned to carry a
role-specific weight).

**The design brief lives on the project:** `designIntent` and `uiLibrary`
(`SHADCN` or `MUI`) are required on creation; `targetPersona`,
`designGuidelines`, `brandIdentity`, `toneOfVoice` and `designTokens` are
optional JSON. Change it with `PATCH /api/projects/:projectId/design`, which
bumps `designVersion`.

A user has one **role per project** (`ProjectMember`); a role grants
**permissions** (`src/modules/access/permissions.ts` is the single source of
truth, and the table below is generated from it):

| Permission       | DESIGNER | PROJECT_MANAGER | PRODUCT_OWNER |
| ---------------- | :------: | :-------------: | :-----------: |
| `project:read`   |    ✓     |        ✓        |       ✓       |
| `project:update` |    ✓     |                 |               |
| `project:delete` |    ✓     |                 |               |
| `member:read`    |    ✓     |        ✓        |       ✓       |
| `member:manage`  |    ✓     |                 |               |
| `design:read`    |    ✓     |        ✓        |       ✓       |
| `design:write`   |    ✓     |                 |               |
| `design:approve` |    ✓     |                 |               |
| `audit:read`     |    ✓     |        ✓        |       ✓       |

How it is enforced:

- A controller method declares `@Authorize(Permission.X)`. The guard reads
  `:projectId` from the route, loads the caller's role in that project, and
  checks the permission. Not a member → `404` (ids cannot be probed); member
  without the permission → `403`. A guarded route with no `:projectId` fails
  closed.
- `test/rbac.e2e-spec.ts` fails if any route with `:projectId` lacks
  `@Authorize`, so a forgotten decorator cannot ship.
- Item routes (`/projects/:projectId/variants/:variantId`) are always looked up
  _through_ the project (`common/scopes.ts`), and ids inside request bodies
  (e.g. `storyIds`) are checked against the same project.
- Membership rules: a project always keeps at least one DESIGNER (checked under
  an advisory lock); anyone can leave.
- Approving a round records the approver and freezes it (it can then only be
  archived); deleting a project/round cascades its data, the audit log
  included.
- Every successful `POST`/`PUT`/`PATCH`/`DELETE` on a controller marked
  `@AuditEntity('…')` is written to `AuditLog` (actor, action such as
  `DesignRound.approve`, entity, redacted request body). Read it with
  `GET /api/projects/:projectId/audit-logs`.

### LLM design generation

`POST /api/projects/:projectId/rounds/:roundId/generation-jobs`
(`{ prompt?, variantCount? (1–4, default 2), storyIds? }`, designers) answers
`202` with a QUEUED job. The worker then, for each variant:

1. Prompts the model (`LLM_MODEL` on the OpenAI-compatible `LLM_BASE_URL`) with
   the project's design brief, the chosen user stories, the UI kit's component
   catalog and the WCAG rules, and constrains the answer with a **JSON schema
   built for the kit**: an `INSTANCE` node can only name a component of that
   kit. Earlier variants are listed so each one takes a different approach.
2. Checks the design: the **UI kit guardrail** (only the kit's components,
   props and values; containers only where the kit has them; kit fonts) and
   **WCAG 2.0 AA** as far as a static design shows it: 1.1.1 text
   alternatives, 1.3.1/3.3.2 labels and headings, 1.4.3 contrast (alpha
   blended over the real background, including the colors the kit itself
   draws, e.g. MUI's warning button fails), 2.4.2 screen titles, 2.4.4 link
   purpose, 3.1.1 language, 4.1.2 names of controls.
3. Sends a failing design back to the model with the list of issues, up to
   `DESIGN_REPAIR_ATTEMPTS` (default 2) times; text contrast still failing after
   that is recolored deterministically (recorded in `autoFixed`). A design that
   still fails is dropped, with its issues in the job's `outputMetadata`.

Passing designs are saved, in one transaction, as READY variants of the round
with `design` (the document) and `accessibility` (the WCAG report). If none
passes, the job is FAILED.

**Design format.** Figma-like JSON, not code: `DOCUMENT → CANVAS → FRAME`
screens made of `FRAME` (auto layout: `layoutMode`, `itemSpacing`,
`padding*`, `fills`, ...), `TEXT` (`characters`, `style`), `RECTANGLE` (shapes,
image placeholders) and `INSTANCE` (`componentKey` +
`componentProperties` of the kit), with `a11y` annotations (role, heading
level, label, decorative). `GET /api/ui-kits/{SHADCN|MUI}` returns the kit's
components, the theme the checks assume and the document's JSON Schema.
Hand-made or edited designs (`POST …/rounds/:roundId/variants`,
`PATCH …/variants/:variantId`) go through the same checks and are rejected with
`422` and the list of `issues` when they fail.

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
  with structure/UI kit/WCAG error counts) and LLM call (`llm.completion`
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
dark themes), design-decision weights per role, and email invitations (team
members are added by the email of a user who has already signed in).

### Database commands

| Command            | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `pnpm db:migrate`  | Create/apply migrations in development               |
| `pnpm db:deploy`   | Apply existing migrations (staging/production, CI)   |
| `pnpm db:generate` | Regenerate the Prisma client (output is git-ignored) |
| `pnpm db:studio`   | Browse data in Prisma Studio                         |
