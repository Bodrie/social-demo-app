# Backlog (deliberately deferred)

Real but deferred work, grouped by area. Each line says where it came from and what would trigger it. The owner's v2.1 requests live in the plan (§4.8), not here.

## Security / robustness
- **Unauthenticated socket handshakes** – handshakes are limited per user and presence broadcasts are coalesced (ADR 0011), but a handshake without a valid token is only refused after a JWT check, with no per-address limit (engine.io answers before the HTTP throttler). A Cloudflare rate-limiting rule on `/socket.io/*` if such floods show up.
- **Decode concurrency for uploads** – `UPLOAD_MAX_PIXELS` is 25 MP; add a small semaphore (or `sharp.concurrency(1)`) if memory spikes are observed.

## Contract / docs
- **Email follow-ups** – an admin view of unverified accounts; a revert link in the "address changed" notice (today the old address is only told). (Changing the address and the sessions list shipped as D1 on 2026-10-20, ADR 0010 amendment; accounts never verified are removed after 30 days since C6.)
- **Pre-D2 picture fields** – posts, quote embeds and messages still answer `imageUrl` next to `images`/`image`, and `POST /posts` still takes a single `imageKey`, so tabs opened before the D2 deploy keep working. Drop both (shared schemas, `toPost`, `toMessage`, `PostsService.create`, one int test) with the next change to the post shape, or a release after D2.
- **`message:new` for an unknown conversation** – a push for a conversation the client has never listed triggers a refetch of the list (`upsertConversation`); push the conversation itself if that round trip shows up.

## Operations
- **Shutdown** – `enableShutdownHooks({ useProcessExit: true })` so pino flushes on SIGTERM.
- **Access log volume** – 5xx are logged by both the filter (with stack) and pino-http; drop one if logs get noisy.

## Web

- Newcomer experience (was C1 of `IMPLEMENTATION_PLAN.md`, removed by the owner on 2026-10-20): an `/explore` feed of everyone's posts (`GET /posts?scope=all`, same `postSelect`; a "Popular" tab later), an empty-feed state pointing to People, and a one-time "Follow a few people" step after verification (flagged in `localStorage`). Trigger: real visitors arriving to an empty feed.
- Posts: the legacy double-tap-to-like gesture on touch devices; link previews (SSRF-safe fetching, a cache and a queue, left out of D2 on purpose); alt text written by the author for each picture (today every picture says who posted it and its position). (Several pictures per post and the lightbox shipped as D2 on 2026-10-21.)
- Lightbox (D2): pinch to zoom (the stage takes the touch for swiping today), the phone's Back button closing it (needs a history entry per open viewer), paging through all the pictures of a chat thread rather than one.
- Search (ADR 0014): results are newest first; relevance ranking (`ts_rank` with a ranked cursor), highlighting of matched words and a stemmed per-language column are the upgrades when the volume asks for them. People search stays `ILIKE`.
- Tags (ADR 0013): `GET /tags/trending` is a live `GROUP BY` over the indexed 7-day window with no cache; add a 60 s in-memory cache if it shows up in the query log. Hashtags in comments were left out on purpose. (`#` autocomplete is B6 in the plan since 2026-10-20.)
- Chat: voice notes; a long-press reaction gesture on phones (the picker button is always visible there since C5). (Editing, reactions, the missing system lines and the sound rule shipped as C5 on 2026-10-20; notifications with the tab closed are E2.)
- Performance (Lighthouse mobile: feed 64, profile 74): `zod/mini` build of the shared schemas for the browser (≈ 25 kB gz of the first paint), `srcset` for post images (the sizes are stored since D2, which already set `width`/`height`; LCP), `fetchpriority="high"` on the first feed image, `<link rel=preload>` for the Latin Inter subset, prefetching route chunks on link hover.
- API logging: aborted client connections surface as raw `Error: read ECONNRESET` / `write EPIPE` lines on stderr (seen while Playwright closes contexts); route them through pino at debug level or ignore them.
- E2E: a Firefox/WebKit project once the suite is stable in CI; visual snapshots for the main pages.
- Images: multi-arch (`linux/arm64`) builds if the box is ever ARM. (The one-shot `migrate` image shipped with E4 on 2026-10-22, ADR 0018.) The migrate image is 719 MB because the Prisma 7 CLI hard-depends on Studio, effect and pglite; nothing to trim without patching the CLI.
- Ops: off-box backup copies (rclone), an uptime check on `https://social.bodrie.dev` (a Cloudflare health check or any external monitor hitting `/api/v1/auth/me` for a 401), Cloudflare Bot Fight Mode once the socket.io polling fallback is confirmed unaffected. An origin certificate for Caddy only matters if the tunnel is ever replaced by a direct origin.
