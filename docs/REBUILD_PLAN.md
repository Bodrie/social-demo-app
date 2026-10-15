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
| **4. Web** | 4a shell ✅ 2026-10-15: Tailwind 4 + shadcn (new-york, lucide) theme ported from the legacy palette (light/dark via next-themes, class strategy), AppShell (header with sheet nav on small screens, left nav, right bar, responsive 3-column grid), `Providers` (QueryClient created once, theme, tooltips, sonner toasts, session-loss listener), React Router 8 data router with `RequireAuth` (provides `CurrentUserContext`) / `RedirectIfAuthenticated` layout routes and a route error element, typed fetch client (`lib/api/client.ts`: zod-parsed responses, `ApiClientError` envelope, 401 → single-flight refresh guarded by the Web Locks API → retry once → `onSessionLost`), `useMe()` + `startSession`/`endSession` cache helpers, Vitest + RTL + MSW 3 harness (`src/test/`), 21 tests; Playwright 1.64 harness (`playwright.config.ts` boots the built API + `vite preview` with the same proxy as dev) with a 4-test smoke spec and an `e2e` CI job (seeded Postgres, Chromium). 4b auth pages ✅ 2026-10-15: login/register with react-hook-form + `zodResolver` on the shared schemas, API field errors mapped onto inputs (`applyApiErrors`), the guard routes do the post-login navigation (back to the page that required auth). 4c feed ✅ 2026-10-15: design pass (oklch tokens, Inter Variable, 1rem card radius, blurred header, feed column capped at 42rem), `role="feed"` with `useInfiniteQuery` + IntersectionObserver sentinel, composer (auto-growing textarea, image attach with immediate upload + preview/retry/remove, lazy-loaded emoji picker, counter near the 500-char limit), post card (relative time, image, like with optimistic update + rollback, comments toggle, author-only delete behind an alert dialog), inline comments (newest first, Enter to send, delete by comment or post author, older pages on demand), cache helpers that keep every post list in step; MSW backend for posts/comments/uploads, 21 new Vitest tests (42 total), Playwright feed spec (publish with image → like → comment → delete, infinite scroll). 4d profile ✅ 2026-10-15: `/u/:username` with nested tab routes (posts, `/followers`, `/following`), header (cover or gradient, overlapping avatar, bio, city, website, joined, counts linking to the lists, "Follows you" badge), optimistic follow/unfollow that updates every cached profile and list plus the viewer's counts and refreshes the feed, reusable `PostList`/`UserList` (infinite scroll), edit-profile dialog (RHF + `updateProfileSchema`, diff-only PATCH via `buildProfilePatch`, avatar and cover `ImageField`s with immediate upload/remove, server conflicts mapped to fields, navigation on username change), 404 and error states; MSW users backend with follows, 14 new tests (56 total), Playwright profile spec (follow toggle, followers list, edit with avatar upload). 4e users list + search, suggestions, activities. 4f chat: presence, DM windows, history. 4g polish: a11y pass, empty/loading/error states, code splitting, bundle check. | 3 (3a–3b minimum; later slices can overlap with 3d–3h if you want to interleave) | XL |
| **5. E2E** | Playwright specs per §2.8 grown alongside 4b–4f; `e2e` CI job green with seeded Postgres. | 4 | M |
| **6. Containers + release pipeline** | Dockerfiles, `docker-compose.prod.yml` with Caddy, `docker.yml` pushing to GHCR, `deploy.yml` scaffold behind a protected environment, runbook in `docs/`. Domain-specific values are env only. | 3, 4 | M |
| **7. Cutover** | §5 checklist verified; delete `api/`, `client/`, `deploy_*.sh`; README rewrite; `CLAUDE.md`; tag `v2.0.0`. | 5, 6 | S |

### 4.3 Order alternatives considered

- **Web first (CRA → Vite on the existing client):** the mechanical migration is cheap and visible, but the data layer would be rebuilt again once the API changes, and the current client does not build anyway (B2). Rejected, unless you need the old app demoable during the rewrite.
- **Interleaved API/web slices:** possible once 3a–3b exist, because MSW handlers from the shared schemas let the web proceed against a mock. Good for variety and for a second developer; for one person the sequential order has less context switching. Your call (D14).
- **Strangler (new Nest API proxying old endpoints):** overkill for ~5k lines with no live users.

### 4.4 Milestones / definition of done

| Milestone | Done when |
|---|---|
| M1 | `main` protected, `ci.yml` green on scaffolds, `pnpm dev` boots both apps against Docker Postgres. |
| M2 ✅ | `prisma migrate deploy` + drift check + seed + integration tests run in CI (`integration` job); schema ADR merged. |
| M3 ✅ 2026-10-15 | All §2.4 endpoints implemented; 74 integration tests; Swagger browsable; no `any` in services. |
| M3.5 ✅ 2026-10-15 | Web shell + auth usable end to end: sign in/out, protected routes, theme; Vitest and Playwright harnesses green in CI (`checks`, `integration`, `e2e`). |
| M4 | §5 parity items ticked in the web app; Vitest suite green; Lighthouse a11y ≥ 90 on home/profile. |
| M5 | Playwright suite green in CI on Chromium; chat tested with two contexts. |
| M6 | `docker compose -f docker-compose.prod.yml up` serves the app on an IP; images on GHCR. |
| M7 | Old directories removed; README/CLAUDE.md current; `v2.0.0` tagged. |

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

## 5. Parity checklist (gate for deleting the old code)

- [ ] Register, login, logout, session survives refresh (`/auth/me`), expiry handled
- [ ] Feed of own + followed posts, infinite scroll, newest first
- [ ] Create post with text, image, emoji; preview; validation
- [ ] Like / unlike with correct counts for all users (B1 regression test)
- [ ] Comments list/add per post, counts correct, scoped per post (B4 regression test)
- [ ] Delete own post / comment (new)
- [ ] Profile view (avatar, cover, name, username, city, website/bio), own posts
- [ ] Follow / unfollow, followers/following lists, suggestions update
- [ ] Edit profile incl. avatar/cover upload, no page reload, pictures survive host change (B10)
- [ ] Users list + search
- [ ] Activities of followed users, generated server-side
- [ ] Presence (one entry per user) + DM chat, history if D8
- [ ] Light/dark theme, persisted; responsive layout incl. mobile header menu
- [ ] All S1–S9 covered by integration tests (authz, no hash leak, upload limits, traversal)
- [ ] Error envelope mapped to form fields on login/register/profile
- [ ] CI: lint, typecheck, unit, integration, build, e2e green
- [ ] Docker images build and run via compose

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

- Delete `api/`, `client/`, `deploy_dev.sh`, `deploy_prod.sh`
- Delete branches `test`, `update/readme`, `nest-migration` (after harvesting)
- Remove `.DS_Store` from history? Not worth a rewrite; just ensure `.gitignore` covers it
- Rewrite `README.md` (what, stack, run, test, deploy, env), add `docs/adr/*`, `docs/BACKLOG.md`, `CLAUDE.md`
- Tag `v2.0.0`
