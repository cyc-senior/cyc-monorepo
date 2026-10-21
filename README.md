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
