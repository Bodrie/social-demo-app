# The Mesh – notes for AI-assisted development

## State of the repo

- A full rebuild (v2) is in progress. Plan: `docs/REBUILD_PLAN.md` (phases, decisions D1–D23). Decisions are recorded as ADRs in `docs/adr/`; add a new ADR instead of silently changing a decision.
- `api/` and `client/` are the **legacy** Express/CRA code. They are frozen and get deleted at cutover (phase 7). Do not edit, lint or format them.
- New code lives in `apps/api` (NestJS 12, ESM), `apps/web` (Vite 8 + React 19), `packages/shared` (zod schemas, constants; built with tsdown) and `packages/config` (tsconfig + oxlint presets).

## Commands (run from the repo root)

| Command | What it does |
|---|---|
| `pnpm install` | install every workspace (pnpm 11, Node 24, see `.nvmrc`) |
| `pnpm dev` | turbo: build `shared` once, then watch `shared`, `api` (`nest start --watch`) and `web` (`vite`) |
| `pnpm check` | `turbo run lint typecheck test build` – identical to CI |
| `pnpm test:int` | API integration tests (`apps/api/test/*.int-spec.ts`, supertest over HTTP) |
| `pnpm format` / `pnpm format:check` | Prettier, root `.prettierrc`; CI fails on drift |
| `pnpm db:up` / `pnpm db:down` | PostgreSQL 17 via docker compose on `localhost:5433` |
| `pnpm db:generate` | regenerate the Prisma client into `apps/api/src/generated` (turbo runs it before api tasks) |
| `pnpm db:migrate -- --name <change>` | create + apply a migration from schema changes (dev DB) |
| `pnpm db:deploy` / `pnpm db:check` | apply committed migrations / fail if DB and schema differ |
| `pnpm db:seed` | **truncates everything**, then loads deterministic demo data (alice/bob/carol, password `Password123!`) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm --filter @the-mesh/api <script>` | run one workspace's script |

## Conventions

- TypeScript 6.0, `strict` + `noUncheckedIndexedAccess` (from `packages/config/tsconfig/base.json`). Configuration is kept TypeScript-7-clean (no `baseUrl`, no `node10` resolution); see ADR 0007.
- Versions are pinned exactly in the `catalog:` of `pnpm-workspace.yaml`; workspaces reference them as `"catalog:"`. When adding a dependency, put its version in the catalog.
- ESM everywhere. In `apps/api` and `packages/shared` (`module: nodenext`) relative imports carry the `.js` extension: `import { x } from './x.js'`.
- `packages/shared` is consumed from its `dist/`; turbo builds it before dependants (`dependsOn: ["^build"]`). Run `pnpm --filter @the-mesh/shared build` after changing it if you are not using `pnpm dev`.
- Lint: oxlint with `--type-aware`, per-workspace `.oxlintrc.json` extending `packages/config/oxlint/base.json`. Format: Prettier only (no ESLint).
- Tests: Vitest in every workspace. Naming: `*.spec.ts` unit tests next to the source in `apps/api`; `*.test.ts(x)` in `apps/web` and `packages/shared`; `test/*.int-spec.ts` integration tests in `apps/api`.
- Validation schemas and DTO types that both the API and the web need go in `packages/shared` (zod 4), never duplicated. In the API a DTO is `class XDto extends createZodDto(xSchema) {}` (nestjs-zod); the global `ZodValidationPipe` validates bodies/queries/params typed with such DTOs.
- API conventions (`apps/api/src/app.setup.ts`, `common/filters/http-exception.filter.ts`): routes live under `/api/v1`; `GET /health` is outside the prefix; every error is the shared `ApiError` envelope `{ statusCode, code, message, fields?, requestId }` (throw Nest `HttpException`s, optionally with `{ code, message, fields }`; Prisma P2002/P2025 are mapped automatically; unexpected errors become a masked 500 and are logged); every response has `X-Request-Id`; Swagger UI at `/api/docs` and JSON at `/api/docs/openapi.json` outside production.
- Logging: inject `Logger` from `@nestjs/common` (backed by pino via nestjs-pino); pino-style calls `logger.log({ userId }, 'message')`. Never `console.log` in `src/`.
- Rate limiting: `ThrottlerGuard` is global (`THROTTLE_*` env); tighten per route with `@Throttle({ default: { limit, ttl } })`, opt out with `@SkipThrottle()`.
- Auth: the `AuthGuard` is global, so every route needs a session unless the handler or controller has `@Public()`. Read the caller with `@CurrentUser() user: AuthUser` (`{ id }`). Tokens live in httpOnly cookies (`access_token` 15 min JWT, `refresh_token` single-use, scoped to `/api/v1/auth`); a `Bearer` header works too. Never trust ids from the request body for authorisation.
- Services throw `HttpException`s with `{ code, message, fields? }`; `UsersService.assertAvailable` is the shared uniqueness check (409 with field messages).
- Uploads: files are written through the `StorageService` interface (`@Inject(STORAGE)`), never with `fs` directly, so object storage can replace the local disk later. Keys look like `avatar/<uuid>.webp`; records store keys, responses expose URLs via `assetUrl()`. Validate a client-supplied key with `UploadsService.assertExists(key, field)` and discard replaced files with `discard()`. Local files live in `UPLOADS_DIR` (`apps/api/uploads`, gitignored); integration tests get a temp dir.
- Integration tests: `createTestApp()` (`test/setup/app.ts`) boots the real app on the test DB with empty tables; `createUser(prisma)` / `login(agent, email)` in `test/setup/factories.ts`; use `request.agent(server)` so cookies persist. The shared test password is `Password123!`.
- Secrets only via environment variables; commit `.env.example` files, never `.env`. First run: `cp apps/api/.env.example apps/api/.env`.
- Database: schema lives in `apps/api/prisma/schema.prisma` (UUID v7 ids, snake_case via `@map`, `timestamptz`). Every schema change ships with a migration in the same PR (`pnpm db:migrate -- --name <change>`); never edit an applied migration. Prisma config is `apps/api/prisma.config.ts` (Prisma 7: no `url` in the schema, `.env` loaded there via dotenv).
- Integration tests (`pnpm test:int`) need Docker: they start a throwaway Postgres with Testcontainers unless `TEST_DATABASE_URL` is set (CI). They ignore `DATABASE_URL` on purpose and truncate the tables they use. The harness sets `DOCKER_AUTH_CONFIG` to an empty anonymous config because only public images are pulled; this also sidesteps Docker Desktop's Windows credential helper, which cannot be spawned from WSL (`appendWindowsPath = false`).
- pnpm 11 only runs approved postinstall scripts (`allowBuilds` in `pnpm-workspace.yaml`); approve new native deps with `pnpm approve-builds <pkg>`. Note: that command rewrites `pnpm-workspace.yaml`, so re-check the catalog afterwards.

## Workflow

- Work on `rebuild/*` branches, PRs into `main`; CI (`.github/workflows/ci.yml`) must be green.
- Keep `docs/REBUILD_PLAN.md` phase table current when a phase or slice is finished.
