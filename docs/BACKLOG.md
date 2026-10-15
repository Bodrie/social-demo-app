# Backlog (deliberately deferred)

Items the API review (2026-10-15) surfaced that are real but not needed for v2.0. Each line says where it came from and what would trigger it.

## Security / robustness
- **Orphaned uploads reaper** – uploads that are never attached stay on disk. A daily job deleting `uploads` rows (and files) with no reference older than 24 h; needs a scheduler (`@nestjs/schedule`). Trigger: disk usage, or before opening the app publicly.
- **Password change and reset, email change confirmation** – out of scope by D6 (no mail provider). `POST /auth/password` (verify current, re-hash, revoke all sessions) is cheap and should come with the first mail integration.
- **CSRF defence in depth** – today: `SameSite=Lax` cookies, no state-changing GETs, CORS allow-list. Add an `Origin`/`Sec-Fetch-Site` check on cookie-authenticated non-GET requests when the web app goes public.
- **Refresh-token races across tabs** – rotation is strict (replay = theft). The web client must single-flight refreshes (mutex + `BroadcastChannel` across tabs); documented for phase 4a.
- **Socket connection churn** – presence broadcasts are per transition; a per-user connect rate limit and a debounce would harden against reconnect storms.
- **Decode concurrency for uploads** – `UPLOAD_MAX_PIXELS` is 25 MP; add a small semaphore (or `sharp.concurrency(1)`) if memory spikes are observed.

## Contract / docs
- **`@ZodResponse` on every handler** – gives runtime output validation and real response schemas in `/api/docs/openapi.json` (today: inputs, auth and operation ids only). Do it when a typed client from the document is wanted; the web uses the shared zod schemas directly.
- **Conversations pagination** – `GET /messages` is capped at 100 and already uses the list envelope, so adding a cursor is non-breaking.
- **Activity post excerpts without author** – "alice liked bob's post" needs `post.author`; add `author: UserSummary` to the post excerpt when the web needs it.
- **`message:new` without sender summary** – a push from a new peer needs a follow-up `GET /users/:id`; include a `sender` summary if that round trip shows up.

## Code structure
- **TokensModule** (JwtModule + a small access-token service) so `ChatModule` and the global guard stop importing `AuthModule` wholesale.
- **Rename `HttpExceptionFilter`** → `ApiExceptionFilter` (it handles Prisma, ws and health too).
- **Event names** – `user.profileUpdated` vs `post.liked` casing; harmonise when touching events next.

## Operations (phase 6 inputs)
- **Caddy must own the client IP**: `reverse_proxy api:3000 { header_up X-Forwarded-For {header.CF-Connecting-IP} }` and `TRUST_PROXY=1` in the api; add an integration test for `req.ip` once the proxy config exists.
- **HSTS owner** – decide between Cloudflare/Caddy and the API (`helmet.hsts`); do not send `includeSubDomains` from two places.
- **Prisma CLI in the runtime image** – `prisma`, `dotenv` are devDependencies; run `migrate deploy` from a non-pruned stage or a one-shot `migrate` compose service. `prisma generate` needs a placeholder `DATABASE_URL` at build time.
- **Shutdown** – `enableShutdownHooks({ useProcessExit: true })` so pino flushes; `stop_grace_period: 20s` in compose.
- **Access log volume** – 5xx are logged by both the filter (with stack) and pino-http; drop one if logs get noisy.
- **Caddy `file_server` for `/api/v1/uploads/*`** from the shared volume (ETag/Content-Length, no Node in the path).
- **Health failures** expose the driver error message in the 503 body; keep `/health` off the public route in Caddy.

## Web (phase 4 inputs)

- Bundle: the shell + auth alone ship ~215 kB gzipped (react-dom, radix, zod 4, react-hook-form, TanStack Query). Route-level code splitting is planned for 4g; if it still matters, build the shared schemas with `zod/mini` for the web and keep classic zod for the API.
- The `Card` from shadcn has no `size` prop in this CLI version; placeholder pages render their own `<h1>` inside `CardHeader` so pages keep a real heading.
- `apps/web/e2e` is a smoke suite only; the per-feature specs from plan §2.8 arrive with each 4x slice, and `storageState`-based sign-in once more than one spec needs a session.
- Posts: linkify URLs/@mentions in post text, an image lightbox, a post permalink route (`/p/:id`) for notifications and sharing, and the legacy double-tap-to-like gesture on touch devices.
- Emoji picker: move to `emoji-picker-react` 5.x once it has a few weeks of releases behind it (5.0.0 landed 2026-10-10).
- Profile: a "Message" button once chat lands (4f), cover/avatar cropping, and blocking/reporting (not in the legacy app either).
