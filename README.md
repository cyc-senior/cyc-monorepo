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

| Command | Description |
| --- | --- |
| `pnpm dev` | Run both apps in parallel (frontend :3000, backend :4000) |
| `pnpm dev:frontend` / `pnpm dev:backend` | Run a single app |
| `pnpm build` | Build all apps via Turborepo |
| `pnpm lint` | Lint all apps |
| `pnpm test` | Run unit tests (`test:ci`) across the workspace |

## Backend

- API runs on `http://localhost:4000` (`PORT` env overrides it).
- Swagger docs available at `http://localhost:4000/api` when not in production.
- Lint rules mirror `project-veil/veil-microservice` services: ESLint 8 +
  `@typescript-eslint/recommended` + `plugin:prettier/recommended`, with
  `curly`, `eqeqeq`, `max-classes-per-file`, `no-console` (warn) and friends.
  Prettier: single quotes, no semicolons, trailing commas, LF line endings.

## Development setup

Prerequisites: Node 20.19+, 22.12+ or 24+ (Prisma 7's minimum), pnpm 9 (`corepack enable`), Docker.

```bash
pnpm install                                   # also runs `prisma generate`
docker compose up -d                           # Postgres on :5432
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

| Script | Description |
| --- | --- |
| `pnpm db:seed` | Creates (or reuses) the admin user, `admin@senior.local` by default. Idempotent. Override with `DEV_ADMIN_EMAIL`. |
| `pnpm dev:token` | Issues a real access/refresh token pair for an existing user. |

Both scripts are plain CLI scripts in `apps/backend/scripts/`; there is **no
HTTP endpoint or flag that bypasses authentication**, so nothing changes in a
deployed server. They also refuse to run unless `NODE_ENV=development` is set
explicitly (it is in `.env.example`), so they exit with an error on staging and
production.

### Google sign-in (staging, production, or testing the real flow)

Google OAuth is the only way to sign in on a deployed environment. To use it
locally:

1. Google Cloud Console → APIs & Services → Credentials → create an OAuth client
   (type *Web application*).
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
  consumed and the client can retry. If the *response* is lost in transit
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

### Database commands

| Command | Description |
| --- | --- |
| `pnpm db:migrate` | Create/apply migrations in development |
| `pnpm db:deploy` | Apply existing migrations (staging/production, CI) |
| `pnpm db:generate` | Regenerate the Prisma client (output is git-ignored) |
| `pnpm db:studio` | Browse data in Prisma Studio |
