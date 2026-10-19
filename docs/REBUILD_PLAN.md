# The Mesh – Rebuild & Rewrite Plan

**Status:** v0.3 (2026-10-15). All decisions D1–D23 made (log in §6). Phases 0–3h merged (PRs #3–#12); the API is feature-complete. API review pass (six review agents, 2026-10-15) applied on branch `rebuild/api-review`; deferred items in `docs/BACKLOG.md`.
**Scope:** full rewrite of client, API and database; CI/CD; containerisation. Deployment target is deliberately left open until a domain/hosting is chosen.

---

## 0. How to use this document

- §1 is the audit of what exists today (main + branches). It justifies the decisions.
- §2 is the target architecture with a recommendation per area.
- §3 lists things the original brief did not mention but that need a decision.
- §4 is the proposed execution order with the reasoning behind it.
- §5 is the feature parity checklist (what v2.0 must do before the old code is deleted).
- §6 is the list of open decisions. Each has a default; answering "defaults" is a valid answer.

---

## 1. Current state

### 1.1 Repository and branches

| Item | State |
|---|---|
| `main` | Express 4 + MySQL API (`api/`, ~750 lines JS) and CRA React 18 client (`client/`, ~1.5k lines TSX + ~1.9k lines SCSS). Last functional commit 2024-02-07, README-only commits 2025-03-05. |
| `origin/nest-migration` | Oct 2024 attempt at this rewrite: NestJS 10 + Prisma 5 + PostgreSQL in `api_v2/`. Has a Prisma schema draft, 2 migrations, auth (register/login with Bearer JWT), user read. No posts/comments/likes/follows/uploads/sockets. Tracks a `.DS_Store`. Worth harvesting the schema ideas; not worth continuing (Nest 10/Prisma 5 are two majors behind, and the structure below differs). |
| `origin/test` | Single commit adding `api_v2/.gitkeep`. Delete. |
| `origin/update/readme` | Merged into main (PR #2). Delete. |
| Tags | None. |
| CI | None. No `.github/`. |
| Deploy | `deploy_dev.sh` (just `git push`), `deploy_prod.sh` (local build + `scp` to a physical Ubuntu box). Both obsolete. Commit `a02c921` removed a hard-coded `user@host` of the prod server from the script; it remains in git history. |
| DB schema | **Not in the repo at all.** No SQL, no migrations. Schema below is reverse-engineered from the queries. |
| Env | `api/.env.local` (gitignored): `HOST USER PASSWORD DB KEY PORT SOCKET DOMAINS NODE_ENV`. Client: `REACT_APP_API`, `REACT_APP_SOCKET`. |

Reverse-engineered MySQL schema (from `api/controllers/*.js`):

```
users(id, username, email, password, name, profile_picture, cover_picture, city)
posts(id, description, image, user_id, created_at, likes VARCHAR  -- CSV of user ids, e.g. "3,12,")
comments(id, description, created_at, user_id, post_id)
relationships(follower_user_id, followed_user_id)
latest_activities(id?, user, profile_picture, activity, created_at, user_id)   -- denormalised name + picture
```

### 1.2 Feature inventory

**Working**

- Register (username, name, email, password), login (JWT in httpOnly cookie), logout
- Feed: own posts + posts of followed users, newest first
- Create post: text (max 500) + optional image + emoji picker; image preview with fit toggle
- Like / unlike (icon or double-tap on image), like count
- Comments: list + add; per-post comment count
- Profile: cover + avatar, name/username, follow/unfollow, the user's posts; edit own profile (username, name, email, city, avatar, cover)
- Users page (all users), "Suggestions for you" (not followed in either direction)
- "Latest activities" of followed users (post created / commented / liked)
- Presence (online users) + ephemeral 1:1 chat via socket.io, up to 2 open chat windows + heads
- Light/dark theme (SCSS mixin), responsive layout with mobile header menu
- Cookie consent banner (stored in localStorage)

**Mocked, dead or incomplete**

- Stories (static mock data), left bar "Menu item 1-4" / "Section name", `/chats` route renders an empty `Draft` page
- Header search box (no handler), "Tag people", Share icon, post/profile "more" menus, profile social links (`href=""`), hard-coded "Bulgaria" and "Some Site Name"
- Chat: file-attach input does nothing, `chat_closed` is a TODO, messages are lost on refresh, presence is one entry per socket (multiple tabs = duplicates)
- Activity types "updated profile picture" / "just registred" exist in the type union but are never created
- Profile update: TODOs for activity + invalidation, ends in `window.location.reload()`
- No delete/edit for posts or comments, no pagination anywhere, lorem ipsum on login/register
- Tests: API `test` script is a stub; client has the CRA default test, which fails against this app

### 1.3 Findings – security (ranked)

| # | Severity | Where | Problem |
|---|---|---|---|
| S1 | Critical | `api/controllers/user.js` `updateUser` | No auth; target `id` comes from the request body. Anyone can change any account, including its email. |
| S2 | Critical | `api/controllers/user.js` `getUser`, `getAllUsers` | `SELECT *` returns bcrypt password hashes to every client. |
| S3 | High | `api/controllers/upload.js` `getImage` | `req.params.id` is concatenated into a filesystem path. A URL-encoded `..%2F` segment traverses out of `upload/images` and can read `.env.local` (DB credentials + JWT secret). |
| S4 | High | `api/routes/uploads.js` | Upload is unauthenticated, has no size or MIME limit, keeps the original filename. Disk-fill and HTML/SVG upload are trivial. |
| S5 | High | `like.js`, `relationship.js`, `activity.js` | Writes with no auth; `follower` id and activity author/name/picture are taken from the body, so follows and feed entries can be forged for any user. |
| S6 | Medium | `api/controllers/auth.js` | `jwt.sign` has no `expiresIn`: tokens never expire. Login sets the cookie without `sameSite`, logout clears it with `sameSite: "none"`; attribute mismatch means the clear can be ignored by the browser. |
| S7 | Medium | `api/socket.js` | Handshake trusts `auth.user` from the client; anyone can impersonate anyone in presence and chat. |
| S8 | Medium | all controllers | Raw MySQL errors are sent to the client. `req.body.email.length` on a missing field throws inside a DB callback, which is outside Express's error handling, so `POST /api/auth/login` with `{}` crashes the process. |
| S9 | Low | `api/index.js` | No rate limiting on auth, no `helmet`, TLS terminated in Node with cert files next to the code. |
| S10 | Low | git history | Prod `user@host` was committed in `deploy_prod.sh`. Make sure that box only accepts key auth, or retire it. |

### 1.4 Findings – bugs and design flaws

| # | Where | Problem |
|---|---|---|
| B1 | `api/controllers/like.js` | Likes are a CSV string. `REPLACE(likes,'1,','')` also removes the `1,` inside `11,` or `21,`, so one user unliking corrupts other users' likes. Placeholders inside quotes only work because ids happen to be numbers. |
| B2 | `client/src/components/Header/Header.tsx` | Imports `../../assets/logo-white.svg`, a file that was never committed (since `fc750c7`). A fresh clone does not build. |
| B3 | `client/src/router/Router.tsx` | `new QueryClient()` and `createBrowserRouter()` run on every render. Theme toggle or auth change wipes the query cache and remounts the router. |
| B4 | `Comments.tsx`, `Profile.tsx` | Query keys `["comments"]` and `["relationships"]` are not scoped by post/user id. Two open comment sections show each other's comments; follow state bleeds between profiles. |
| B5 | `AddPost.tsx`, `Comments.tsx`, `SinglePost.tsx` | `mutationFn` uses the comma operator `(addPost(x), addActivity(y))`, so only the activity promise is awaited. Post errors are swallowed, the feed is refetched before the post is saved, and an activity is written even when the post failed. |
| B6 | `api/connect.js` | Single `createConnection`, no pool, no reconnect. After MySQL's idle timeout every query fails until restart (matches the "server down" commits). |
| B7 | `api/controllers/comment.js` `getCommentsCount` | Loads every comment row and counts in JS instead of `GROUP BY`. |
| B8 | `Chat.tsx` | Mutates React state in place (`messages.push`), keys input state by display name, missing `key` on chat heads, duplicate `id="file"` across chat windows and AddPost (labels open the wrong input). |
| B9 | `RightBar.tsx` | `new Set(prev).has(newChat)` is reference equality, so duplicate chats can open; activity rows have no `key`. |
| B10 | `UpdateProfile.tsx`, `auth.js` | Avatar/cover are stored as absolute URLs containing the API host; moving hosts breaks every picture. Profile save ends with a full page reload. |
| B11 | all controllers | Timestamps are generated in app code with `moment` in server local time, no timezone; relative times are wrong for other timezones. |
| B12 | `api/package.json` | Scripts use Windows syntax (`SET NODE_ENV=dev&&`); they do not run on Linux/macOS, i.e. on the server. |
| B13 | dependencies | `fs` (junk npm package), both `mysql` and `mysql2`, `nodemon` in prod deps; `@mui/material` + emotion installed but **only `@mui/icons-material` is imported anywhere**; `react-cookie` provider mounted but never used; `web-vitals` noise. |
| B14 | `auth.js` register | `username` not unique in DB, email compared case-sensitively, validation order lets a DB round trip happen before format checks. |
| B15 | client | Only `Posts.tsx` reacts to 401 (logs out); five other `useQuery` call sites destructure `error` and ignore it. `ProtectedRoute` trusts the `user` blob in localStorage, so an expired cookie yields a logged-in-looking UI with failing requests. |
| B16 | `api/socket.js`, `api/index.js` | Socket server listens on a second port with its own HTTP server; presence array is rebuilt from all sockets per connection. |
| B17 | `theme.scss` | The `themify` mixin emits every rule once per theme, doubling CSS; theming by CSS custom properties is simpler and smaller. |

These are listed for the record; the rewrite does not fix them in place, it replaces the code. The parity checklist in §5 guarantees none of them come back.

---

## 2. Target architecture

### 2.1 Repository layout (monorepo)

```
.
├── apps/
│   ├── api/                 # NestJS
│   │   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   │   ├── src/
│   │   └── test/            # integration tests (supertest + Testcontainers)
│   └── web/                 # Vite + React 19
│       ├── src/
│       └── e2e/             # Playwright (or top-level e2e/ – see D15)
├── packages/
│   ├── shared/              # zod schemas, DTO types, API path constants, enums
│   └── config/              # shared tsconfig / eslint / prettier presets
├── docker/                  # Dockerfiles, Caddy/nginx config
├── docker-compose.yml       # local: postgres (+ optional minio, mailpit)
├── docker-compose.prod.yml  # proxy + web + api + postgres (+ backup)
├── .github/workflows/       # ci.yml, docker.yml, deploy.yml (later)
├── docs/                    # this plan, ADRs
├── pnpm-workspace.yaml, turbo.json, package.json, .nvmrc, .editorconfig
└── CLAUDE.md                # repo conventions for AI-assisted work (optional)
```

### 2.2 Stack decisions

| Area | Recommendation | Alternatives considered | Why |
|---|---|---|---|
| Package manager | pnpm (corepack-pinned) | npm | Fast, strict, workspaces; the nest-migration branch already used it. |
| Monorepo tasks | Turborepo | plain pnpm `-r` scripts, Nx | Task graph + caching in CI with almost no config. Nx is heavier than needed. |
| Node | 24 LTS, pinned in `.nvmrc` + `engines` | | Installed locally, current LTS. |
| Language | TypeScript 6.0 (`typescript@6.0.x`, pinned), `strict`, written to be TS 7-clean (no `baseUrl`, no node10 resolution). Upgrade to 7 once nest-cli and typescript-eslint support the 7.1 API. See §2.12. | TS 7 now with the `@typescript/typescript6` alias dance | 7 checks code exactly like 6, so the later bump is a version change, not a migration. |
| Backend | NestJS 12 (ESM project, Express adapter, default `nest build`) | Fastify adapter; SWC builder | socket.io, multer and most examples assume Express; Fastify's speed is irrelevant at this scale. nest-cli bundles its own TS 6, so the build is independent of the workspace TS version. |
| ORM | **Prisma** (latest, Postgres) | Drizzle; TypeORM (no) | Migrations are first-class (`migrate dev/deploy/diff`), which is the exact gap today. Typed client, seed hook, Studio, draft schema already exists. Drizzle is the runner-up if you prefer SQL-shaped code; TypeORM has the weakest typing and migration story. |
| Database | PostgreSQL 17 | 18 | Either; 17 is the safe default in managed offerings. |
| Primary keys | UUID v7 (`@default(uuid(7))`) | bigint identity | Non-enumerable public ids for profile URLs, time-ordered for index locality. |
| Validation / DTOs | zod schemas in `packages/shared`, consumed by `nestjs-zod` on the API and `react-hook-form` on the web | class-validator + class-transformer | One schema drives form validation, request validation and OpenAPI. Avoids duplicating rules on both sides. |
| Auth | Short-lived access JWT (≈15 min) + rotating refresh token (≈7 days, hashed in DB), both httpOnly `Secure` `SameSite=Lax` cookies; `GET /auth/me`; argon2id password hashing | DB-backed sessions (simpler, also fine) | Standard Nest pattern, works for HTTP and the WebSocket handshake, survives API restarts, allows "log out everywhere". |
| Config | `@nestjs/config` with a zod-validated env schema; app refuses to boot on bad config | | |
| Logging | `nestjs-pino` (JSON logs, request ids) | Nest default logger | Grep-able in Docker, correlates WS and HTTP. |
| Docs | `@nestjs/swagger` fed by zod DTOs (nestjs-zod), served at `/api/docs` outside prod. The Nest Swagger CLI plugin is **not** used (needs the TS compiler API). | | |
| Uploads | multer in memory → `StorageService` interface with a local-disk implementation now and an S3-compatible one later; `sharp` to resize, re-encode and strip metadata; MIME sniffed by magic bytes; random filenames; only the storage **key** stored in DB | S3/R2 from day one | No cloud account is assumed. The interface keeps the swap to object storage a one-file change. |
| Realtime | Nest `@WebSocketGateway` (socket.io) on the same HTTP port, authenticated from the cookie/token, rooms keyed by user id | | Fixes S7/B16. |
| Frontend build | Vite (latest) + `@vitejs/plugin-react` | | |
| React | 19 | | |
| Router | React Router 7, data mode (`createBrowserRouter`) | TanStack Router | Already known, less churn in a release that changes everything else. TanStack Router if you want typed routes/search params; it pairs well with TanStack Query. |
| Server state | TanStack Query 5 (keep), scoped key factory, optimistic updates for like/follow | | |
| Forms | react-hook-form + `@hookform/resolvers/zod` | | Replaces hand-rolled error state. |
| UI | **Tailwind CSS 4 + shadcn/ui (Radix primitives) + lucide-react icons** | keep SCSS with CSS modules + CSS variables; Mantine; keep MUI | MUI is only used for icons, so "replacing MUI" is really "replacing icons + choosing a styling approach". The current SCSS theme mixin doubles the CSS. shadcn gives accessible Dialog/Dropdown/Popover/Toast which the app lacks, and you own the component code. |
| Dates | `dayjs` with `relativeTime` (or `Intl.RelativeTimeFormat` helper) | date-fns | Drop `moment`. |
| HTTP client | thin `fetch` wrapper typed with shared schemas | keep axios | Not important; either works. |
| Emoji picker | keep `emoji-picker-react`, lazy-loaded | | It is heavy; `React.lazy` keeps it out of the main bundle. |
| Lint / format | oxlint with `--type-aware` (`oxlint-tsgolint`) per workspace, extending `packages/config/oxlint/base.json`; Prettier from the root `.prettierrc`; lint-staged pre-commit later | ESLint 9 + typescript-eslint; Biome | Both official scaffolds (Nest 12 CLI, create-vite 8) default to oxlint; 59/61 typescript-eslint type-aware rules; no TS compiler API. ADR 0008. |
| Unit tests (web) | Vitest + React Testing Library + jsdom + MSW | | Vitest is the native Vite runner. |
| Unit tests (api) | Vitest (what the Nest 12 CLI scaffolds; Vite 8's transform handles decorators + metadata) + `vitest-mock-extended` for Prisma | Jest + `@swc/jest` | One runner across the monorepo, no TS compiler API involved. ADR 0005. |
| Integration tests (api) | supertest against the booted Nest app with a real Postgres via Testcontainers (`@testcontainers/postgresql`); `DATABASE_URL` override for CI service containers | SQLite/in-memory (no: diverges from Postgres) | Tests the real SQL, migrations and constraints. |
| E2E | Playwright against the full stack (web + api + Postgres), seeded data, Chromium in CI, `@axe-core/playwright` on key pages | Cypress | |
| CI | GitHub Actions: `ci.yml`, `docker.yml`, later `deploy.yml`. No automated dependency-update bot (owner's choice); dependencies are bumped manually with `pnpm outdated` / `pnpm update`. | Dependabot / Renovate | |
| Containers | Multi-stage Dockerfiles (api: `node:24-bookworm-slim`; web: static files behind Caddy or nginx) | | |
| Reverse proxy | Caddy behind Cloudflare Tunnel (plain HTTP inside the box; automatic TLS if you ever expose it directly) | nginx | One binary, trivial config. nginx is fine if you prefer. |
| Deploy | Self-hosted single Ubuntu 24.04 box, Docker Compose, Cloudflare Tunnel, pull-based releases from GHCR (§2.11) | DDNS + port forwarding | No static IP needed; nothing listens inbound. |

### 2.3 Data model (PostgreSQL via Prisma)

```
User          id uuid pk, email text unique (stored lower-cased), username text unique,
              passwordHash, name, bio?, city?, website?, avatarKey?, coverKey?,
              createdAt timestamptz, updatedAt timestamptz

Post          id, authorId → User, content text, imageKey?, createdAt, updatedAt
              idx (authorId, createdAt desc), idx (createdAt desc, id desc)

PostLike      userId → User, postId → Post (cascade), createdAt
              pk (userId, postId), idx (postId)

Comment       id, postId → Post (cascade, NOT NULL), authorId → User, content, createdAt
              idx (postId, createdAt)

Follow        followerId → User, followeeId → User, createdAt
              pk (followerId, followeeId), idx (followeeId), check (followerId <> followeeId)

Activity      id, actorId → User, type enum {POST_CREATED, COMMENT_CREATED, POST_LIKED,
              USER_FOLLOWED, PROFILE_UPDATED, USER_REGISTERED},
              postId?, commentId?, targetUserId?, createdAt
              idx (actorId, createdAt desc)

RefreshToken  id, userId → User, tokenHash unique, expiresAt, revokedAt?, userAgent?, ip?, createdAt
              idx (userId)

Message       id, senderId → User, recipientId → User, content, createdAt, readAt?     -- if D8 = persist
              idx (senderId, recipientId, createdAt), idx (recipientId, readAt)
```

Differences from today and from the nest-migration draft:

- Likes become rows (fixes B1, enables counts and `likedByMe` in one query).
- Activities reference the actor and subject by id; name and picture are joined at read time (fixes stale denormalised data). They are created **server-side** by domain events, never posted by the client (fixes S5).
- `Comment.postId` is NOT NULL with cascade delete (the draft had nullable + SET NULL, which orphans comments).
- Pictures store a storage key, not a URL (fixes B10). URLs are built from `PUBLIC_ASSETS_URL`.
- `username` unique; email normalised.
- No stories table unless D9 says to build stories.

Seed: `prisma/seed.ts` with `@faker-js/faker` generating ~20 users, posts, comments, likes and follows, plus two fixed accounts for e2e. Dev images are bundled placeholders.

### 2.4 API surface (`/api/v1`)

```
POST   /auth/register            POST /auth/login     POST /auth/logout   POST /auth/logout-all
POST   /auth/refresh             GET  /auth/me

GET    /users?q=&limit=&cursor=  GET  /users/:id      GET /users/by-username/:username
PATCH  /users/me                 → { user }  (GET /auth/me reads it)
GET    /users/suggestions?limit= (list envelope)   GET  /users/:id/followers?limit=&cursor=   GET /users/:id/following?limit=&cursor=
PUT    /users/:id/follow         DELETE /users/:id/follow   (idempotent; 400 on self-follow)
GET    /users/:id/posts?cursor=

GET    /posts?limit=&cursor=     POST /posts          GET /posts/:id      DELETE /posts/:id
PUT    /posts/:id/like           DELETE /posts/:id/like            GET /users/:id/posts?limit=&cursor=
GET    /posts/:id/comments?limit=&cursor=   POST /posts/:id/comments   DELETE /comments/:id   (comment or post author)

GET    /activities?limit=&cursor=   (actors the caller follows; actor + post/comment excerpt + target user)
POST   /uploads?kind=avatar|cover|post   (multipart `file`; returns { key, url, width, height, bytes })
GET    /uploads/:kind/:file      (public, immutable)
GET    /messages                 (conversations: { items: [{ peer, lastMessage, unreadCount }], nextCursor: null })
GET    /messages/:userId?limit=&cursor=   POST /messages/:userId   POST /messages/:userId/read

GET    /health                   (terminus; DB check)
GET    /docs                     (Swagger, non-prod)

WS     presence:update, message:send (ack), message:new, message:read (ack), conversation:read   (contract in packages/shared messages.ts)
```

Conventions: cursor pagination (`createdAt,id`) for feeds; one error envelope `{ statusCode, code, message, fields?, requestId? }` (`apiErrorSchema` in `packages/shared`) from a global filter so forms can map field errors, with `code` from a fixed list (`ERROR_CODES`); every response carries `X-Request-Id`; post list items carry `author {id, name, username, avatarUrl}`, `likeCount`, `commentCount`, `likedByMe`; authorisation in services (owner checks), never trusting ids from the body.

### 2.5 Security baseline

- Every mutating route behind the auth guard; owner checks for update/delete.
- `helmet`, CORS allow-list from env (irrelevant once web and api share an origin behind the proxy), `@nestjs/throttler` on auth and uploads.
- Password policy via shared zod schema (min length 8, max 72); argon2id.
- Refresh token rotation with reuse detection; logout revokes; cookies `httpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` for the refresh cookie.
- Uploads: auth required, 5 MB cap, image MIME by magic bytes, re-encoded by `sharp` (strips EXIF and neutralises SVG/HTML), random name, served with `Content-Disposition: inline` and immutable cache headers from a path that cannot traverse.
- Never return `passwordHash`; use a `UserPublic` select everywhere.
- Error filter hides internals, logs with request id.
- Secrets only via env; `.env.example` committed; CI uses repository secrets.

### 2.6 Realtime

- Gateway authenticates on connect (access token from cookie or `auth.token`), stores `userId` on the socket, joins room `user:<id>`.
- Presence: map `userId → Set<socketId>`; emit `presence:update` with a de-duplicated user list (one entry per user, not per tab).
- DMs routed to `user:<recipientId>`; persisted first if D8 = persist, then emitted to both parties (so the sender's other tabs update too).
- Gateway integration tests with two `socket.io-client` instances.

### 2.7 Frontend architecture

```
src/
  app/            providers (QueryClient created once, Router, Theme, Auth), routes, error boundaries
  features/       auth/ feed/ posts/ comments/ profile/ users/ activities/ chat/ uploads/
                  each: api.ts (typed calls + query keys), hooks, components, tests
  components/ui/  shadcn primitives
  components/     layout (AppShell, Header, LeftBar, RightBar), shared bits
  lib/            http client, socket client, date helpers, env
  test/           vitest setup, MSW handlers/server, render helpers
```

- Auth: `useMe()` query backed by `GET /auth/me`; the `RequireAuth` layout route waits for it and provides `CurrentUserContext` to everything below; 401 → silent refresh (single flight per tab and, via `navigator.locks`, per browser) → retry once → session ends. No user blob in localStorage.
- Theme: `class="dark"` on `<html>` (next-themes), CSS variables, `prefers-color-scheme` default, localStorage override (`the-mesh:theme`).
- Feed: `useInfiniteQuery` with cursor; like/follow optimistic with rollback; comments keyed by post id.
- Routes: `/`, `/login`, `/register`, `/users`, `/u/:username`, `/messages`, `*` not-found (route `errorElement`). Route-level `React.lazy` in 4g once pages have weight.
- Loading/empty/error states for every list; toasts for mutation errors; accessible primitives for dialogs/menus.
- Removed: `react-cookie`, `moment`, `reportWebVitals`, MUI + emotion, `use-double-tap` (reimplemented in ~10 lines or kept, your call), mocked stories, placeholder menu items (see D9).

### 2.8 Testing strategy

```
            Playwright e2e (few, slow, full stack, Chromium in CI)      ~15–25 specs
        API integration (supertest + real Postgres)                     one file per module
     Web component/hook tests (Vitest + RTL + MSW)                      per feature
  API unit tests (Vitest, mocked Prisma) + pure helpers                 per service
```

- **API unit:** services with `mockDeep<PrismaClient>()`, guards, pipes, cursor encoding, storage service against a temp dir.
- **API integration (Nest calls this "e2e"):** boot `AppModule` once per file against a Testcontainers Postgres; `prisma migrate deploy` once per run; truncate tables between tests; drive HTTP with supertest and a cookie jar; assert status, body shape (parse with the shared zod schema), DB side effects, authz failures and validation errors. Gateway tests included. **This answers "not sure about e2e on the BE": you do not need a third API suite.** Real end-to-end coverage comes from Playwright through the UI, which exercises the API anyway.
- **Web unit/component:** hooks and components with MSW handlers generated from shared schemas; forms (validation messages), optimistic like rollback, route guard, theme persistence.
- **Playwright:** `globalSetup` resets + seeds the DB (via `prisma db seed` or an admin test endpoint enabled only in test env); `storageState` per seeded user; specs: register, login/logout, create post with image, like/unlike, comment, follow/unfollow + suggestions update, edit profile with avatar, user search, activities, chat between two browser contexts, theme toggle, mobile viewport smoke, axe checks on the main pages. Traces on first retry, HTML report uploaded on failure.
- Coverage: start with thresholds around 70 % on `apps/api/src/**/*.service.ts` and `apps/web/src/features/**`, ratchet up; no global 100 % targets.

### 2.9 CI/CD (GitHub Actions)

> Superseded by what shipped: `ci.yml` has the jobs `checks`, `integration`, `e2e` and `images` (the reusable `docker.yml`, called only after the first three passed, ADR 0011 M7). The table below is the original design.

`ci.yml` on `pull_request` and `push` to `main`, `concurrency` cancel-in-progress. Phase 1 ships a single `checks` job (install → `format:check` → `turbo run lint typecheck test build`, turbo cache in `actions/cache`); the integration and e2e jobs below are added in phases 3a and 5:

| Job | Steps |
|---|---|
| `setup` (composite action) | checkout, `pnpm/action-setup`, `setup-node` with pnpm cache, `pnpm install --frozen-lockfile` |
| `lint-typecheck` | `turbo run lint typecheck` |
| `test-unit` | `turbo run test` (web + api + shared) |
| `test-integration` | `services: postgres:17`; `prisma migrate deploy`; `pnpm --filter api test:int` (`DATABASE_URL` points at the service, Testcontainers skipped) |
| `build` | `turbo run build`; upload `apps/web/dist` and `apps/api/dist` as artifacts |
| `e2e` (needs build) | `services: postgres`; migrate + seed; start api (`node dist/main`) and web (`vite preview` or a tiny static server with `/api` proxy); `playwright install --with-deps chromium`; run; upload report on failure |

`docker.yml` on push to `main` and tags `v*`: build both images with Buildx (cache to GHA), push to `ghcr.io/<owner>/the-mesh-api` and `-web` tagged `sha-<short>` and `latest`/`vX.Y.Z`.

There is no `deploy.yml` that pushes to the server. Releases are pull-based (see §2.11): a `vX.Y.Z` tag makes `docker.yml` publish versioned images, and the server pulls them on a timer. No SSH from GitHub to the box, no self-hosted runner (GitHub advises against them on public repositories, and this repo is public), no server credentials in GitHub secrets.

Also: branch protection on `main` requiring `ci` green, PR template, optional CodeQL. No Dependabot/Renovate (decided 2026-10-15); run `pnpm outdated` periodically instead.

### 2.10 Local development

- `docker compose up -d` → Postgres (+ MinIO/Mailpit only if later needed).
- `pnpm dev` → Turbo runs `api` (nest --watch) and `web` (vite) together; Vite proxies `/api` and `/socket.io` to the API so cookies are first-party in dev too.
- `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio`, `pnpm test`, `pnpm test:int`, `pnpm e2e`.
- `.env.example` per app; README rewritten around these commands.

### 2.11 Production topology (self-hosted, no static IP)

Decision D12: proxy, web, api and Postgres all run on one Ubuntu Server 24.04 box behind a residential ISP connection without a static IP. That is **not a roadblock**. It changes two things: how traffic reaches the box, and how releases get onto it.

**Inbound traffic – pick one**

| Option | How | Needs | Notes |
|---|---|---|---|
| A. Cloudflare Tunnel (recommended) | `cloudflared` runs as a compose service and opens an *outbound* connection to Cloudflare; the public hostname is routed to the local Caddy | The domain's DNS hosted on Cloudflare (free plan) | No port forwarding, no DDNS, works behind CGNAT, TLS at the edge, WebSockets supported, 100 MB request cap (uploads are capped at 5 MB anyway) |
| B. DDNS + port forwarding | A DDNS client updates the A record whenever the ISP IP changes; the router forwards 80/443 to the box; Caddy obtains certificates | A real public IPv4 from the ISP (not CGNAT) and router access | Works with any DNS provider; a few minutes of downtime on every IP change; ports open to the internet |

CGNAT check: compare the router's WAN address with what `curl ifconfig.me` prints from the box. If they differ, or the WAN address is in `100.64.0.0/10` or a private range, the ISP uses CGNAT and only option A (or a VPS relay over WireGuard/Tailscale) works. Option A is simpler even without CGNAT, which is why it is the default.

```
[Cloudflare edge] ⇐ outbound tunnel ⇐ [cloudflared] → [Caddy :80] → /                → web (static)
                                                                   → /api, /socket.io → api :3000
api → postgres (volume), uploads volume
backup: nightly pg_dump + uploads → encrypted copy off the box (rclone to B2/Drive, or a second disk)
```

With option A Caddy serves plain HTTP inside the box (TLS terminates at Cloudflare; an origin certificate can be added later). With option B Caddy does automatic TLS once `DOMAIN` is set. Nothing in the app depends on the domain beyond `PUBLIC_WEB_URL`, `PUBLIC_ASSETS_URL` and the cookie domain.

**Releases – pull-based**

GitHub-hosted runners cannot reach a box without a stable public address, and GitHub advises against self-hosted runners on public repositories (this one is public). So the box pulls:

1. A git tag `vX.Y.Z` triggers `docker.yml`, which publishes `ghcr.io/<owner>/the-mesh-api:vX.Y.Z` and `:latest` (same for `-web`).
2. On the server a systemd timer (every 5 min) or Watchtower runs `docker compose pull && docker compose up -d`; the api container's entrypoint runs `prisma migrate deploy` before starting.
3. Rollback: pin the previous tag in the server's `.env` and `docker compose up -d`.

A push-button alternative later: a GitHub-hosted job reaching the box over Cloudflare Access SSH or Tailscale. Not needed for v2.0.

**Box setup (runbook to be written in `docs/`):** Docker Engine from Docker's apt repo, `unattended-upgrades`, no inbound ports with option A (ufw default deny, SSH from LAN only), fail2ban only if SSH is ever exposed, nightly backups with a restore drill.

### 2.12 TypeScript: 6 now, 7 later

Decision (2026-10-15): the project uses **TypeScript 6.0** and moves to 7 when the tooling allows a plain version bump.

Why not 7 today (verified 2026-10-15): TypeScript 7.0 (the native Go compiler) is stable since 2026-07-08 and is the `tsc` in the `typescript` package, but it ships **no programmatic compiler API** until 7.1. Tools that need that API do not run on 7.0: `nest build` with the tsc builder, the Nest Swagger CLI plugin, ts-jest, ts-node, and typescript-eslint's type-aware rules (7.1 support in progress, not released as of 2026-09-29). Running 7 now means aliasing `typescript` to `@typescript/typescript6` in every workspace that lints or builds Nest, and undoing it later. Not worth it for a type-checker speed-up on a codebase this size.

What we do so the later bump is trivial:

| Concern | Choice |
|---|---|
| Version | `typescript@6.0.x` pinned exactly in every workspace |
| tsconfig | written for 7 from day one: no `baseUrl` (relative `paths`), `module: nodenext` for the api (CJS output), `module: esnext` + `moduleResolution: bundler` for the web, `strict`, no `target: es5`, no `node10` resolution. TS 6 already errors on the removed options, so drift is caught. |
| API emit | `nest build` (nest-cli bundles its own TS 6); `tsc --noEmit` is a separate `typecheck` task. SWC builder stays an option. |
| API tests | Vitest (Nest 12 default); no TS compiler API |
| Web | Vite and Vitest transpile without the TS API; nothing to do |
| OpenAPI | from zod schemas via nestjs-zod; the Nest Swagger CLI plugin is not used |
| Lint | oxlint + tsgolint, type-aware; no TS compiler API |

Upgrade trigger: nest-cli, typescript-eslint and ts-jest (if ever used) publish releases supporting the TS 7.1 API. Then bump `typescript` and run `pnpm typecheck`.

### 2.13 Package manager and task runner

**pnpm** was chosen for: strict, non-flat `node_modules` (a package can only import what it declares, which matters in a monorepo), a content-addressable store (fast installs, little disk), first-class workspaces with `catalog:` for aligning versions across packages, mature CI caching, and the fact that every tool here (Nest CLI, Prisma CLI, Playwright, Turbo) is tested on Node + pnpm. The nest-migration branch already used it.

**Bun** is possible in two degrees:

- *Installer + script runner, Node runtime (low risk):* `bun install` with workspaces and the text `bun.lock`; `bun run` honours `#!/usr/bin/env node` shebangs, so the Prisma, Playwright and Nest CLIs still execute under Node; Turbo supports Bun workspaces. Gains very fast installs; loses pnpm's strictness and `catalog:`.
- *Bun as the API runtime (moderate risk):* Nest and the Prisma client do run on Bun, and Prisma itself runs Bun in production, but Nest does not officially support it, the Prisma CLI has had Bun-only breakages (run it with Node), native addons (`argon2`, `sharp`) are the usual trouble spot, and debugging/profiling tooling is weaker. Not for v2.0; it can be tried later behind the same Docker contract.
- *`bun test`:* fast, but not fully Jest-compatible (module mocking, jsdom/RTL setups less documented). Not recommended with Nest DI tests.

**Turborepo** is a task runner for workspaces: it runs `lint`, `typecheck`, `test`, `build` across packages in dependency order (shared before apps), in parallel, and caches outputs by content hash locally and in the GitHub Actions cache, so unchanged packages are skipped in CI. For this repo it is about 20 lines of `turbo.json`. It is optional; the alternative is `pnpm -r --parallel run <task>` plus a hand-written CI matrix and no caching. Nx does the same job with far more machinery. Decision D22.

---

## 3. Things the brief did not mention (need a decision or at least awareness)

1. **Existing data.** Is there MySQL data (users, posts, uploaded images) worth migrating, or do we start from a fresh Postgres + seed? Migration means a one-off ETL script (CSV likes → rows, re-upload images). Default: fresh.
2. **Secrets in history** (S10). Verify the old server, rotate anything reused.
3. **Auth details**: token lifetimes, "log out everywhere", password reset and email verification. Reset/verification need an email provider; default: out of v2.0, kept in backlog.
4. **Uploads**: storage location, size limits, image processing, what happens to existing images, default avatar/cover assets.
5. **Chat**: persistence, history, who may message whom, unread indicators, multiple tabs. Default: persist, anyone may DM, one presence entry per user.
6. **Activities** generated server-side (currently client-posted and forgeable).
7. **Deleting things**: own posts and comments, and account deletion (GDPR-style). Default: post/comment delete in v2.0, account deletion in backlog.
8. **Pagination / infinite scroll**: everything loads everything today.
9. **Search**: the header search box. Default: user search by name/username (`ILIKE`, trigram index if needed). Post search is backlog.
10. **Placeholder UI**: stories, "tag people", share, social links, left-bar items, hard-coded location/website. Default: remove; add real `website`/`bio` fields instead.
11. **Observability**: structured logs, request ids, health endpoint, optional Sentry.
12. **Docker** for dev parity and prod (was on the old README to-do list).
13. **Shared types package** so FE and BE cannot drift.
14. **Lint/format/pre-commit, editorconfig.** Dependency updates stay manual (no Dependabot, owner's choice).
15. **Accessibility** baseline: keyboard navigation, labels, focus management, colour contrast; jsx-a11y lint + axe in Playwright.
16. **Cookie banner**: the app only sets strictly necessary cookies, which do not require consent. A short privacy/cookie note is enough. Default: drop the banner.
17. **Backups and restore drill** for Postgres once deployed.
18. **Node/pnpm pinning** (`.nvmrc`, `packageManager` field).
19. **Branch hygiene**: delete `test` and `update/readme`; harvest then delete `nest-migration`; work via PRs to `main` (nothing in prod to protect) rather than a long-lived `v2` branch.
20. **Performance**: indexes in §2.3, pooled connections (Prisma handles it), HTTP compression at the proxy, image thumbnails, route-level code splitting, lazy emoji picker.
21. **Time handling**: `timestamptz` in UTC, formatted on the client.
22. **i18n**: not planned (English only). Say so explicitly so it is not accidental.
23. **Rate limits / abuse**: throttler on auth, uploads, post creation.
24. **Legal pages**: privacy note / imprint if the site goes public again. Minimal.

---

## 4. Execution order

### 4.1 Principles

- Foundations (workspace, CI, DB schema) first, so every later PR is linted, typed and tested from day one. Retrofitting CI onto a finished rewrite is where quality is lost.
- Schema before API, API before web. The web rewrite needs the final API contract; building it against the old Express API would mean rewriting the data layer twice. The old API cannot be kept because its data model (CSV likes, client-posted activities) is being replaced.
- Vertical slices inside each app (auth → users → uploads → posts → comments → follows → activities → chat), each landing with its tests.
- Old code stays untouched in `api/` and `client/` until §5 is green, then is deleted in one commit.

### 4.2 Phases

| Phase | Deliverable | Depends on | Size |
|---|---|---|---|
| **0. Decide & tidy** ✅ 2026-10-15 | Decisions in §6 recorded as ADRs in `docs/adr/`. Still with the owner: delete branches `test`, `update/readme`, `nest-migration`; check the old server. | – | S |
| **1. Workspace + CI skeleton** ✅ 2026-10-15 | pnpm workspace, Turbo, Node pin, root ESLint/Prettier/editorconfig, TypeScript 6 + `typecheck` scripts (§2.12), `packages/shared` + `packages/config` stubs, empty `apps/api` (Nest scaffold) and `apps/web` (Vite scaffold) that lint/typecheck/build/test (one trivial test each), `docker-compose.yml` with Postgres, `ci.yml` green, branch protection. | 0 | S–M |
| **2. Database** ✅ 2026-10-15 | `schema.prisma` per §2.3, initial migration (`20261015091302_init`, incl. a hand-written self-follow CHECK), deterministic faker seed with fixed accounts alice/bob/carol (`Password123!`), global `PrismaModule`/`PrismaService` (Prisma 7.10, `@prisma/adapter-pg`), zod-validated env via `@nestjs/config`, `pnpm db:*` scripts, integration-test harness (Testcontainers locally, service container in CI via `TEST_DATABASE_URL`), CI `integration` job (migrate deploy → drift check → seed → `test:int`). Prisma 8 skipped while it is an RC. | 1 | S |
| **3. API** | 3a platform ✅ 2026-10-15: zod-validated config, pino logging with `X-Request-Id`, global `ZodValidationPipe` + `ZodSerializerInterceptor` (nestjs-zod 5.5 on Nest 12 via peer override), catch-all exception filter producing the shared `ApiError` envelope (zod → `fields`, Prisma P2002/P2025/P2003 mapped, 5xx masked), helmet, CORS allow-list from `WEB_ORIGINS`, `@nestjs/throttler` as global guard, terminus `GET /health` (outside the `/api/v1` prefix, DB ping), Swagger at `/api/docs` (+ `/api/docs/openapi.json`) outside production, `configureApp()` shared by `main.ts` and tests, `test/platform.int-spec.ts` covering all of it. 3b auth + users ✅ 2026-10-15: register (auto-login), login (generic 401, timing-equalised), refresh with single-use rotation + reuse detection (revokes all sessions), logout, logout-all, `GET /auth/me`; argon2id; access JWT (HS256, 15 min) + opaque refresh token (SHA-256 stored, 7 d) in httpOnly `SameSite=Lax` cookies (refresh cookie scoped to `/api/v1/auth`), Bearer header also accepted; global `AuthGuard` with `@Public()` opt-out and `@CurrentUser()`; 10/min throttle on credential routes. Users: `GET /users/:id`, `GET /users/by-username/:username`, `GET/PATCH /users/me` (uniqueness → 409 with fields), `GET /users?q=&limit=&cursor=` (opaque cursor), `GET /users/suggestions`. Domain events (`user.registered`, `user.profileUpdated`) emitted via `@nestjs/event-emitter` for the activities slice. 36 integration tests. 3c uploads ✅ 2026-10-15: `StorageService` interface (`STORAGE` token) with a local-disk implementation under `UPLOADS_DIR` (keys `<kind>/<uuid>.webp`, confined to the root); sharp decodes by magic bytes (JPEG/PNG/WebP/GIF/AVIF, SVG refused), auto-rotates, resizes per preset (avatar 512², cover 1600×600, post ≤1920) and re-encodes to WebP, stripping metadata; 5 MB (`UPLOAD_MAX_BYTES`) and 40 MP (`UPLOAD_MAX_PIXELS`) limits; `POST /uploads?kind=` (multipart `file`, 20/min) → `{ key, url, width, height, bytes }`; `GET /uploads/:kind/:file` public, immutable cache; `PATCH /users/me` accepts `avatarKey`/`coverKey` (must exist; previous file discarded). Seed generates initial-letter avatars. 44 integration tests. 3d posts + likes ✅ 2026-10-15: `GET /posts` feed (own + followed authors, newest first, opaque cursor), `POST /posts` (content ≤500, optional `post/` image key that must exist, 30/min), `GET /posts/:id`, `DELETE /posts/:id` (author only, image discarded), `PUT`/`DELETE /posts/:id/like` (idempotent), `GET /users/:id/posts`; one query per page returns author, `likeCount`, `commentCount`, `likedByMe`; events `post.created`/`post.liked` (only on a new like). Credential throttle now keyed by client address + account. Seed adds images to ~30 % of posts. 55 integration tests. 3e comments ✅ 2026-10-15: `GET /posts/:id/comments?limit=&cursor=` (newest first), `POST /posts/:id/comments` (content ≤500, 30/min, 404 on unknown post), `DELETE /comments/:id` (comment author or post author), event `comment.created`; comments cascade with their post. 60 integration tests. 3f follows ✅ 2026-10-15: `PUT`/`DELETE /users/:id/follow` (idempotent, 400 on self-follow, 404 unknown), `GET /users/:id/followers` and `/following` (most recent first, cursor on the composite key), `followedByMe`/`followsMe` on every public user shape (profiles, search, suggestions, lists), event `user.followed` on new follows only. 64 integration tests. 3g activities ✅ 2026-10-15: `ActivitiesListener` turns domain events into rows (USER_REGISTERED, PROFILE_UPDATED when a picture changed, POST_CREATED, POST_LIKED, COMMENT_CREATED, USER_FOLLOWED) and removes like/follow entries on unlike/unfollow; services now `emitAsync` so rows exist before the request returns; `GET /activities?limit=&cursor=` = what followed users did, newest first, with actor, post/comment excerpts and target user. 69 integration tests. 3h WebSocket gateway ✅ 2026-10-15: socket.io on the API's HTTP server (`AppSocketIoAdapter` with the CORS allow-list), handshake authenticated from the `access_token` cookie or `auth.token`, room per user, presence deduplicated per user (`presence:update` only on online/offline transitions, new tabs get the list directly), `message:send` with ack → persisted → `message:new` to both parties (all tabs), `message:read` → `conversation:read` receipt; HTTP twins `GET /messages` (conversations with unread counts), `GET /messages/:userId?limit=&cursor=`, `POST /messages/:userId`, `POST /messages/:userId/read`. Global guards and the error filter are HTTP-only (sockets authenticate once). 74 integration tests incl. two-client socket scenarios. Each slice ships with DTOs in `packages/shared`, unit tests and integration tests. | 2 | L |
| **4. Web** | 4a shell ✅ 2026-10-15: Tailwind 4 + shadcn (new-york, lucide) theme ported from the legacy palette (light/dark via next-themes, class strategy), AppShell (header with sheet nav on small screens, left nav, right bar, responsive 3-column grid), `Providers` (QueryClient created once, theme, tooltips, sonner toasts, session-loss listener), React Router 8 data router with `RequireAuth` (provides `CurrentUserContext`) / `RedirectIfAuthenticated` layout routes and a route error element, typed fetch client (`lib/api/client.ts`: zod-parsed responses, `ApiClientError` envelope, 401 → single-flight refresh guarded by the Web Locks API → retry once → `onSessionLost`), `useMe()` + `startSession`/`endSession` cache helpers, Vitest + RTL + MSW 3 harness (`src/test/`), 21 tests; Playwright 1.64 harness (`playwright.config.ts` boots the built API + `vite preview` with the same proxy as dev) with a 4-test smoke spec and an `e2e` CI job (seeded Postgres, Chromium). 4b auth pages ✅ 2026-10-15: login/register with react-hook-form + `zodResolver` on the shared schemas, API field errors mapped onto inputs (`applyApiErrors`), the guard routes do the post-login navigation (back to the page that required auth). 4c feed ✅ 2026-10-15: design pass (oklch tokens, Inter Variable, 1rem card radius, blurred header, feed column capped at 42rem), `role="feed"` with `useInfiniteQuery` + IntersectionObserver sentinel, composer (auto-growing textarea, image attach with immediate upload + preview/retry/remove, lazy-loaded emoji picker, counter near the 500-char limit), post card (relative time, image, like with optimistic update + rollback, comments toggle, author-only delete behind an alert dialog), inline comments (newest first, Enter to send, delete by comment or post author, older pages on demand), cache helpers that keep every post list in step; MSW backend for posts/comments/uploads, 21 new Vitest tests (42 total), Playwright feed spec (publish with image → like → comment → delete, infinite scroll). 4d profile ✅ 2026-10-15: `/u/:username` with nested tab routes (posts, `/followers`, `/following`), header (cover or gradient, overlapping avatar, bio, city, website, joined, counts linking to the lists, "Follows you" badge), optimistic follow/unfollow that updates every cached profile and list plus the viewer's counts and refreshes the feed, reusable `PostList`/`UserList` (infinite scroll), edit-profile dialog (RHF + `updateProfileSchema`, diff-only PATCH via `buildProfilePatch`, avatar and cover `ImageField`s with immediate upload/remove, server conflicts mapped to fields, navigation on username change), 404 and error states; MSW users backend with follows, 14 new tests (56 total), Playwright profile spec (follow toggle, followers list, edit with avatar upload). 4e people ✅ 2026-10-15: `/users` with a debounced name/username search (mirrored to `?q=`), `UserList` results with follow buttons; right bar now has `SuggestionsCard` (people neither followed nor following, follow in place) and `ActivitiesCard` (first six, shared query); `/activity` page with the full infinite list and a nav entry; `ActivityText` renders one linked sentence per activity type; MSW activities backend, 9 new tests (65 total), Playwright people/activity spec. 4f chat ✅ 2026-10-15: socket.io-client over the same origin (cookie handshake), `ChatProvider` for the session (connect on sign-in, disconnect on sign-out, refresh-then-reconnect after token expiry, session end when refresh fails), presence ("Online now" card, dots on avatars), `/messages` two-pane page (conversations with unread badges, thread with day separators, grouped bubbles, read receipts, optimistic sends with retry, older history on scroll-up, Enter to send, emoji), new-message picker, Message button on profiles, unread badge in the navigation; HTTP fallbacks when the socket is down; fake socket for Vitest, 6 new tests (71 total), two-browser Playwright chat spec. 4g polish ✅ 2026-10-15: route-level code splitting (`lazy` routes per feature module, hydrate fallback, navigation progress bar, framework and socket chunks, socket client loaded after first paint), a bundle budget script that fails the build when the initial JavaScript grows past 230 kB gz, axe (WCAG 2.1 A/AA) audits in Playwright on every page in light and dark mode plus the edit dialog, keyboard checks (skip link, focus moves to the new page after navigating), `prefers-reduced-motion`, in-shell 404 page, scroll restoration, theme-color metas, accessible names and contrast fixes found by the audits. | 3 (3a–3b minimum; later slices can overlap with 3d–3h if you want to interleave) | XL |
| **5. E2E** ✅ 2026-10-15 | Playwright suite per §2.8: a `seed` project resets and reseeds the database before every run, a `setup` project stores sessions for alice, bob and carol (specs never sign in through the UI unless the sign-in flow is the subject), and specs cover registration and conflicts, session refresh after a lost access cookie, protected-route redirects, feed (publish with image, like, comment, delete, infinite scroll), composer limits (non-image, oversize, over-long), follow/unfollow from profile and between two members, comment moderation by the post author, profile editing with avatar, people search, suggestions and activity, chat in two browsers (presence, delivery, read receipt, reply), phone layouts (messages list ↔ thread, profile tabs, navigation sheet), error states (feed 500 + retry, unknown profile/page, failed like toast), axe audits and keyboard checks. 31 tests, ~20 s locally, `e2e` CI job. | 4 | M |
| **6. Containers + release pipeline** ✅ 2026-10-15 | `apps/api/Dockerfile` (node:24-slim multi-stage, prod-only deps incl. the Prisma CLI, non-root, health check, entrypoint runs `prisma migrate deploy`), `apps/web/Dockerfile` (static build served by Caddy, which proxies `/api` and `/socket.io`, serves uploads from the shared volume and sets cache headers), `deploy/` (compose with Postgres, api, web, cloudflared behind the `tunnel` profile; `.env.example`; `update.sh`; `backup.sh`; systemd timers), `.github/workflows/docker.yml` (build on PRs, publish to GHCR on main and `v*` tags), `docs/RUNBOOK.md`. No `deploy.yml`: releases are pull-based per §2.9/§2.11. Verified locally: both images build, the stack boots from an empty volume, migrations apply, register/upload/feed/socket work through Caddy. | 3, 4 | M |
| **7. Cutover** ✅ 2026-10-15 | §5 checklist verified and ticked; `api/`, `client/`, `deploy_dev.sh`, `deploy_prod.sh` deleted; README rewritten for v2; `CLAUDE.md`, `.prettierignore`, `.dockerignore` without legacy references. Tag `v2.0.0` after the merge (owner). | 5, 6 | S |

### 4.3 Order alternatives considered

- **Web first (CRA → Vite on the existing client):** the mechanical migration is cheap and visible, but the data layer would be rebuilt again once the API changes, and the current client does not build anyway (B2). Rejected, unless you need the old app demoable during the rewrite.
- **Interleaved API/web slices:** possible once 3a–3b exist, because MSW handlers from the shared schemas let the web proceed against a mock. Good for variety and for a second developer; for one person the sequential order has less context switching. Your call (D14).
- **Strangler (new Nest API proxying old endpoints):** overkill for ~5k lines with no live users.

### 4.4 Milestones / definition of done

| Milestone | Done when |
|---|---|
| M1 ✅ 2026-10-15 | `main` protected, `ci.yml` green on scaffolds, `pnpm dev` boots both apps against Docker Postgres. |
| M2 ✅ | `prisma migrate deploy` + drift check + seed + integration tests run in CI (`integration` job); schema ADR merged. |
| M3 ✅ 2026-10-15 | All §2.4 endpoints implemented; 74 integration tests; Swagger browsable; no `any` in services. |
| M3.5 ✅ 2026-10-15 | Web shell + auth usable end to end: sign in/out, protected routes, theme; Vitest and Playwright harnesses green in CI (`checks`, `integration`, `e2e`). |
| M4 ✅ 2026-10-15 | Web app feature-complete for v2.0 (feed, profiles, people, activity, chat); 73 Vitest tests; axe clean on every page; Lighthouse accessibility scores recorded in §4.7 (4g notes). |
| M5 ✅ 2026-10-15 | 31 Playwright tests green on Chromium (CI `e2e` job); chat tested with two browser contexts; database reseeded per run. |
| M6 ✅ 2026-10-15 (local) | `deploy/docker-compose.yml` boots the whole stack from the two images; GHCR publishing lands with the first merge of `docker.yml` to `main`; the box itself is set up per `docs/RUNBOOK.md`. |
| M7 ✅ 2026-10-15 | Old directories removed; README/CLAUDE.md current; `v2.0.0` to be tagged by the owner after the merge. |

### 4.5 Risks

- Scope creep (chat persistence, stories, notifications). Mitigation: §5 is the v2.0 line; everything else goes to `docs/BACKLOG.md`.
- Native deps (`sharp`, `argon2`) in Docker: use `node:24-bookworm-slim`, not alpine, or verify prebuilds.
- Prisma major-version churn: pin exact version; read the upgrade guide once at phase 2.
- Testcontainers needs Docker locally (present) and on CI (ubuntu runners have it); CI also supports the service-container fallback.
- Tailwind/shadcn design port: keep the current palette and layout; do not redesign while rewriting.
- TypeScript 7 later: the configuration is already 7-clean, so the bump waits only for nest-cli and typescript-eslint to support the 7.1 API.
- Residential hosting: ISP outages and a single box mean no HA; acceptable for a demo. Backups off the box are the one non-negotiable.

---

## 4.6 API review pass (2026-10-15)

Six independent review agents (security, correctness, data layer, platform/ops, tests, contract/code quality) read the finished API. Verified solid: auth core, authorisation on every route and socket event, parameterised SQL, upload pipeline, schema and cascades, event wiring. Fixed in `rebuild/api-review`:

- **Throttling**: login/register now stack three limits (global per address, 10/min per address+account, 30/min per address for any account); the previous per-route override had replaced the per-address limit, so one address could try unlimited accounts at full argon2 cost. Socket `message:send`/`message:read` are rate limited per user; at most 5 sockets per user; public upload serving is no longer throttled.
- **Uploads have owners**: new `uploads` table (key, owner, kind). A key can only be attached by its uploader and only where its kind fits; files are deleted only when nothing references them. `avatarKey`/`coverKey` are kind-restricted in the shared schema.
- **Pagination**: cursors now carry `(createdAt, id)` and lists use explicit keyset predicates. Deleting the cursor row no longer ends a list early, and follows lists keep their SQL `LIMIT` (Prisma dropped it for the composite key).
- **Data layer**: `relationJoins` so `_count` and viewer-relative flags compile to lateral joins instead of whole-table aggregates; sort-covering indexes on activities, follows, comments and posts-by-author; refresh rotation claims and issues inside one transaction; pool timeouts and `statement_timeout`; `%`/`_` escaped in search; a `messages_no_self_message` CHECK.
- **Sessions**: logout deletes the refresh row (a replayed logged-out token is merely invalid, not "theft"); `logout-all`/reuse detection emit `auth.sessionsRevoked`, which disconnects the user's sockets; a socket never outlives its access token; JWT claims are validated (`sub` must be a UUID); `GET /auth/me` for a deleted account is a 401.
- **Contract**: every list (incl. suggestions and conversations) uses `{ items, nextCursor }`; `GET /users/me` removed, `PATCH /users/me` returns `{ user }` like the auth endpoints; route params validated by zod DTOs (`VALIDATION_ERROR` keyed by parameter); `userSummarySchema` replaces `postAuthorSchema`; blank optional text becomes `null`; `website` is http(s)-only; typed socket event maps and ack schemas in shared; `API_BASE_PATH` constant.
- **Platform**: `TRUST_PROXY` accepts hop counts or address lists; production refuses development defaults (`PUBLIC_ASSETS_URL`, `WEB_ORIGINS`, `TRUST_PROXY`, placeholder `JWT_SECRET`, `COOKIE_SECURE=false`); body-parser/multer `http-errors` map to their status instead of a masked 500; Prisma disconnects after the HTTP server drains; 4xx logged at warn, request logs reduced to id/method/url/address/user-agent; health failures and socket handler errors are logged; `StreamableFile` errors use the envelope; OpenAPI has auth requirements and stable operation ids.
- **Tests**: 91 integration tests (was 74) incl. logout revocation, per-address throttle, forged-claim tokens, deleted-cursor paging, foreign upload keys, socket isolation, expired/forged handshakes, socket cap, revoked sessions, oversized bodies, picture-update activities; `.env` no longer leaks into test runs; `packages/config` is part of the turbo hash; CI cache keyed on the lockfile.
- **Seed**: usernames obey the shared rule, upload rows are recorded, previous generated files are removed.

## 4.7 Web phase notes (2026-10-15)

- **Versions actually used** (all exact in the catalog): Vite 8.3, React 19.3, React Router 8.4 (`react-router` + `react-router/dom`; the v7 data APIs unchanged), TanStack Query 5.104, Tailwind 4.3 + `@tailwindcss/vite`, shadcn CLI 4.21 (components import `cn` from the `cn` package and `radix-ui` as one package), react-hook-form 7.90 + `@hookform/resolvers` 5.9, msw 3.0 (`msw/node`, `msw/http`, `onUnhandledFrame`), Playwright 1.64, next-themes, sonner, lucide-react, dayjs.
- **Same origin everywhere**: `vite dev` and `vite preview` proxy `/api` and `/socket.io` to the API (`VITE_DEV_API_URL`, default `http://localhost:3000`), so cookies are first-party and CORS never applies in development, tests or e2e. Production will do the same through Caddy (phase 6). `VITE_API_URL` stays empty unless the API is served from another origin.
- **Session handling** is centralised: the guard routes navigate, pages do not. Signing in from `/login` returns to the path recorded by `RequireAuth` (`state.from`, in-app paths only); signing out or losing the session (`onSessionLost`) sets the `me` query to `null` and drops every other cached query, which makes `RequireAuth` redirect by itself. This removed a race where the auth page and the guard both navigated.
- **Why `CurrentUserContext`** instead of reading the cache in every component: with `useSyncExternalStore` a child can briefly see a newer store snapshot than its parent during a concurrent render; a component that *requires* a user would then throw while the guard was still about to redirect. The guard reads the cache once and provides the user downward, so children can never disagree with it.
- **Playwright** starts the API from `apps/api/dist` and the web app with `vite preview` (`webServer` entries), against whatever `DATABASE_URL` the API `.env`/environment points at, seeded with `pnpm db:seed`. Locally `pnpm --filter @the-mesh/web e2e` (after `pnpm build`), `pnpm --filter @the-mesh/web exec playwright install chromium` once. CI job `e2e`: Postgres service → generate/deploy/seed → build api + web → Chromium → tests, HTML report uploaded on failure. Add it to the ruleset's required checks.
- **Deferred to later slices**: code splitting (4g), `useDoubleTap` like gesture (4c), socket client (4f), axe checks in e2e (phase 5).

### 4c notes (2026-10-15)

- **Design pass** (owner gave free rein): tokens rewritten in oklch in `apps/web/src/index.css` (brand azure kept, cool-grey neutrals, `--like` and `--online` semantic colours, `--radius: 0.75rem`), Inter Variable self-hosted via `@fontsource-variable/inter` (Latin + Cyrillic subsets, ~48 kB woff2 for Latin), header with backdrop blur, left nav from `lg`, right bar from `xl`, main column capped at `max-w-2xl`. Contrast checked: primary on white ≈ 4.7:1, muted text ≈ 5.9:1.
- **Emoji picker**: `emoji-picker-react` 4.22.3 (5.0.0 shipped five days earlier; not adopted yet), rendered with native glyphs so no image CDN is involved, loaded through `React.lazy` → its own 82 kB (gz) chunk that only downloads when the picker opens.
- **Feed semantics**: `role="feed"` + `aria-busy`, each post an `<article aria-labelledby>`; like button carries `aria-pressed`, count buttons have visually hidden labels ("Like 3", "Comments 2") which the tests query by.
- **Cache strategy**: every post list lives under the `['posts', 'list', …]` prefix; `updatePostEverywhere`/`removePostEverywhere` fan a change out to all of them, likes are optimistic with a snapshot rollback and no refetch (the API is idempotent), creating a post prepends to the cached feed and the author's own list, counts on `me` are adjusted locally.
- **jsdom realm gotchas** (recorded in `src/test/setup.ts`): Node's fetch (which MSW drives) only accepts its own `FormData`/`Blob`/`File`, so the setup swaps those globals to Node's; Vitest's `URL.createObjectURL` shim is replaced by a stub; `IntersectionObserver` is a controllable mock (`intersectAll()`); user-event's `upload` honours the input's `accept` list unless `applyAccept: false`.
- **Bundle**: main chunk 226 kB gz (was 214) + lazy emoji chunk; route-level splitting still planned for 4g.

### 4d notes (2026-10-15)

- **Routes**: the profile is a layout route (`u/:username`) that loads the user once and hands it to the tab routes through `useOutletContext` (`useProfileContext()`); tabs are plain `NavLink`s, so followers/following have shareable URLs and the back button works.
- **One cache story for people**: profiles live under `['users', 'profile', username]`, every people list under `['users', 'list', …]`; `updateUserEverywhere` fans a change out to all of them. Follow toggles are optimistic (flags, follower count on them, following count on me and on my cached profile), roll back from a snapshot of all `users` + `me` queries, and on success invalidate the feed and the two lists involved.
- **Profile edits** send only the diff (`buildProfilePatch`, unit-tested); pictures are uploaded as soon as they are picked (`useImageUpload('avatar' | 'cover')`), `null` removes; after saving, `me` is replaced, the author summary is patched into cached posts, `users`/`comments` are invalidated and a username change navigates to the new address.
- **Test backend**: `mockDb.users` (alice/bob/carol clones per test) + `mockDb.follows`; `toPublic(user, viewerId)` computes counts and flags live; `seedFollow()`; the db is seeded at import so the first test in a file sees it too; sonner's store is cleared between tests (`toast.dismiss()`), otherwise a previous test's toast is replayed into the next Toaster.
- **Playwright sessions**: nine UI sign-ins in one run tripped the API's credential throttle (10 per account per minute), so the suite now has a `setup` project (`e2e/auth.setup.ts`) that signs in once and stores cookies in `e2e/.auth/alice.json` (gitignored); the `chromium` project depends on it, specs call `openHome(page)`, and the smoke spec opts out with `test.use({ storageState: ANONYMOUS })` because it exercises the sign-in flow itself. The access token lasts 15 minutes, far longer than a run, so the single-use refresh token is never rotated by two contexts at once.
- **Bundle**: main chunk 231 kB gz.

### 4g notes (2026-10-15)

- **Code splitting**: the entry keeps the shell, the home feed and the auth pages; `/users`, `/activity`, `/messages/*`, `/u/*` and the 404 page are `lazy` routes. Each feature area exports its route components from one `routes.tsx` so it becomes a single chunk (`features/profile/routes.tsx`, `features/chat/routes.tsx`). A direct load of a lazy address shows the full-page spinner (`hydrateFallbackElement`); later navigations keep the current page and show a thin top progress bar after 150 ms. `manualChunks` pins only two long-lived groups (`react`: react, react-dom, scheduler, react-router; `socket`: socket.io-client), the rest splits by usage. The socket client itself is imported dynamically by the ChatProvider after the shell renders.
- **Budget**: `apps/web/scripts/bundle-budget.mjs` runs as part of `pnpm build`, sums the gzipped size of the scripts `dist/index.html` loads up front and fails above `BUNDLE_BUDGET_KB` (230). Measured after 4g: 228.6 kB gz for the first paint (index 79, react 96, shared schemas 27, shell pieces 26), down from 246; the emoji picker (76 kB) and every page chunk load on demand. The next real win is `zod/mini` for the browser build of the shared schemas (backlog).
- **Accessibility**: `e2e/a11y.spec.ts` runs axe with the WCAG 2.1 A/AA tags on sign-in, register, home (light and dark), people, activity, a profile, a message thread, the edit-profile dialog and the 404 page, and fails on any violation. Fixes it drove: light-mode primary darkened to `oklch(0.5 0.15 241)` (white text on buttons and primary links were just under 4.5:1), the account menu trigger now keeps the visible name in its accessible name (WCAG 2.5.3), scrollable regions (thread log, conversation list) are keyboard-reachable. Also new: a "Skip to content" link, focus moves to `<main>` after navigations that start outside it, `<ScrollRestoration>`, reduced-motion CSS, theme-color metas, an in-shell "Page not found" page.
- **Lighthouse 13.5** (Playwright's Chromium attached over the devtools port, built app, seeded data, default mobile throttling): accessibility **100** on `/login`, `/` and `/u/bob`; best practices 96 / 100 / 100 (the sign-in page logs the expected 401s from the session probe and refresh); SEO 92 → the missing `robots.txt` is now in `apps/web/public/`; performance 89 / 64 / 74. The performance gap on the feed is the throttled first load: ~230 kB gz of JavaScript plus the first post images; next steps are image dimensions (CLS), `fetchpriority` on the first image, font preloads and the `zod/mini` build (backlog). On WSL, chrome-launcher assumes a Windows Chrome, so Lighthouse must attach to a Chromium you start yourself (`--remote-debugging-port` + `--port`).

### 4f notes (2026-10-15)

- **Transport**: one socket per tab (`lib/socket.ts`, `autoConnect: false`); the `ChatProvider` under `RequireAuth` connects it for the session and tears it down on sign-out. The browser sends the access cookie with the handshake, so nothing is stored client-side. The server closes the socket when the access token expires (15 min); the provider answers an `io server disconnect` with `refreshSession()` and reconnects, and a failed refresh ends the session everywhere. `connect_error: Unauthorized` triggers the same refresh while socket.io keeps retrying. The socket closes on `beforeunload`, so reloads do not leave dead sockets counting against the per-user cap (5) until the ping times out; a tab refused with `Too many connections` (socket.io never retries a middleware refusal) tries again after 10 s.
- **Pushes into the cache**: `message:new` is appended to the loaded thread and moves the conversation row to the top (unread +1 unless that thread is on a visible screen, in which case `message:read` is sent at once); `conversation:read` marks my sent messages as seen; `presence:update` lives in provider state. Sends go through `emitWithAck` (8 s timeout) and fall back to `POST /messages/:userId` when the socket is down, same for mark-read.
- **Optimistic sends**: a `pending-…` copy appears immediately; the ack swaps it for the persisted message and `message:new` (which arrives for the sender too) is deduplicated by id, in either order. Failures mark the bubble and offer Retry.
- **Threads** are cached newest-first like the API and rendered reversed; scrolling near the top loads older pages and keeps the scroll offset; the view sticks to the bottom unless the reader scrolled up. Usernames in `/messages/:username` are resolved through the cached profile query.
- **Tests**: `socket.io-client` is mocked with `FakeSocket` (`src/test/socket-mock.ts`): tests push server events with `serverEmit()`, inspect `emitted`, and the default ack handlers persist into `mockDb` like the gateway. TanStack notifies observers on a timer, so assertions after a push use `waitFor`. The e2e spec opens a second browser context for bob (one extra UI sign-in) and checks presence, delivery, the read receipt and the reply without reloads.

### 4e notes (2026-10-15)

- **Search**: the box owns its text; `useDebouncedValue` (300 ms) feeds both the query key (`['users', 'list', 'search', q]`) and a `replace` navigation to `?q=`, so searches are shareable and a page load starts from the address. The URL is not read back into the box afterwards (no history entries are created, so nothing can get out of step).
- **Suggestions** come from `GET /users/suggestions` (not followed, not following); following one updates the row optimistically through the shared user cache and keeps it visible until the next load, so an accidental tap can be undone. The suggestions query is a flat `{ items }` list and therefore lives under `['users', 'suggestions']`, not under the `['users', 'list']` prefix whose entries are infinite pages; `updateUserEverywhere` handles both shapes (a shape mismatch there threw inside `onMutate` and silently dropped the follow request until the tests caught it). Below `xl` the card moves to the top of the People page.
- **Activity** is what followed people did (`GET /activities`, newest first). The sidebar card and the Activity page share one infinite query; following someone invalidates it. `ActivityText` is the single place that turns a type into a sentence; a post permalink would make the excerpts clickable (backlog).
- **Tests**: the right bar is only hidden by CSS, so in jsdom every page renders suggestions and activity too; queries for Follow buttons must be scoped (`within(region)`), and every page needs handlers for those two requests.

### Phase 5 notes (2026-10-15)

- **Projects**: `seed` (runs `pnpm --filter @the-mesh/api db:seed`, ~4 s) → `setup` (signs in alice, bob, carol once and stores cookies in `e2e/.auth/`) → `chromium` (every spec starts as alice; `contextAs(browser, 'bob' | 'carol')` opens a second signed-in context without a login; `test.use({ storageState: ANONYMOUS })` for specs that must start signed out). The reseed makes runs repeatable even though specs create posts, comments, messages, follows and members; specs still clean up what would confuse others within the same run.
- **Refresh tokens are single-use**, so the spec that drops the access cookie to exercise the silent refresh signs in on its own: rotating the shared session's refresh token would invalidate it for every other context.
- **A real bug caught by the mobile messages spec**: the gateway pushes `message:new` to the sender before the ack resolves, so for a few milliseconds the thread showed the optimistic copy next to the persisted one. `appendToThread` now replaces the pending copy a push confirms; the unit test asserts the push-before-ack order never yields two bubbles.
- **Locator hygiene learned the hard way**: `getByLabel('Name')` also matches "Username" (use `exact: true`); route patterns must cover the first page without a query string; `Button asChild` around a `Link` yields a link role.
- **Noise**: the API prints `Error: read ECONNRESET` / `write EPIPE` lines when browser contexts close mid-request; harmless, parked in the backlog.

### Phase 6 notes (2026-10-15)

- **Images**: Debian slim instead of Alpine so argon2, sharp and the Prisma schema engine use prebuilt glibc binaries (no compilers in the image). The API image installs production dependencies with `pnpm install --prod --filter @the-mesh/api...` and copies the built `shared` package next to them; `prisma` and `dotenv` moved to `dependencies` because `prisma migrate deploy` runs in the container (`prisma.config.ts` needs both). `prisma generate` needs a placeholder `DATABASE_URL` at build time. Sizes (uncompressed): api ≈ 960 MB, web ≈ 95 MB. The API image is dominated by the Prisma 7 CLI's own dependencies (`@prisma/studio-core`, `effect`, `typescript`, `@electric-sql/pglite`, ≈ 200 MB) that come along for `migrate deploy`; a separate one-shot migrate image would halve the runtime image (backlog). The entrypoint starts as root only to `chown` the uploads volume (named volumes are created root-owned), then re-executes itself as `node` via `setpriv`.
- **One origin**: Caddy serves the SPA, proxies `/api/*` and `/socket.io/*` to `api:3000`, and serves `/api/v1/uploads/*` directly from the uploads volume (immutable cache headers). It rewrites `X-Forwarded-For` from `CF-Connecting-IP`, so the API runs with `TRUST_PROXY=1`. `/health` stays private (not under `/api`). HSTS is owned by the API (helmet); Cloudflare's HSTS stays off.
- **Compose**: `name: the-mesh`; required variables fail fast (`${VAR:?…}`); the web port is bound to `127.0.0.1:8080` only; `cloudflared` is behind the `tunnel` profile so the stack also runs without Cloudflare (LAN, CI, local smoke). `stop_grace_period` set; the API has `enableShutdownHooks()`.
- **Releases**: `docker.yml` builds both images on PRs (no push) and publishes on `main` (`latest`, `sha-…`) and tags (`vX.Y.Z`, `vX.Y`). The server's `mesh-update.timer` runs `update.sh` every 5 min (`pull` + `up -d`); rollback = pin `TAG`. No credentials of the box live in GitHub.
- **WSL note**: Docker CLI builds need a credential-helper-free config here (`DOCKER_CONFIG` pointing at a dir with `{"auths":{}}`), same root cause as the Testcontainers workaround.

### Phase 7 notes (2026-10-15)

- Removing the legacy entries from `.prettierignore` revealed that the pattern `api/` had matched every directory called `api`, so `apps/api` and `apps/web/src/lib/api` had never been checked by Prettier. They are formatted with the root config now (68 files, whitespace only; lint, typecheck, unit and integration tests unchanged).
- Nothing else in the repository referenced the old code: `.dockerignore`, `CLAUDE.md` and the README were the only places.

## 4.8 Phase 8 – v2.1 follow-ups (owner's review, 2026-10-16)

After using v2.0 the owner asked for the items below. One PR per slice, same flow as before.

| Slice | Deliverable | Status |
|---|---|---|
| 8a | Sign in / sign up redesign (brand panel with a mesh gradient, focused form, password visibility toggle); sidebars scroll on their own when taller than the viewport (right column was cut off); no sideways layout shift when overlays open (`scrollbar-gutter: stable` + no scroll-lock margin); backlog pruned of items done in phases 4–6. | ✅ 2026-10-16 |
| 8b | Posts and comments: edit post and edit comment (author only) with revision history behind an "edited" marker that opens the previous versions; comment reactions (👍 ❤️ 😂 😮 😢, one per member and comment, switchable, optimistic with rollback); comment sorting (Newest / Top = most reactions first, ties newest). API: migration `comment_reactions_and_revisions` (`post_revisions`, `comment_revisions`, `comment_reactions`, `edited_at` on both, denormalised `reactions_count` for the ranked sort with its own index), `PATCH /posts/:id`, `GET /posts/:id/revisions`, `PATCH /comments/:id`, `GET /comments/:id/revisions`, `PUT`/`DELETE /comments/:id/reaction` (answer with the fresh summary), `?sort=newest|top` with a ranked keyset cursor (`score|createdAt|id`). Seed adds reactions and one edited post and comment. Web: `InlineEditor`, `EditedMarker`, `ReactionBar`, comment options menu, sort control; MSW backend extended. 10 + 2 integration tests, 5 web tests, Playwright `comments.spec.ts`. Bundle budget raised from 230 to 240 kB gz: the feed now ships inline editing, the history popover and the reaction bar (+2 kB). | ✅ 2026-10-16 |
| 8c | Account security: `POST /auth/password` (verifies the current password, stores a new argon2 hash, revokes every other refresh token and keeps the caller's; wrong current password and reused password come back as field errors; 5 attempts per minute). Web: `/settings` page from the account menu with Appearance (system / light / dark), Password (current, new, confirm; server errors land on the field) and Sessions (sign out everywhere, confirmed). Other devices keep their access token for at most 15 minutes, then fail to refresh. 2 integration tests, 4 web tests, Playwright `settings.spec.ts` (carol), `/settings` in the axe audit. | ✅ 2026-10-16 |
| 8d | Chat, part 1: typing indicator and pictures in messages. Typing is an ephemeral socket signal (`typing` → `typing:update` to the recipient's tabs, no persistence, no ack, rate-limited, invalid or self-addressed payloads dropped); the composer sends at most one `true` per 2.5 s and a `false` after 3 s idle, on send and on unmount; the receiver expires a stale `true` after 6 s and clears it when the message arrives. Shown as “typing…” in the thread header and conversation row plus a dots bubble (`sr-only` “X is typing…”). Pictures: migration `message_pictures` (`messages.image_key`, `upload_kind` value `message`), preset 1600×1600 inside, `sendMessageSchema` = text and/or `imageKey` (one required, key must be an owned upload of kind `message`), `imageUrl` on every message incl. conversation snippets (“Picture” with an icon), `discard` also counts message references; web composer attaches through `useImageUpload('message')` with the shared `AttachmentPreview` (extracted from the post composer), optimistic bubble shows the local preview, bubbles link to the full-size file, seed adds one unread picture from Bob. 3 integration tests (pictures, typing relay, typing rate limit), 2 web tests, Playwright `chat.spec.ts` extended (typing live, picture pushed to the other member). | ✅ 2026-10-16 |
| 8e | Chat, part 2: group chats. New data model (ADR 0009): `conversations` (`direct` \| `group`, title, creator, `direct_key` unique per pair, denormalised `last_message_at`), `conversation_members` with a per-member `last_read_at`, messages by `conversation_id`; migration `group_conversations` carries every existing direct message over with both members and their read marks. API module `conversations` replaces `messages`: `GET/POST /conversations`, `PUT /conversations/direct/:userId` (idempotent, listed only once something was said), `GET /conversations/:id`, `/messages` (keyset), `/read` (returns the mark), `POST /members` (any member adds), `DELETE /members/me` (last one out deletes the group); non-members get 404. Socket: `message:send`/`message:read`/`typing` take `conversationId`, pushes fan out to each member's room, `conversation:update` (refetch) and `conversation:removed` for membership changes, typing relays chained per socket. Web: `/messages/:conversationId` threads, `/messages/with/:username` resolver, `NewGroupDialog` (name + multi-pick), `GroupMembersDialog` (members with presence, add people, leave with confirmation), shared `PeoplePicker`, group avatar tile, sender names on group bubbles and in snippets, receipts "Seen" / "Seen by Bob" / "Seen by everyone", multi-person typing text; MSW and fake socket keep a conversations store. Seed: the alice–bob thread plus a group "Weekend plans" (alice, bob, two more; carol stays empty for the phone flow). 7 new HTTP integration tests + socket tests rewritten (110 total), 11 web tests, Playwright: group scenario, axe on the group thread and members dialog. | ✅ 2026-10-16 |

## 4.10 v2.2 – email (2026-10-16, branch `feat/v2.2-email-verification`, ADR 0010)

| Slice | Content | Status |
|---|---|---|
| 9 | Email verification (hard gate) and password reset. API: `EmailModule` (`MAILER` token: `SmtpMailer` over nodemailer + `SMTP_URL`, `OutboxMailer` writing JSON files for dev/tests), `EmailService` + plain templates, `email_tokens` (hashed, single-use, kinds `verify_email` 24 h / `password_reset` 1 h) via `EmailTokensService`, `users.email_verified_at` (migration backfills existing accounts), `ev` claim in the access token, `AuthGuard` 403 for unverified sessions except `@AllowUnverified()` routes, socket handshake refuses them; routes `POST /auth/verify-email` (signs in), `POST /auth/verify-email/resend` (3/h), `POST /auth/forgot-password` (always 204, credential throttlers, mail not awaited), `POST /auth/reset-password` (signs in, verifies, revokes every session); production requires `smtp` + `SMTP_URL` + `EMAIL_FROM` + `WEB_URL`. Web: `/verify-email` waiting room + link consumer, `/forgot-password`, `/reset-password` (new password twice), "Forgot your password?" on sign-in, guards hold unverified sessions on the waiting room. Tests: 7 integration (`auth-email.int-spec.ts`), guard/env units, 12 web tests, Playwright register → outbox link → in, forgot → reset → in; axe on the three pages. Runbook §2.6: Resend + DNS for `social.bodrie.dev`. | ✅ 2026-10-16 |

## 4.11 What comes next

See `docs/ROADMAP.md` (written 2026-10-16): go-live items, product features and polish, with the agreed order for the next slices.

## 4.12 Roadmap slices (directly on `dev`, one commit each)

| # | Content | Status |
|---|---|---|
| B1 | Mentions, hashtags and links (ADR 0013): shared parser `packages/shared/src/text.ts` (`tokenize`, `extractEntities`, `hashtagSchema`); migration `text_entities` (`post_mentions`, `comment_mentions`, `post_hashtags` carrying the post's `created_at`); posts and comments resolve mentions at save and edit (rows replaced as a whole, `user.mentioned` emitted only for members new to the text, never for the author), answer `mentions: UserSummary[]` and posts `hashtags`; `GET /tags/:tag/posts` (folded, leading `#` tolerated) and `GET /tags/trending` (7-day window) in `tags/`. Web: `RichText` (post cards, comments, chat bubbles with links only), `MentionTextarea` with the `@` autocomplete (composer, comment box, `InlineEditor`; ARIA combobox pattern), `/tags/:tag` page on `PostList`, `TrendingCard` in the right bar. Seed: four tagged posts with mentions between alice, bob and carol. 13 shared + 3 unit + 10 integration + 13 web tests, Playwright `tags.spec.ts`, `/tags/weekend` in the a11y audit. Bundle budget raised from 240 to 245 kB gz: the feed's first paint now carries the entity parser, `RichText` and the autocomplete (241.0 kB measured). | ✅ 2026-10-19 |
| B2 | Post pages and search (ADR 0014): `/p/:postId` (comments open, `?sort=` in the URL, `?comment=` rings a comment and fetches it alone through the new `GET /comments/:id` when it is past the loaded pages, "This post is gone" for deleted or unknown ids), the card's timestamp is the permalink everywhere, "Copy link" in every post's menu (edit and delete stay the author's), activity excerpts link to the post or the comment. The page's cache entry is a one-item list under the posts lists prefix so every cache helper reaches it. Search: migration `post_search` (stored generated `posts.search_vector = to_tsvector('simple', content)` + GIN index; the schema carries Prisma's introspected `dbgenerated` default so the drift check stays quiet), `GET /search/posts?q=&cursor=` (`websearch_to_tsquery`, newest first, ids from raw SQL then the normal `postSelect`), `/search?q=&type=posts|people` with tabs, a search box in the header and the navigation sheet (`<search>` landmark), `#tag` queries go to the tag page. 8 integration + 10 web tests, Playwright `search.spec.ts`, `/search` and `/p/:id` in the a11y audit. | ✅ 2026-10-19 |
| A2 | Account deletion and data export (ADR 0012): `AccountModule` (`users/me`): `DELETE /users/me { password }` (argon2 check, field error, 5/min, `@AllowUnverified`) deletes the user in one transaction with the direct threads and last-member groups, decrements `reactions_count` on others' comments, recomputes `last_message_at` of groups that stay, then cuts sockets (`sessions.revoked`), tells remaining members (`conversation.left`) and the other side of direct threads (new `conversation.deleted` → `conversation:removed`), deletes the files (`UploadsService.deleteFiles`), clears the cookies and mails a last notice; `GET /users/me/export` (2/min, `Content-Disposition` attachment) answers `accountExportSchema`. Web: Settings → **Your account** card (download via Blob + anchor from the parsed response, delete dialog with password and field error, `endSession` on success; `api.delete` may carry a body), privacy notice updated (`LEGAL_UPDATED_ON` 19 Oct). 5 integration + 3 web tests, Playwright `account.spec.ts` (register → export download → wrong password → delete → sign-in refused → mail), the delete dialog in the a11y audit; `registerAndConfirm` moved to `e2e/helpers.ts`. | ✅ 2026-10-19 |
| A3 | Bot check on registration (ADR 0012): `captcha/` module with the `CAPTCHA` token (`TurnstileVerifier` → Cloudflare `siteverify` with token + client address, 2 s timeout; `NoopVerifier` without `TURNSTILE_SECRET`), `registerSchema.captchaToken`, `AuthService.register` checks first (field error `captchaToken` when refused, 503 `CAPTCHA_UNAVAILABLE` when the check cannot be made), production refuses to start without the secret unless `CAPTCHA=off`; `createTestApp({ overrides })` swaps providers in integration tests. Web: `Turnstile` component (explicit rendering, theme-aware, reset after a refusal) shown only when `VITE_TURNSTILE_SITE_KEY` is built in, the button waits for the token; `docker.yml` now passes the site key and the legal-page variables as build arguments (review L22). Runbook §2.7, compose + env examples. 3 unit + 4 integration + 4 web tests; e2e unchanged (no key in CI). | ✅ 2026-10-19 |
| A4 | Review pass completed (`docs/REVIEW_2026-10-19.md`): four read-only sweeps (accessibility beyond axe, shared-contract drift, ops/docs drift, test coverage) with their findings fixed: a quiet message log with one announcement per new message, scrolling dialogs, focus that follows navigation out of overlays and returns after editors and dialogs, focused server field errors, a thresholded `CharacterCounter`, heading card titles (`CardTitle asChild`), named picture buttons, dated permalinks; the pinned permalinked comment now follows cache changes, the group member cap and query length bounds are enforced on the client, socket pushes are validated against the shared schemas (fake socket too), MSW mirrors three more API refusals, `ZodSerializerInterceptor` and dead exports removed; **compose's empty optional variables no longer fail the production boot** (A3 regression), placeholder Turnstile secret refused, docs/README/CLAUDE.md corrected, unused CI artifact dropped. Low items L5, L6, L7, L8, L11, L13, L14, L15, L16, L18, L23, L24 fixed (see the review). New tests: error paths, group lifecycle pushes, revisions paging, session error state, deliberate sign-out, failed sign-out-everywhere, widget load failure, throttled export, arrow keys, two axe audits. | ✅ 2026-10-19 |
| B3a | Chat bubbles (ADR 0009 amendment): `features/chat/bubbles/` (pure reducer `bubbles-state.ts`, `ChatBubbles` in the shell subscribing to pushes, a lazy `BubbleDock` with `ChatBubble` and `ChatWindow`); desktop: a column of up to four bubbles at the right edge and up to two 320×440 windows docked beside it; phone (below `md`): a row under the header and one full-width panel; opening reads, a message into an open window reads on arrival, minimise keeps the bubble, X hides until the next message, `/messages/*` clears the layer, own messages never raise one; the window is a non-modal `<dialog>` reusing `Thread` (new `embedded` variant) and the composer. `ChatProvider` now counts several on-screen threads (`activateConversation`) and exposes `subscribeToMessages`; `conversation:read` reaches the reader's own tabs (L9). Preferences: migration `user_settings` (`users.settings` JSONB), shared `userSettingsSchema`/`updateSettingsSchema`, `PATCH /users/me/settings`, `settings` on `UserPrivate`; Settings → **Chat** card with a switch (`components/ui/switch.tsx`, `useUpdateSettings`); `lib/use-media-query.ts`. Tests: 6 reducer + 7 layer + 1 settings web tests, 3 integration (settings route, own-tab read push), Playwright: bubble → window → reply → "Seen" with an axe audit of the open state (`chat.spec.ts`), the phone row and panel (`mobile.spec.ts`). | ✅ 2026-10-19 |
| R1 | Legal pages: `/privacy` and `/terms` (`features/legal/`, one lazy chunk, `LegalLayout` with a switcher and a dated header). Operator name, contact email and repository come from build-time `VITE_OPERATOR_NAME` / `VITE_CONTACT_EMAIL` / `VITE_REPOSITORY_URL` (Dockerfile args; defaults keep the text valid without them; no contact email → the repository's issue tracker). Linked from the auth pages, a consent line on the register form, Settings → About, the account menu and a new right-bar footer. 4 web tests, axe on both pages. | ✅ 2026-10-16 |

## 4.13 Pre-release review fixes (2026-10-16, on `dev`, ADR 0011)

Fixes for every High and Medium item of `docs/PRE_RELEASE_REVIEW_2026-10-16.md`; the Low items stay open.

| ID | Fix | Status |
|---|---|---|
| H1 | Ending a session (password change or reset, sign out everywhere, theft response) deletes refresh-token rows; `revokedAt` only marks rotation, so an old cookie can no longer trigger `revokeAll` | ✅ |
| H2 | Chat socket: an `Unauthorized` refusal refreshes the cookie and reconnects; a refresh that throws is retried with back-off | ✅ |
| H3 | After any socket gap the provider resyncs: list and details refetch, loaded threads are merged with their newest page (local bubbles kept) | ✅ |
| H4 | `handleConnection` never rejects (logs and closes the transport); process-level `unhandledRejection` logger in `main.ts` | ✅ |
| H5 | Caddy: `no-cache` on every SPA response, `/assets/*` immutable only when the file exists, missing assets are uncached 404s; web reloads once on a stale chunk | ✅ |
| M1 | Email address read-only (dropped from the profile patch and dialog) until a confirm-the-new-address flow exists | ✅ |
| M2 | `verify-email` signs in only a browser that already holds that account's session; password change/reset notice mail | ✅ |
| M3 | Per-account mail limits (reset: 1/min, 5/h; confirmation: 5/h); reset links are not voided by newer ones, all are voided on use | ✅ |
| M4 | Likes, follows and reactions roll back only their own item; interrupted fetches resume (`lib/optimistic.ts`) | ✅ |
| M5 | `me` refetches when a tab becomes visible and on another tab's sign-in/out (`BroadcastChannel`); an account switch drops the cache and remounts the protected tree; the waiting room notices a confirmation made elsewhere | ✅ |
| M6 | `pg_dump --clean --if-exists`; restore drill drops and recreates the database and stops on the first error | ✅ |
| M7 | `docker.yml` is called by CI after checks, integration and e2e passed | ✅ |
| M8 | json-file log rotation on every compose service | ✅ |
| M9 | Handshakes limited per user; presence broadcasts coalesced (≤ 1/s) | ✅ |
| M10 | The chat composer hands the picture preview to the optimistic bubble, which revokes it once confirmed | ✅ |

## 4.9 Full review pass (2026-10-16, branch `review/v2.1-full-review`)

Seven review agents (web security, web state, web UI/a11y, API security, API data layer, tests, shared/ops) were started against the whole repository; the session limit cut them off before any of them wrote a report, so this pass is the lead's own, narrower read of the auth, upload, socket, cache and conversations code plus the two leads the agents had surfaced. Fixed here:

- **Duplicate direct conversations** – `PUT /conversations/direct/:userId` with an upper-case uuid built a different `direct_key` than the lower-case form, so one pair could end up with two threads. The shared `uuidSchema` now lower-cases every client-supplied id (params, bodies, socket payloads) and the conversation inputs use it.
- **CSRF / login CSRF** – cookies are `SameSite=Lax`, but a cross-site top-level form POST to `/auth/login` still sets cookies (login CSRF) and Nest parses urlencoded bodies by default. `common/origin-check.ts` now refuses state-changing requests and socket handshakes whose `Origin` is neither in `WEB_ORIGINS` nor the API's own host. Backlog item closed.
- **Skeletons stuck after an optimistic update** – `cancelQueries` before likes/follows/reactions reverts in-flight fetches; a query that had no data yet (a profile still loading when Follow is clicked in the sidebar) stayed pending and idle. `resumePendingQueries` refetches those once the mutation settles.
- Tests: unit tests for the origin check, the cache helpers and the conversation display helpers; integration tests for the origin check over HTTP and the socket handshake and for the upper-case direct id.

Verified on this read and left as is: website links are http(s)-only at the schema, no HTML injection paths, `passwordHash` never leaves the auth module, public routes are the four auth routes and the upload file route, refresh rotation with reuse detection, argon2 timing equalisation, per-member read marks, membership checks on every conversation route. Everything the agents had not reached (a11y sweep, shared-contract drift, ops) remains open for a later pass.

## 5. Parity checklist (gate for deleting the old code)

- [x] Register, login, logout, session survives refresh (`/auth/me`), expiry handled — auth int tests (rotation, reuse detection, throttles); web: `RequireAuth`, silent refresh, socket reconnect; e2e `auth.spec.ts`
- [x] Feed of own + followed posts, infinite scroll, newest first — posts int tests; e2e `feed.spec.ts`
- [x] Create post with text, image, emoji; preview; validation — `PostComposer`; e2e `feed.spec.ts`, `uploads.spec.ts`
- [x] Like / unlike with correct counts for all users (B1) — `likes` table with unique (user, post); int tests; optimistic UI with rollback
- [x] Comments list/add per post, counts correct, scoped per post (B4) — query keys per post; comments int tests; e2e
- [x] Delete own post / comment (new) — author-only delete (post author may moderate comments); int tests; e2e `social.spec.ts`
- [x] Profile view (avatar, cover, name, username, city, website/bio), own posts — `/u/:username`; e2e `profile.spec.ts`
- [x] Follow / unfollow, followers/following lists, suggestions update — follows int tests; `useToggleFollow` keeps every list in step; e2e
- [x] Edit profile incl. avatar/cover upload, no page reload, pictures survive host change (B10) — storage keys in the database, URLs built from `PUBLIC_ASSETS_URL` per response; uploads ownership table; e2e edits with avatar
- [x] Users list + search — `GET /users?q=`; e2e `people.spec.ts`
- [x] Activities of followed users, generated server-side — `ActivitiesListener` on domain events; `/activity` page + sidebar
- [x] Presence (one entry per user) + DM chat, history (D8: persisted) — gateway int tests (presence dedup, rate limits, revocation); e2e `chat.spec.ts` in two browsers
- [x] Light/dark theme, persisted; responsive layout incl. mobile header menu — next-themes; e2e smoke + `mobile.spec.ts`
- [x] S1–S9 covered by integration tests — S1 (`PATCH /users/me` only), S2 (no hash in any user shape; responses parsed with the shared schemas), S3 (`404s on unknown files and refuses path tricks`), S4 (auth, size and MIME tests, re-encoded to WebP), S5 (ids from the session only), S6 (15-min access token, single-use refresh, SameSite cookies), S7 (handshake from the cookie/JWT, forged tokens refused), S8 (one error envelope, raw errors masked), S9 (throttling + helmet tests). S10 is the owner's: retire or key-only the old box.
- [x] Error envelope mapped to form fields on login/register/profile — `applyApiErrors`; e2e `auth.spec.ts` (taken username)
- [x] CI: lint, typecheck, unit, integration, build, e2e green — `checks`, `integration`, `e2e` jobs
- [x] Docker images build and run via compose — phase 6, verified locally (`deploy/docker-compose.yml`)

---

## 6. Decisions

**Decision log**

- 2026-10-15: D1–D11 and D13–D20 accepted as recommended. D12 answered: self-hosted on one Ubuntu Server 24.04 box (proxy, web, api, DB) without a static IP → design in §2.11. D13 amended to Jest + `@swc/jest` (ts-jest cannot run on TS 7). D19 amended to TypeScript 7 (§2.12).
- 2026-10-15 (later the same day): Cloudflare Tunnel confirmed for §2.11. D14 confirmed sequential. D19 **changed to TypeScript 6 now, 7 later** (§2.12). D21 pnpm, D22 Turborepo, D23 ESLint + typescript-eslint confirmed. No open decisions.
- 2026-10-15 (phase 2): Prisma **7.10.0** (8.0 is still an RC). Prisma 7 specifics now in use: `prisma.config.ts` (loads `.env` via dotenv, holds the datasource URL and the seed command), the `prisma-client` generator emitting TypeScript into `apps/api/src/generated` (gitignored, produced by the turbo `db:generate` task), driver adapter `@prisma/adapter-pg`, seeding only on explicit `pnpm db:seed` (destructive, deterministic). Schema drift is checked in CI with `prisma migrate diff --from-config-datasource --to-schema … --exit-code` after `migrate deploy`. pnpm 11 needs `allowBuilds` for prisma/argon2/esbuild postinstalls.
- 2026-10-15 (phase 1): the Nest 12 CLI and create-vite 8 both scaffold **Vitest + oxlint** and Nest 12 projects are **ESM**. Adopted (ADR 0005, ADR 0008); D13 and D23 amended accordingly. Local Postgres is published on host port **5433** because 5432 belongs to another project on the dev machine.

| # | Decision | Recommendation / default | Other options |
|---|---|---|---|
| D1 | Migrate existing MySQL data and images? | **No**, fresh Postgres + seed | One-off ETL script |
| D2 | ORM | **Prisma** | Drizzle |
| D3 | UI approach | **Tailwind 4 + shadcn/ui + lucide** | CSS modules + CSS vars; Mantine; keep MUI |
| D4 | Router | **React Router 7** | TanStack Router |
| D5 | Auth model | **JWT access + rotating refresh, httpOnly cookies, argon2id** | DB sessions |
| D6 | Email verification / password reset in v2.0? | **No** (backlog; needs mail provider) | Yes, with Mailpit locally + provider later |
| D7 | Validation library | **zod shared + nestjs-zod** | class-validator |
| D8 | Chat persistence | **Persist messages, history endpoint, one presence entry per user** | Keep ephemeral |
| D9 | Placeholder features (stories, tag people, share, social links, left-bar items) | **Remove**; add `bio` + `website` fields | Implement some (say which) |
| D10 | New in v2.0 | **Yes:** delete post/comment, user search, followers/following lists, infinite scroll. **No:** edit post, notifications, comment likes, account deletion (backlog) | adjust |
| D11 | Upload storage | **Local volume behind `StorageService`** | S3/R2 from day one |
| D12 | Hosting | **Self-hosted, single Ubuntu 24.04 box, Docker Compose, Cloudflare Tunnel, pull-based releases** (§2.11) | DDNS + port forwarding if you would rather not use Cloudflare |
| D13 | API test runner | **Vitest** (Nest 12 CLI default; ADR 0005 supersedes the earlier Jest choice) | Jest + `@swc/jest` |
| D14 | Sequential (API then web) vs interleaved slices | **Sequential** for one developer | Interleave after 3b using MSW |
| D15 | Playwright location | **`apps/web/e2e`** | top-level `e2e/` workspace |
| D16 | Branching | **PRs to `main`, `rebuild/*` feature branches** | long-lived `v2` branch |
| D17 | Cookie banner | **Drop; short privacy note in footer/login** | Keep |
| D18 | Profile URL | **`/u/:username`** | `/profile/:id` |
| D19 | Versions | **Node 24, PostgreSQL 17, TypeScript 6.0 (7 later, §2.12), latest Nest/Prisma/Vite/React 19 at phase start, pinned exactly** | TS 7 now via alias |
| D20 | Pre-commit hooks | **lint-staged (eslint + prettier) only** | add commitlint |
| D21 | Package manager | **pnpm** (§2.13) | Bun as installer/runner with Node as runtime |
| D22 | Task runner | **Turborepo** (§2.13) | plain pnpm scripts, no caching |
| D23 | Linting | **oxlint (type-aware) + Prettier** (ADR 0008 supersedes the earlier ESLint choice) | ESLint + typescript-eslint |

---

## 7. Cleanup list (phase 7)

- [x] Delete `api/`, `client/`, `deploy_dev.sh`, `deploy_prod.sh` (2026-10-15)
- [x] Delete branches `test`, `update/readme`, `nest-migration` (done by the owner in phase 1)
- [x] `.DS_Store`: covered by `.gitignore`; history left alone
- [x] Rewrite `README.md`; `docs/adr/*`, `docs/BACKLOG.md`, `CLAUDE.md` current
- [ ] Tag `v2.0.0` on `main` after merging the cutover PR (`git tag v2.0.0 && git push origin v2.0.0`); `docker.yml` then publishes the versioned images
- [ ] Owner: the old production box (S10) — retire it or make sure it only accepts key authentication; GHCR packages set to public
