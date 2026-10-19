# The Mesh

A small social network: posts with pictures, mentions and hashtags, likes, comments with
reactions and edit history, post pages and full-text search, profiles, follows, a people
directory with suggestions, an activity stream, realtime direct and group messages with presence
and typing, email confirmation and password reset, a bot check on registration, account export
and deletion, settings and legal pages.
Built as a pnpm monorepo with NestJS, Prisma, PostgreSQL, React and Vite; shipped as two
container images behind Caddy and a Cloudflare Tunnel.

| | |
|---|---|
| `apps/api` | NestJS 12 (ESM) · Prisma 7 · PostgreSQL 17 · socket.io · zod validation · argon2 · JWT access + rotating refresh cookies |
| `apps/web` | React 19 · Vite 8 · React Router 8 · TanStack Query · Tailwind 4 + shadcn/ui · socket.io-client |
| `packages/shared` | zod schemas, types and constants used by both sides (the API contract) |
| `packages/config` | shared TypeScript and oxlint presets |
| `deploy/` | production `docker compose` stack, update and backup scripts, systemd timers |
| `docs/` | [`REBUILD_PLAN.md`](docs/REBUILD_PLAN.md) (architecture, phases, decisions), [`adr/`](docs/adr/), [`ROADMAP.md`](docs/ROADMAP.md) and [`IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) (what comes next and how), [`RUNBOOK.md`](docs/RUNBOOK.md), [`BACKLOG.md`](docs/BACKLOG.md) |

## Quick start

Requirements: Node 24, pnpm 11 (`corepack enable` or `npm i -g pnpm`), Docker Engine with the
`docker compose` plugin (for PostgreSQL and the integration tests). Docker Desktop is not
required; on WSL/Ubuntu a native `docker-ce` + `docker-compose-plugin` install is enough. If
`docker compose` prints `unknown command`, the plugin is missing: `sudo apt-get install
docker-compose-plugin`, or drop the release binary into `~/.docker/cli-plugins/docker-compose`.

```bash
pnpm install
pnpm db:up                               # PostgreSQL 17 on localhost:5433
cp apps/api/.env.example apps/api/.env   # defaults work for local development
pnpm db:deploy && pnpm db:seed           # migrations + demo data (alice/bob/carol, Password123!)
pnpm dev                                 # api on :3000, web on :5173 (proxies /api and /socket.io)
```

Open http://localhost:5173 and sign in as `alice@example.com` / `Password123!`.
Swagger UI: http://localhost:3000/api/docs.

## Scripts

| Command | What it does |
|---|---|
| `pnpm check` | lint, typecheck, unit tests and build for every workspace (what CI runs) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test:int` | API integration tests against a throwaway PostgreSQL (Testcontainers) |
| `pnpm --filter @the-mesh/web e2e` | Playwright end-to-end suite against the built API and web app (reseeds the database; `… exec playwright install chromium` once) |
| `pnpm db:migrate --name <change>` | create and apply a migration from schema changes |
| `pnpm db:deploy` / `pnpm db:check` / `pnpm db:seed` / `pnpm db:studio` | apply migrations / drift check / demo data / Prisma Studio |
| `docker build -f apps/api/Dockerfile .` | production image (same for `apps/web/Dockerfile`) |

## Testing

- **Unit** (Vitest): services, guards and helpers in the API; hooks and components in the web app
  with Testing Library and MSW.
- **Integration** (Vitest + supertest): the real NestJS app against PostgreSQL, one file per module;
  authorisation, validation, uploads, throttling and the chat gateway included.
- **End-to-end** (Playwright, Chromium): registration and the mailed links, sessions, feed, comments,
  uploads, profiles, people, tags, search, account export and deletion, settings, chat in two
  browsers, phone layouts, error states and axe accessibility audits on every page.

CI (`.github/workflows/ci.yml`) runs all of it on every pull request; `docker.yml` builds the
images on pull requests and publishes them to GHCR from `main` and `v*` tags.

## Deployment

One Ubuntu box, no static IP: the stack in [`deploy/`](deploy/) runs PostgreSQL, the API,
Caddy serving the web app and proxying the API on one origin, and `cloudflared` for inbound
traffic. The box pulls new images on a timer. Everything is in
[`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Configuration

Runtime configuration is environment only. `apps/api/.env.example` documents the API
(database, JWT, cookies, CORS origins, trusted proxies, uploads, throttling, email transport and
the Turnstile secret); `apps/web/.env.example` the build-time variables of the web app (API
origin, dev proxy target, operator name and contact for the legal pages, repository URL,
Turnstile site key); `deploy/.env.example` the production stack.
