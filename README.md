# The Mesh

A small social network: posts with pictures, likes and comments, profiles, follows, a people
directory with suggestions, an activity stream and realtime direct messages with presence.
Built as a pnpm monorepo with NestJS, Prisma, PostgreSQL, React and Vite; shipped as two
container images behind Caddy and a Cloudflare Tunnel.

| | |
|---|---|
| `apps/api` | NestJS 12 (ESM) · Prisma 7 · PostgreSQL 17 · socket.io · zod validation · argon2 · JWT access + rotating refresh cookies |
| `apps/web` | React 19 · Vite 8 · React Router 8 · TanStack Query · Tailwind 4 + shadcn/ui · socket.io-client |
| `packages/shared` | zod schemas, types and constants used by both sides (the API contract) |
| `packages/config` | shared TypeScript and oxlint presets |
| `deploy/` | production `docker compose` stack, update and backup scripts, systemd timers |
| `docs/` | [`REBUILD_PLAN.md`](docs/REBUILD_PLAN.md) (architecture, phases, decisions), [`adr/`](docs/adr/), [`RUNBOOK.md`](docs/RUNBOOK.md), [`BACKLOG.md`](docs/BACKLOG.md) |

## Quick start

Requirements: Node 24, pnpm 11 (`corepack enable` or `npm i -g pnpm`), Docker (for PostgreSQL
and the integration tests).

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
| `pnpm db:migrate -- --name <change>` | create and apply a migration from schema changes |
| `pnpm db:deploy` / `pnpm db:check` / `pnpm db:seed` / `pnpm db:studio` | apply migrations / drift check / demo data / Prisma Studio |
| `docker build -f apps/api/Dockerfile .` | production image (same for `apps/web/Dockerfile`) |

## Testing

- **Unit** (Vitest): services, guards and helpers in the API; hooks and components in the web app
  with Testing Library and MSW.
- **Integration** (Vitest + supertest): the real NestJS app against PostgreSQL, one file per module;
  authorisation, validation, uploads, throttling and the chat gateway included.
- **End-to-end** (Playwright, Chromium): registration, sessions, feed, profiles, people, chat in two
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
(database, JWT, cookies, CORS origins, trusted proxies, uploads, throttling);
`apps/web/.env.example` the web build (`VITE_API_URL`, empty for same origin);
`deploy/.env.example` the production stack.
