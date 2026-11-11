# cyc-senior

Turborepo monorepo: a Next.js frontend (`apps/frontend`) and a NestJS backend (`apps/backend`).

> **VPN required:** the AI features use the CPE AI Gateway
> (`gateway.ai.cpe.kmutt.ac.th`), which is only reachable from the **KMUTT VPN**.
> Connect to the KMUTT VPN before running design generation, feedback analysis
> or persona synthesis locally. Without it those requests fail; the rest of the
> backend works without the VPN.

## Development setup

**Prerequisites:** Node 20.19+, 22.12+ or 24+, pnpm 9 (`corepack enable`), Docker.

```bash
pnpm install                    # also runs `prisma generate`
docker compose up -d            # Postgres on :5432, Redis on :6379
pnpm env:init                   # creates apps/backend/.env with a random JWT secret
cp apps/frontend/.env.example apps/frontend/.env.local  # sets NEXT_PUBLIC_API_URL
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # create the dev admin user (admin@senior.local)
pnpm routes:init                # registers cyc.localhost (3000) & api.cyc.localhost (4000)
pnpm dev                        # runs portless (cyc.local & api.cyc.local)
```

Before running the AI features, set `LLM_API_KEY` in `apps/backend/.env` and
connect to the KMUTT VPN (see the notice above).

### Commands

| Command                                  | Description                                              |
| ---------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                               | Run monorepo with Portless (`cyc.local` & `api.cyc.local`)|
| `pnpm dev:direct`                        | Run without Portless proxy (frontend :3000, backend :4000)|
| `pnpm dev:frontend` / `pnpm dev:backend` | Run a single app                                         |
| `pnpm build`                             | Build all apps                                           |
| `pnpm lint`                              | Lint all apps                                            |
| `pnpm test`                              | Run unit tests                                           |
| `pnpm db:migrate`                        | Create/apply migrations (development)                    |
| `pnpm db:generate`                       | Regenerate the Prisma client                             |
| `pnpm db:studio`                         | Browse data in Prisma Studio                             |

### Local URLs (Portless)

Apps run behind the [Vercel Labs Portless](https://github.com/vercel-labs/portless) proxy:

* **Frontend:** `http://cyc.local` (or `http://cyc.localhost`)
* **Backend API & Swagger:** `http://api.cyc.local/api` (or `http://api.cyc.localhost/api`)
* **OpenAPI JSON:** `http://api.cyc.local/api-json`

> **Tip:** If `.local` does not resolve on your machine, run `pnpm portless hosts sync` (admin), or access via `*.localhost` (e.g. `http://cyc.localhost`), which modern browsers resolve automatically.

To start Portless explicitly or in plain HTTP mode:
```bash
pnpm portless proxy start --no-tls   # Plain HTTP on port 80
# or
pnpm portless proxy start            # HTTPS on port 443 with local certs
```

### Signing in locally

You do not need Google credentials for development. Mint a token for the seeded
admin, or for another existing user:

```bash
pnpm dev:token                  # prints an access and a refresh token
pnpm dev:token --email a@b.com  # sign in as another existing user
```

Use the access token as a bearer token:

```bash
TOKEN=$(pnpm --silent dev:token --raw)
curl -H "Authorization: Bearer $TOKEN" http://api.cyc.local/api/users/me
```

In Swagger (`http://api.cyc.local/api`), click **Authorize** and paste the token. Access tokens last 15
minutes (`JWT_ACCESS_TTL_SECONDS`); run the command again for a new one.

`pnpm db:seed` and `pnpm dev:token` refuse to run unless `NODE_ENV=development`
(set in `.env.example`).

### Google sign-in (optional, to test the real flow)

1. In Google Cloud Console, create a _Web application_ OAuth client.
2. Add `http://api.cyc.local/api/auth/google/callback` as an authorized redirect URI (or `http://localhost:4000/api/auth/google/callback` for direct dev).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` in `apps/backend/.env`.
4. Open `http://api.cyc.local/api/auth/google` in a browser.
