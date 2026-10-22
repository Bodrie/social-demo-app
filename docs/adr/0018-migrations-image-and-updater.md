# 0018 – Migrations in a one-shot image, an updater that applies only what changed

Date: 2026-10-22 · Status: Accepted · Supersedes the release bullet of [0006](0006-hosting-cloudflare-tunnel-pull-deploy.md) · Plan: `IMPLEMENTATION_PLAN.md` E4, review L19–L21

## Context
Since phase 6 the API image ran `prisma migrate deploy` from its entrypoint, so it carried the
Prisma CLI. Measured on 2026-10-22, the CLI and what comes with it (Studio, effect, pglite, React,
TypeScript) were about 260 MB of the image's 473 MB `node_modules`. Moving `prisma` to
`devDependencies` alone did not help: `@prisma/client` declares `prisma` and `typescript` as
optional peers, pnpm resolves an optional peer whenever the importer has the package (dev
dependencies included), and `pnpm install --prod` then installs it.

The updater (`update.sh`, every 5 minutes) ran `docker compose pull && up -d` under `set -e`.
It pulled `postgres` and `cloudflared:latest` from Docker Hub along with our images, so a Hub
failure or rate limit held back our releases and every cloudflared release went live
unannounced (review L19). The tunnel token was on cloudflared's command line, which `ps` shows
to every local user (L20).

## Decision
- **Migrations run in their own image**, `beso-migrate` (`apps/migrate`: a manifest with
  `prisma` and `dotenv` only, and a Dockerfile that copies the API's `prisma.config.ts`,
  schema and migrations; entrypoint `prisma`, default command `migrate deploy`). Compose has a
  `migrate` service (`restart: "no"`) and the API depends on it with
  `service_completed_successfully`, so any `docker compose up -d` migrates before the API
  starts. CI publishes the three images together.
- **The API image has no Prisma CLI.** `.pnpmfile.cjs` removes the optional peers
  `@prisma/client` → `prisma`, `typescript` and `@nestjs/swagger` → `typescript` before
  resolution (neither runs in production: the `prisma-client` generator writes the client at
  build time, swagger's TypeScript plugin is not used). The API image went from 963 MB to
  602 MB (`node_modules` 473 → 194 MB); the migrate image is 719 MB and is pulled once per
  release.
- **`update.sh` pulls only `migrate api web`, all or nothing.** A failed pull restarts nothing
  and fails the systemd unit. `postgres` and `cloudflared` are updated by hand (RUNBOOK §6).
- **`update.sh` applies only what changed.** It keeps a hash of the resolved compose config and
  the image ids in `.update-state` and runs `up -d` only when that hash changed or a service is
  not running. Every `up -d` reruns the exited one-shot service, which would otherwise mean a
  migration run every 5 minutes. A `.env` edit followed by `./update.sh` is applied the same
  way, so pinning a cached tag (a rollback) works.
- **Migrations run on their own before `up -d`** (`docker compose run --rm migrate`). Compose
  removes the old API container before it waits for `migrate`, so a migration failing inside
  `up -d` left no API at all. Now it stops the update and the running release keeps serving.
- The tunnel token reaches cloudflared as the `TUNNEL_TOKEN` environment variable.

## Consequences
- One more GHCR package (`beso-migrate`), private on first push like the others: it must be made
  public once, and until then every update fails at the pull.
- The box must refresh `deploy/` once (RUNBOOK §4.1). Until it does, the new API image still
  starts under the old compose file (it ignores `MIGRATE_ON_START` with a warning), but nothing
  applies later migrations.
- Prisma commands on the box go through `docker compose run --rm migrate <command>`.
- `POSTGRES_PASSWORD` still goes into a URL unencoded (L21): compose cannot encode it, so the
  rule "letters and digits, `openssl rand -hex 32`" is stated in `.env.example`, the compose file
  and the runbook, and the migrate service names the failure (`P1013`).
