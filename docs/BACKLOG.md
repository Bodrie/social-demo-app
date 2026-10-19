# Backlog (deliberately deferred)

Real but deferred work, grouped by area. Each line says where it came from and what would trigger it. The owner's v2.1 requests live in the plan (§4.8), not here.

## Security / robustness
- **Orphaned uploads reaper** – uploads that are never attached stay on disk. A daily job deleting `uploads` rows (and files) with no reference older than 24 h; needs a scheduler (`@nestjs/schedule`). Trigger: disk usage, or before opening the app publicly.
- **Unauthenticated socket handshakes** – handshakes are limited per user and presence broadcasts are coalesced (ADR 0011), but a handshake without a valid token is only refused after a JWT check, with no per-address limit (engine.io answers before the HTTP throttler). A Cloudflare rate-limiting rule on `/socket.io/*` if such floods show up.
- **Decode concurrency for uploads** – `UPLOAD_MAX_PIXELS` is 25 MP; add a small semaphore (or `sharp.concurrency(1)`) if memory spikes are observed.

## Contract / docs
- **`@ZodResponse` on every handler** – gives runtime output validation and real response schemas in `/api/docs/openapi.json` (today: inputs, auth and operation ids only). Do it when a typed client from the document is wanted; the web uses the shared zod schemas directly.
- **Email follow-ups** – change the email address (new address must be confirmed before it replaces the old one; until then the address is read-only, ADR 0011), re-send from Settings, an admin view of unverified accounts, a reaper for accounts never verified after N days.
- **Conversations pagination** – `GET /conversations` is capped at 100 and already uses the list envelope; a keyset on `last_message_at` adds a cursor without a schema change.
- **Activity post excerpts without author** – "alice liked bob's post" needs `post.author`; add `author: UserSummary` to the post excerpt when the web needs it.
- **`message:new` for an unknown conversation** – a push for a conversation the client has never listed triggers a refetch of the list (`upsertConversation`); push the conversation itself if that round trip shows up.

## Code structure
- **TokensModule** (JwtModule + a small access-token service) so `ChatModule` and the global guard stop importing `AuthModule` wholesale.
- **Rename `HttpExceptionFilter`** → `ApiExceptionFilter` (it handles Prisma, ws and health too).
- **Event names** – `user.profileUpdated` vs `post.liked` casing; harmonise when touching events next.

## Operations
- **Client IP behind the proxy** – Caddy rewrites `X-Forwarded-For` from `CF-Connecting-IP` and the API trusts one hop; add an integration test for `req.ip` with that header chain.
- **Shutdown** – `enableShutdownHooks({ useProcessExit: true })` so pino flushes on SIGTERM.
- **Access log volume** – 5xx are logged by both the filter (with stack) and pino-http; drop one if logs get noisy.

## Web

- Posts: an image lightbox and the legacy double-tap-to-like gesture on touch devices.
- Search (ADR 0014): results are newest first; relevance ranking (`ts_rank` with a ranked cursor), highlighting of matched words and a stemmed per-language column are the upgrades when the volume asks for them. People search stays `ILIKE`.
- Tags (ADR 0013): `GET /tags/trending` is a live `GROUP BY` over the indexed 7-day window with no cache; add a 60 s in-memory cache if it shows up in the query log. `#` autocomplete in the composer and hashtags in comments were left out on purpose.
- Emoji picker: move to `emoji-picker-react` 5.x once it has a few weeks of releases behind it (5.0.0 landed 2026-10-10).
- Profile: cover/avatar cropping, and blocking/reporting (not in the legacy app either).
- Activity: realtime updates for the sidebar card (a push over the chat socket, or light polling). Excerpts link to the post since B2.
- Chat: message deletion needs API support; group admin roles, renaming a group and removing others (ADR 0009 kept membership changes to add and leave); browser notifications and a sound for new messages; a "new messages" pill when the reader has scrolled up; per-tab unread title badge.
- Performance (Lighthouse mobile: feed 64, profile 74): `zod/mini` build of the shared schemas for the browser (≈ 25 kB gz of the first paint), width/height and `srcset` for post images from the upload metadata (CLS, LCP), `fetchpriority="high"` on the first feed image, `<link rel=preload>` for the Latin Inter subset, prefetching route chunks on link hover.
- API logging: aborted client connections surface as raw `Error: read ECONNRESET` / `write EPIPE` lines on stderr (seen while Playwright closes contexts); route them through pino at debug level or ignore them.
- E2E: a Firefox/WebKit project once the suite is stable in CI; visual snapshots for the main pages.
- Images: move `prisma migrate deploy` into a one-shot `migrate` image/service so the API runtime image no longer carries the Prisma CLI's dependencies (≈ 960 MB → ≈ 450 MB); multi-arch (`linux/arm64`) builds if the box is ever ARM.
- Ops: off-box backup copies (rclone), an uptime check on `https://social.bodrie.dev` (a Cloudflare health check or any external monitor hitting `/api/v1/auth/me` for a 401), Cloudflare Bot Fight Mode once the socket.io polling fallback is confirmed unaffected. An origin certificate for Caddy only matters if the tunnel is ever replaced by a direct origin.
