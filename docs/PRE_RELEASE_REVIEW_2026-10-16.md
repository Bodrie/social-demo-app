# Pre-release review – 2026-10-16

A full-repository review of The Mesh before the first public release, done on branch `dev`
at commit `f95ca77` (merge of `main`). The goal was to find critical and high defects
(security, data integrity, availability, user-visible breakage) and bad patterns, and to
report only what could be traced in the code. Every item below cites the file and line it
was traced to, states how it was verified, and says whether it is already listed as a
deliberate deferral in `BACKLOG.md` / `ROADMAP.md`.

## 1. Verdict

No critical finding (no authentication bypass, no cross-user data exposure, no injection,
no path traversal, no secret leak). The code base is in good shape: ownership checks,
membership checks, cookie/CSRF handling, token hashing, upload validation, pagination and
the error envelope all held up under scrutiny.

Five **High** findings should be fixed before the first real visitors:

| ID | Area | One line |
|---|---|---|
| H1 | auth | A password change, reset or "sign out everywhere" ends the caller's own session as soon as any other device refreshes, and an old refresh cookie can keep logging the owner out for up to 7 days |
| H2 | chat (web) | After an `Unauthorized` socket handshake (laptop sleep, API restart) the chat socket never reconnects, even though the session is refreshed |
| H3 | chat (web) | Nothing resynchronises after a socket reconnect; messages sent during a gap never appear in an open thread (and get marked as read) |
| H4 | chat (api) | A database error inside the socket `handleConnection` is an unhandled rejection and terminates the API process |
| H5 | deploy | Caddy never sends `Cache-Control: no-cache` for the SPA's HTML and answers missing assets with HTML + a one-year cache header, so returning visitors can get a blank page after every deploy |

Ten **Medium** and about twenty-five **Low** items follow, each with evidence and a fix.
Section 6 is a suggested order of work.

## 2. Scope, method, what was run

**Scope.** `apps/api` (all modules, tests, Prisma schema and migrations, seed),
`apps/web` (all features, lib, app shell, tests), `packages/shared`, `deploy/`, both
Dockerfiles, the Caddyfile, both GitHub workflows, `docs/` (ADRs, RUNBOOK, BACKLOG,
ROADMAP).

**Method.** One coordinator read the API, shared schemas, deploy stack and the web client's
core end to end, then five reviewers each took one area (auth/sessions, realtime and
conversations, data layer and content APIs, deployment/infrastructure, web client). Every
reviewer was briefed to report only what it could trace to a concrete failure path with
file and line, and every finding in this document was re-checked by the coordinator against
the code (and, where the claim depends on a library or platform, against that library's
source in `node_modules` or its documentation).

**Runs on this machine (Windows, Node 24.22, pnpm 11.1.0).**

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK (58 s) |
| `pnpm check` (lint, typecheck, unit tests, build, all workspaces) | **green**: api 84 tests / 18 files, shared 33 / 9, web 112 / 28; web initial JS 236.0 kB gz of the 240 kB budget |
| `pnpm audit --prod` | 3 advisories (2 high, 1 moderate), all transitive through the Prisma CLI, none reachable (section 4) |

**Not run (no Docker, no PostgreSQL on this machine):** `pnpm test:int` (integration
tests) and the Playwright suite. Where a finding is about behaviour those suites would
exercise, the relevant existing test is cited and it is stated what it does and does not
cover. Caddy and Cloudflare behaviour is reasoned from their documented semantics, not
observed on the box; H5 in particular should be confirmed with one `curl` on the server
(the exact commands are given with the finding).

**Severity scale.** Critical = account takeover, auth bypass, data exposure across users,
data loss. High = a defect real users will hit (availability, lost messages, broken
sessions, process crash). Medium = real but limited impact, or a design weakness with a
plausible abuse path. Low = hardening, edge cases, operational polish.

---

## 3. Findings

### High

#### H1. Revoked refresh tokens are indistinguishable from rotated ones: password change, reset and "sign out everywhere" end the caller's own session, and an old cookie can keep the owner logged out for up to 7 days

**Status:** CONFIRMED (traced by the auth reviewer and the coordinator independently).
**Area:** `apps/api/src/auth`.

Evidence:

- `apps/api/src/auth/refresh-tokens.service.ts:50-53` – `rotate` treats *any* row with
  `revokedAt !== null` as token reuse (theft) and calls `revokeAll(userId)`:
  ```ts
  if (existing.revokedAt !== null) {
    await this.revokeAll(existing.userId);
    throw unauthorized('Refresh token was already used; all sessions have been revoked');
  }
  ```
- `refresh-tokens.service.ts:81-90` – `revokeOthers` (password change) does not delete the
  other sessions' rows, it sets `revokedAt` on them, exactly like a rotation does.
- `refresh-tokens.service.ts:92-98` – `revokeAll` does the same for every row and emits
  `SessionsRevokedEvent`, which `chat.gateway.ts:261-264` turns into
  `disconnectSockets(true)` for the whole user.
- `refresh-tokens.service.ts:73-75` – single `logout` *deletes* the row; the class comment
  at lines 16-22 explains that this was done precisely so a replayed logged-out token
  "cannot be used to log the user out everywhere". The same hazard was not applied to
  `revokeOthers` / `revokeAll`.
- Revoked rows are only purged when they expire (`issueWith`, line 116:
  `deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })`), i.e. after
  `REFRESH_TTL_SECONDS` = 7 days.
- Callers: `auth.service.ts:115` (`changePassword` → `revokeOthers`), `:174-175`
  (`resetPassword` → `revokeAll`, then issues the new session), `:93-95` (`logoutAll`).
- The client presents stale tokens automatically: `apps/web/src/lib/api/client.ts:117-119`
  (any 401 → `refreshSession()`), `apps/web/src/features/chat/chat-provider.tsx:153-157`
  (socket `io server disconnect` → `reconnectWithFreshToken` → refresh), and the server cuts
  every socket when its access token expires (`chat.gateway.ts:280-288`, ≤ 15 min).

Failure scenario (password change): laptop A changes the password. Phone B still has a tab
open. Within 15 minutes B's access token expires, the server cuts B's socket, B's provider
calls `/auth/refresh` with its revoked-but-present row, `rotate` runs `revokeAll`: A's live
refresh row is revoked and A's socket is cut immediately. A's provider refreshes, gets 401,
the controller clears A's cookies (`auth.controller.ts:78-81`), `notifySessionLost` fires and
A lands on `/login`. The Settings copy ("this one stays signed in",
`apps/web/src/features/settings/settings-page.tsx:57`) and `CLAUDE.md` are false whenever
any other device is open.

Failure scenario (reset / sign out everywhere): the owner resets the password to evict an
intruder (or simply has an old phone). `revokeAll` marks the intruder's row, then
`session()` issues the owner's new one. Anyone who still holds the old refresh cookie POSTs
it to `/auth/refresh` (it only needs the cookie, no password) → `revokeAll` again → the
owner's fresh session is killed and their socket cut. This can be repeated for up to 7 days.
A stolen or leftover refresh cookie therefore becomes a persistent denial of service against
the owner, after the very actions meant to end it.

Why the tests did not catch it: `apps/api/test/auth.int-spec.ts:280-305` refreshes the
changer first (line 303) and the phone second (304); the realistic order is untested.
`apps/api/test/auth-email.int-spec.ts:169-212` replays the old session (203) but never checks
that the resetter can still refresh afterwards (it cannot).
`refresh-tokens.service.spec.ts` does not cover `revokeOthers`.

Fix: make administrative revocation delete rows (`deleteMany`) in `revokeOthers` and
`revokeAll`, and keep `revokedAt` strictly for rotation (the reuse-detection case). Add
integration tests: "change password on A, refresh on B → 401, refresh on A → 200" and the
same for reset-password and logout-all + re-login.

#### H2. After an `Unauthorized` handshake refusal the chat socket is never reconnected

**Status:** CONFIRMED (socket.io-client source checked).
**Area:** `apps/web/src/features/chat/chat-provider.tsx`.

Evidence:

- `chat-provider.tsx:39-46`:
  ```ts
  /** socket.io keeps retrying by itself; a refreshed cookie makes the next attempt succeed. */
  const onConnectError = (error: Error) => {
    if (error.message === 'Unauthorized') {
      void (async () => {
        if (!(await refreshSession())) notifySessionLost();
      })();
    }
  };
  ```
  The comment is wrong for a middleware refusal. `apps/api/src/chat/chat.gateway.ts:94-99`
  answers `next(new Error('Unauthorized'))` from `io.use`, which the client receives as a
  `CONNECT_ERROR` packet.
- `node_modules/.pnpm/socket.io-client@4.8.4/node_modules/socket.io-client/build/cjs/socket.js:522-526`:
  ```js
  case socket_io_parser_1.PacketType.CONNECT_ERROR:
      this.destroy();
      const err = new Error(packet.data.message);
      ...
      this.emitReserved("connect_error", err);
  ```
  and `destroy()` at `:648-656`: "clean subscriptions to avoid reconnections",
  `this.subs = undefined` (so `socket.active` becomes `false`). The client does not retry a
  refused handshake by itself. The repository already knows this for the capacity case:
  `chat-provider.tsx:161-166` (`onRefused`, "socket.io never retries a refusal by itself")
  and `src/test/socket-mock.ts:77`, added in commit `ab45fd9`. Only `'Too many connections'`
  is handled that way; `'Unauthorized'` refreshes the cookie and then does nothing.
- The only `socket.connect()` calls are mount (`:178`), `onRefused` (`:166`) and
  `reconnectWithFreshToken` (`:48-52`, reached only on `io server disconnect`).

Failure scenario: a tab is open; the laptop sleeps (or the API container is restarted by
`deploy/update.sh`) for longer than the access token's remaining life. The server-side
`expireWithToken` cut (`chat.gateway.ts:280-288`) cannot reach a transport that is already
gone, so the client never sees `io server disconnect`. On resume the manager reconnects on
its own, the namespace handshake carries the stale cookie, the middleware answers
`Unauthorized`, the socket is destroyed, `onConnectError` refreshes the cookie successfully
and nothing reconnects. HTTP keeps working, but `connected` stays `false` ("Connecting…"
in the online card), no `message:new`/read/typing pushes and no presence until a full reload
or a change of `me.id`.

Related: `reconnectWithFreshToken` (`:48-52`) assumes `refreshSession()` resolves; a thrown
`fetch` (API restarting right at expiry) rejects inside a `void` call and neither reconnects
nor calls `notifySessionLost`.

Fix: treat `'Unauthorized'` like the server-disconnect case:
`if (await refreshSession()) socket.connect(); else notifySessionLost();` (guard with
`!socket.active`), and make `reconnectWithFreshToken` catch a thrown refresh and retry with
back-off. Add a `serverRefuse('Unauthorized')` unit test next to the existing one in
`messages.test.tsx:380-397`.

#### H3. No resynchronisation after a socket reconnect; messages sent during the gap never reach an open thread, and are later marked as read

**Status:** CONFIRMED.
**Area:** `apps/web/src/features/chat`.

Evidence:

- `chat-provider.tsx:125` – `onConnect` only does `setConnected(true)`.
- `apps/web/src/features/chat/use-conversations.ts:70` – the thread query has
  `staleTime: Infinity`; the list and detail queries use 60 s (`:26`, `:46`).
- `apps/web/src/app/query-client.ts:12` – `refetchOnWindowFocus: false`.
- The only invalidation in the feature is `message-cache.ts:164` (a push for a conversation
  the client has never listed).
- Server pushes are fire-and-forget to rooms (`chat.gateway.ts:291-294`); there is no offline
  queue or connection-state recovery.

Failure scenario: Alice is on `/messages/:id` with Bob. Her socket drops for 30 s (wifi
blip, API restart; the token is still valid, so socket.io reconnects by itself). Bob sends
"are you there?" meanwhile; the push is lost. After the reconnect nothing refetches
`conversations.messages(id)`; with `staleTime: Infinity` it is never stale, so neither
`refetchOnReconnect` nor navigating away and back (within `gcTime`) fetches it. The thread
never shows the message until a hard reload. When the list query does refetch later (browser
`online` event or a remount after a minute), `unreadCount` becomes 1 and the `hasUnread`
effect in `thread.tsx:69-77` calls `markRead`: the server mark moves, Bob sees "Seen", Alice
never saw the message.

Fix: in `onConnect`, when this is a reconnect rather than the provider's first connection,
`queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })` (list, details
and the active thread; an explicit invalidate overrides `staleTime: Infinity`). Consider the
same on `visibilitychange` → visible.

#### H4. A database error inside `handleConnection` is an unhandled promise rejection and terminates the API process

**Status:** CONFIRMED (Nest source checked; no rejection handler anywhere).
**Area:** `apps/api/src/chat/chat.gateway.ts`.

Evidence:

- `chat.gateway.ts:114-137` – `async handleConnection` awaits `this.users.summary(userId)`
  (`:118`) with no `try/catch`.
- `node_modules/.pnpm/@nestjs+websockets@12.1.3*/node_modules/@nestjs/websockets/web-sockets-controller.js:137-139`
  – Nest subscribes the gateway hook as `.subscribe((args) => handler(...args))` and
  discards the returned promise.
- `grep unhandledRejection apps/api/src node_modules/.pnpm/@nestjs+core*` → no handler;
  `apps/api/src/main.ts` registers none. Node 24 (`.nvmrc`) defaults to
  `--unhandled-rejections=throw`, so the process exits. `deploy/docker-compose.yml:25`
  restarts it (`restart: unless-stopped`).

Failure scenario: PostgreSQL is briefly unreachable or the pool is saturated
(`connectionTimeoutMillis: 5_000`, `prisma.service.ts:18`) while a browser (re)connects its
socket, which is exactly what happens during an `update.sh` restart when every client is
reconnecting at once. `findUnique` rejects inside `handleConnection`, the API exits, every
socket and in-flight HTTP request is dropped, clients reconnect in a burst and may hit the
same condition. Even with a process-level handler the socket would stay connected without
having joined `user:<id>` (no pushes, not reachable by `SessionsRevokedEvent`) for up to
15 minutes.

Fix: wrap the body of `handleConnection` in `try/catch`; on failure log and
`socket.disconnect(true)` (the client then goes through `reconnectWithFreshToken`). Add a
process-level `unhandledRejection` logger as a backstop.

#### H5. Caddy never applies `no-cache` to the SPA's HTML and answers a missing asset with HTML plus a one-year immutable cache header

**Status:** CONFIRMED statically from Caddy's documented directive order; confirm on the
box with the two `curl` commands below.
**Area:** `apps/web/docker/Caddyfile:32-41`.

Evidence:

```caddyfile
handle {
    root * /srv/www
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
    header /index.html Cache-Control "no-cache"
    header X-Content-Type-Options nosniff
    header Referrer-Policy strict-origin-when-cross-origin
    try_files {path} /index.html
    file_server
}
```

- In Caddy's directive order `header` runs before `try_files`, and a `header` path matcher
  is evaluated against the *request* path. A navigation to `/`, `/u/alice` or
  `/messages/<id>` never has the path `/index.html`, so the HTML is served with `ETag` and
  `Last-Modified` but no `Cache-Control`. Browsers then apply heuristic freshness (roughly
  10 % of the time since `Last-Modified`, i.e. the image build time), so the HTML of a week-old
  build can be reused for hours without revalidation.
- A request for an asset that no longer exists (an old hashed chunk after a deploy) matches
  `@assets` (request path `/assets/…`), so the immutable header is set; `try_files` then
  rewrites it to `/index.html` and `file_server` answers **200 `text/html`** with
  `Cache-Control: public, max-age=31536000, immutable`. Cloudflare caches `.js` URLs by
  default and honours that header.

Failure scenario: a visitor opened the app before a merge; the box redeploys within five
minutes (`deploy/systemd/mesh-update.timer`). Opening the app again from a bookmark inside
the heuristic window serves the cached old HTML, which requests `/assets/index-<oldhash>.js`;
Caddy returns the new `index.html` as that script; the module fails on MIME type and the page
is blank until a reload (a plain reload revalidates the HTML and fixes it, but the user does
not know that). Independently of HTML caching, any tab that is already open and then opens a
lazy route it has not visited gets HTML for the old chunk URL and fails with
"Failed to fetch dynamically imported module".

Verify on the box:

```bash
curl -sI http://127.0.0.1:8080/ | grep -i cache-control            # expected today: nothing
curl -sI http://127.0.0.1:8080/assets/does-not-exist.js | grep -iE 'HTTP|content-type|cache'   # expected today: 200 text/html immutable
```

Fix: match on the request side and give assets their own handler:

```caddyfile
handle /assets/* {
    root * /srv/www
    header Cache-Control "public, max-age=31536000, immutable"
    file_server          # a missing asset is a 404, never HTML
}
handle {
    root * /srv/www
    header Cache-Control "no-cache"
    header X-Content-Type-Options nosniff
    header Referrer-Policy strict-origin-when-cross-origin
    try_files {path} /index.html
    file_server
}
```

On the web side, catch the dynamic-import failure in the route error boundary and reload once
(the standard SPA "new version deployed" handling).

### Medium

#### M1. The email address can be changed with no confirmation; the account stays "verified" and recovery mail follows the new address

**Status:** CONFIRMED. Known/deferred (`docs/BACKLOG.md`, "Email follow-ups"), but the
current behaviour is worse than "feature missing".
**Area:** `apps/api/src/users/users.service.ts`, `apps/web/src/features/profile`.

Evidence: `users.service.ts:107` (`['email', () => (data.email = patch.email)]`),
`:122-124` (only `assertAvailable` is checked), `:140-144` (plain update; `emailVerifiedAt`
untouched; no mail). `auth.service.ts:198-200` keeps signing `ev: true` because it is derived
from `emailVerifiedAt`; `:129-134` makes "resend verification" a no-op once verified, so the
new address can never be confirmed. The field is exposed: `packages/shared/src/users.ts:89`,
`apps/web/src/features/profile/edit-profile-dialog.tsx:175-188`; `apps/api/test/users.int-spec.ts:105-117`
pins it as intended. ADR 0010 line 14 states the invariant "the app is closed until the
address is confirmed"; it no longer holds after a change.

Scenario: a verified member sets `email` to any address they do not own (typo, or someone
else's). That person can no longer register (`users.service.ts:204` → 409); `forgot-password`
for that address now mails *their* inbox a reset link for *this* account
(`auth.service.ts:142-154`). Combined with M2 this is what makes a pre-hijacked account
unrecoverable.

Fix: until the confirm-new-address flow exists, drop `email` from `updateProfileSchema` and
the dialog; or on change clear `emailVerifiedAt`, `voidAll` tokens and send a verification
(the guard then holds the session on `/verify-email`). Better: `pending_email` + a token bound
to the new address, old address kept until confirmed.

#### M2. The verification link is a bearer sign-in link: account pre-hijacking and login-CSRF through a link on the real domain

**Status:** CONFIRMED as behaviour; deliberate per ADR 0010 line 15 ("a second sign-in
step would add friction without adding safety"), but that reasoning does not hold.
**Area:** `apps/api/src/auth/auth.service.ts:119-126`, `apps/web/src/features/auth/verify-email-page.tsx:26-36`.

Evidence: `verifyEmail` consumes the token, marks the account verified and returns a session
for whoever posts the token; the route is `@Public()` (`auth.controller.ts:118-130`). The web
page spends the token automatically on load and navigates to `/` (no "you are now signed in
as @x" step). The mail greeting is the attacker-chosen 80-character `name`
(`templates.ts:30-36`); resend is allowed while unverified, 3 per hour
(`auth.controller.ts:132-138`).

Variant A (pre-hijack): the attacker registers `victim@x` with the attacker's password. The
victim receives a genuine "Confirm your email address for The Mesh", clicks, is signed into
the attacker's account, which is now verified. The victim posts, uploads pictures, sends DMs;
the attacker logs in in parallel (sessions coexist) and reads and acts as the victim. With M1
the attacker then changes the email, changes the password (`revokeOthers` evicts the victim
within 15 min) and `forgot-password` for the victim's address finds no account: complete,
unrecoverable takeover of everything the victim created. The victim sees nothing: there is no
sessions list and no "your password/email was changed" mail (EmailService has only the
verification and reset templates).

Variant B (login CSRF): the attacker registers with their own address and sends the victim
the resulting `https://<app>/verify-email?token=…` link; the victim's browser is silently
signed into the attacker's account.

Fix: on `/auth/verify-email` start a session only when the browser already holds a session
for that same user (the registering browser); otherwise mark verified and show "Address
confirmed, sign in". Keep `reset-password` as it is (the user typed a new password), and add a
notification mail on password and email changes.

#### M3. `forgot-password` floods: a 10/min/IP reset-mail stream to any address, and each request voids the victim's own pending link

**Status:** CONFIRMED.
**Area:** `apps/api/src/auth`.

Evidence: `auth.controller.ts:141-147` (`@CredentialRoute` → `credential-throttle.ts:14-19`:
10/min per `ip:email`, 30/min per IP; no per-account cap independent of IP),
`auth.service.ts:142-154` (every call issues and mails), `email-tokens.service.ts:28-45`
(`issue` voids every older unused token of the kind).

Scenario: an attacker POSTs `{ email: alice@… }` ten times a minute (more with more IPs).
Alice receives a continuous stream of reset mails, and when she genuinely requests a reset
her link is voided by the attacker's next request within seconds, so she cannot reset her
password while the flood runs. It also burns the mail provider quota (ADR 0010: Resend; a
free tier is 100 mails/day), after which nobody can register, verify or reset until it
resets. `register` has the same mail-per-call shape (30/min/IP to an arbitrary address).

Fix: a per-account cooldown for reset mails (for example 1/min and 5/h regardless of IP), do
not void a token younger than N seconds, and cap registration-driven mail per address.

#### M4. Optimistic like/follow/react rollback restores a whole-prefix snapshot and undoes other in-flight updates

**Status:** CONFIRMED.
**Area:** `apps/web/src/features/posts/use-post-mutations.ts:55-74`, `features/users/use-follow.ts:19-45`, `features/comments/use-comments.ts:115-135`, `lib/query-snapshot.ts:6-15`.

Evidence: `onMutate` snapshots every query under `posts.lists` (resp. `users.*` + `me`,
`comments.<postId>.*`), `onError` restores the entire snapshot, and `onSuccess` writes
nothing back (the optimistic value is kept). `onMutate` also `cancelQueries` on the whole
prefix.

Scenario: like post X (request A in flight), then like post Y (request B). A fails (429 from
the global throttler, 5xx, offline). A's `onError` writes back the snapshot taken before A, in
which Y is still unliked; B succeeds but writes nothing. Y now shows unliked with the old
count while the server has it liked, and nothing refetches post lists until a remount after
`staleTime` (30 s). The same for two quick follows and for reactions. Secondary effect: a
feed refetch triggered by a follow (`use-follow.ts:48`) that is cancelled by a like keeps
`isInvalidated` but never refetches by itself, so the new followee's posts do not appear until
navigation.

Fix: scope the snapshot and rollback to the touched item (restore only that post/user/comment,
or re-apply the inverse delta), write the server result in `onSuccess` or invalidate the
touched lists in `onError`, and narrow `cancelQueries` to the specific queries.

#### M5. A tab keeps acting as the previous account after a sign-in elsewhere; verification done in another tab is never noticed

**Status:** CONFIRMED.
**Area:** `apps/web/src/features/auth/use-me.ts:6-11`, `app/query-client.ts:12`, `app/routes/require-auth.tsx:13-29`, `lib/query-keys.ts`.

Evidence: `me` has `staleTime` 5 min and `retry: false`; `refetchOnWindowFocus: false`
globally; query keys carry no viewer id; requests always send whatever cookies the browser
has; nothing listens for `storage`/`BroadcastChannel` events.

Scenario A: tab A shows Alice. In tab B the person signs out and signs in as Bob (same
browser, shared cookies). Back in tab A nothing refetches `me`: `useCurrentUser()` is still
Alice, but every request now carries Bob's cookies. A like from tab A is recorded for Bob
while the heart shows under Alice's identity; a post from the composer is created as Bob with
Alice's avatar in the composer; refetched lists show Bob's `likedByMe`/`followedByMe` next to
Alice's header. This persists indefinitely.

Scenario B: an unverified user sits in the waiting room (`verify-email-page.tsx`) in tab A and
opens the mailed link from the mail client (new tab B). Tab A stays on "Check your inbox" until
a manual reload.

Fix: refetch `me` on `visibilitychange`/focus (or a `storage`/`BroadcastChannel` ping from
`startSession`/`endSession`) and compare `user.id`; when it changes call `startSession` with
the new user. Minimal version: `refetchOnWindowFocus: true` on `meQueryOptions` plus a short
`refetchInterval` while `emailVerifiedAt === null`.

#### M6. The documented restore corrupts a non-empty database instead of restoring it

**Status:** CONFIRMED.
**Area:** `deploy/backup.sh:9`, `docs/RUNBOOK.md:207-213`.

Evidence: `pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"` is a plain dump (no `--clean`); the
runbook restores with `gunzip -c … | docker compose exec -T postgres psql -U mesh -d mesh`
into the live database, without `ON_ERROR_STOP` and without dropping anything.

Scenario: restoring "to undo a bad data change" into a database that still has its tables:
every `CREATE TYPE/TABLE/INDEX` fails, `psql` continues, each `COPY … FROM stdin` into a
table that already has rows aborts on the first primary-key conflict (COPY is atomic per
statement) while COPYs into currently-empty tables succeed. The result is a hybrid of old and
backup data plus a half-applied `_prisma_migrations`, reported as "restored". The drill only
works into an empty database.

Fix: dump with `pg_dump --clean --if-exists` (or drop and recreate the database before
restoring) and restore with `psql -v ON_ERROR_STOP=1`; update RUNBOOK §5 and rehearse it once.

#### M7. Every push to `main` is an unreviewed, ungated production deploy

**Status:** CONFIRMED (workflow coupling); whether branch protection requires green CI
could not be checked from here.
**Area:** `.github/workflows/docker.yml:6-10,55,63`, `deploy/.env.example:4`, `deploy/systemd/mesh-update.timer`, `deploy/update.sh:9`.

Evidence: `docker.yml` pushes `latest` on every push to `main` and has no `needs` on
`ci.yml` and no `workflow_run` trigger (grep: none). The box tracks `TAG=latest` and polls
every 5 minutes. The image build proves only that the Dockerfiles build: `vite build` does not
typecheck (`apps/web/package.json:8,10`), and no unit, integration or e2e test runs in the
image build. ADR 0006 describes tag-based releases; what is configured is continuous
deployment of `main`. `update.sh` pulls by tag with no digest or signature check.

Fix: gate the push on green CI (one workflow with `needs: [checks, integration, e2e]` before
the push job, or `workflow_run` on CI success), and/or make the box follow a release tag so
`latest` is not what it deploys.

#### M8. No container log rotation

**Status:** CONFIRMED. Known: `docs/ROADMAP.md` §1 lists "Docker log rotation" as a
pre-visitor item; `deploy/docker-compose.yml` has no `logging:` on any service.

pino-http logs one JSON line per request at `info` (only `/health` is ignored,
`logger.module.ts:23`); Caddy, cloudflared and Postgres add theirs; the default `json-file`
driver keeps everything. On a single box that also holds the backups this fills the disk over
months. Fix as the roadmap says: `logging: { driver: json-file, options: { max-size, max-file } }`
on each service, or `/etc/docker/daemon.json`.

#### M9. Presence is broadcast to everyone on every online/offline transition and the handshake is not rate-limited

**Status:** CONFIRMED. Known/deferred (`docs/BACKLOG.md`, "Socket connection churn").
**Area:** `apps/api/src/chat/chat.gateway.ts:131-132,145-150,296-302`, `socket.adapter.ts:26-29`, `common/guards/http-throttler.guard.ts:8`.

The HTTP throttler does not cover `/socket.io/*` (engine.io handles it before Express);
`allowRequest` only checks the Origin; the middleware caps concurrent sockets per user at 5
but not transitions. One authenticated client looping connect/disconnect costs a JWT verify, a
`users.summary` query and two broadcasts of N summaries to M sockets per cycle. Fix: a
per-user/IP connect rate limit and a debounced or diff-based presence broadcast; a Cloudflare
rate-limiting rule on `/socket.io/*` is the cheapest interim.

#### M10. The chat composer revokes the preview object URL that the optimistic bubble is about to render

**Status:** LIKELY (ordering confirmed in code; whether the browser still shows the image
depends on its memory cache: Firefox fails, Chromium may serve it). Check manually in
Firefox.
**Area:** `apps/web/src/features/chat/message-composer.tsx:49-61`, `features/uploads/use-image-upload.ts:33-40,81-84`, `features/chat/thread.tsx:106-120`.

Evidence: `send()` calls `onSend({ …, previewUrl: image.state.previewUrl })`, then
synchronously `image.clear()`; `clear` calls `release()`, which calls
`URL.revokeObjectURL(previewUrl)`. The thread's `send` builds the `pending-*` bubble with
`imageUrl: outgoing.previewUrl` and `appendToThread` only schedules a re-render; the
`<img src>` is created on that later render, after the revoke. The comment at
`message-composer.tsx:58` ("the thread keeps showing the preview… release ours") assumes
`clear()` does not revoke, but it does. The retry path (`thread.tsx:229-238`) reuses the same
revoked URL.

Scenario: send a picture; while "Sending…" the bubble shows a broken image instead of the
preview; it recovers when the server message replaces it. If the send fails, the failed bubble
stays broken and "Retry" reuses the dead URL.

Fix: let the composer hand ownership of the preview to the thread (`clear({ keepPreview: true })`
that resets state without revoking, with the thread revoking in `replaceInThread`/on unmount),
or create a second object URL for the bubble.

### Low

*Status 2026-10-20: every Low item is closed — fixed in A4 or on 2026-10-20, moved to the box
setup (A1), or accepted with a reason; `REVIEW_2026-10-19.md` §1 has the resolution of each.*

Grouped by area. Each line: evidence, scenario, fix.

**Auth**

- **L1. A verification link stays a 24-hour sign-in link after a password reset or change.**
  `auth.service.ts:160-176` (`resetPassword` voids nothing of kind `verify_email`; only
  `changePassword` voids `password_reset`), `email-tokens.service.ts:48-60`,
  `auth.service.ts:121-125` (verify on an already-verified account is a no-op update plus a
  fresh session). Anyone with mailbox access can POST the old verification token for up to
  24 h after the reset and get a session. Fix: `voidAll(userId, 'verify_email')` in both
  paths; no session on verify for already-verified accounts.
- **L2. The client treats any non-2xx `/auth/refresh` as "session lost".**
  `apps/web/src/lib/api/client.ts:62-66` (`return response.ok`), `:117-119`,
  `app/providers.tsx:18` (→ `endSession`), versus `auth.controller.ts:78-81` (cookies cleared
  only on 401). A 503/500 during a deploy or a 429 behind a shared NAT bounces the viewer to
  `/login` with valid cookies still in the jar; a reload signs them back in. Fix: only a 401
  is session loss.
- **L3. `register` awaits the verification mail.** `auth.service.ts:48-56`: the user row is
  created, then `sendVerification` is awaited; an SMTP failure returns a masked 500 with no
  cookies, and the retry answers 409 "email already exists". The person can still log in and
  use "Send the email again", but does not know that. Fix: send after the response like
  `forgotPassword` does, or return the session regardless.
- **L4. After verifying in another browser, the first browser's `ev:false` token gets 403s
  the client never refreshes on.** `auth.guard.ts:37-46`, `require-auth.tsx:22` (routing uses
  `/auth/me`, which is `@AllowUnverified`), `client.ts:117` (only 401 triggers a refresh).
  Feed and sidebar show error states until the socket refusal path refreshes the token. Fix:
  treat that 403 like a 401 (one refresh and retry), or have the waiting room refresh before
  entering.
- **L5. `COOKIE_SECURE` production guard only catches the literal `"false"`.**
  `config/env.ts:53` (`z.stringbool()` also accepts `0`, `no`, `off`), `:99-104`.
  `COOKIE_SECURE=0` boots in production without `Secure`. Compose hard-codes `'true'`, so this
  needs an operator edit. Fix: check the parsed value.

**Web**

- **L6. "Signed out everywhere" is reported even when the request failed.**
  `features/settings/settings-page.tsx:134-143`: `onSettled` toasts success and ends the local
  session regardless of outcome. Fix: success only in `onSuccess`.
- **L7. Signing out records the current page as the post-login destination.**
  `use-auth-mutations.ts:60-67` → `require-auth.tsx:17-21` stores `state.from` → the next
  sign-in (possibly another person on the same browser) lands on the previous person's
  `/messages/<id>` or `/settings`. Fix: do not record `from` when the redirect is caused by a
  sign-out.
- **L8. Any failure of `/auth/me` is treated as "no session".** `use-me.ts:19-24`
  (`!data` → anonymous, `retry: false`), `lib/api/auth.ts:14-21` (only a 401 becomes `null`).
  An API restart at boot shows the login page to someone with valid cookies. Fix: a distinct
  error state with retry in the guards.
- **L9. The reader's own other tabs are never told about a read.**
  `conversations.service.ts:194-202` (the reader is filtered out of the event audience),
  `chat-provider.tsx:96-118,138-139`. Tab B keeps the unread badge until its list refetches.
  Fix: emit `conversation:read` to the reader's room too and pass
  `clearUnread: userId === me.id` in `onRead`.
- **L10. `ThreadPage` keeps showing a thread after `conversation:removed` from another tab
  (UNCERTAIN).** `use-conversations.ts:338-348` removes the queries without notifying the
  mounted page; a send then gets a 404 toast. Fix: navigate to `/messages` when the active
  conversation disappears from the list.

**API / data**

- **L11. `GET /uploads/:kind/:file` 404s carry `Cache-Control: public, max-age=31536000, immutable`
  (and the stream-error path is labelled `image/webp`).** `uploads.controller.ts:52-58`: Nest
  applies `@Header()` before the handler runs
  (`@nestjs/core/router/router-execution-context.js:54` sets headers, `:67` runs the handler),
  and the exception filter only sets status and body. The same holds in production for Caddy:
  `Caddyfile:12-16` applies the cache header to every response in the `handle_path` block,
  including `file_server` 404s. After a restore of the database without the uploads volume (or
  a late volume mount), Cloudflare and browsers cache the 404s for a year and the images stay
  broken after the files are back, until a purge. Fix: set the cache header only once the file
  exists (`@Res({ passthrough })` after `open()`; in Caddy `@found file` + `header @found …`).
- **L12. `handleConnection`-style gap for message pictures: uploads lifecycle leaves orphans
  in three places (known/deferred: "Orphaned uploads reaper").** `uploads.service.ts:27-28`
  (`storage.put` then `prisma.upload.create`; a failed insert leaves a file with no row, which
  a row-based reaper would never see); message pictures are never discarded
  (`conversations.service.ts:235` deletes the conversation and cascades messages, no
  `discard`); never-attached keys (documented). Fix: delete the file when the insert fails;
  sweep files without rows; discard message keys on conversation deletion.
- **L13. `pnpm db:seed` has no production guard.** `prisma/seed.ts:30-35,73-83` truncates
  every table (`CASCADE`) and `rm -rf`s the upload folders of whatever `DATABASE_URL` is set.
  The container cannot run it (`--prod` install, `tsx`/faker are dev deps; the entrypoint only
  runs `migrate deploy`), so the footgun is a developer shell pointed at production. Fix:
  refuse when `NODE_ENV === 'production'` or the host is not local unless `SEED_FORCE=1`.
  (`cover/` is also not cleaned at `:79`.)
- **L14. Revision lists silently truncate at 50.** `posts.service.ts:85-90`,
  `comments.service.ts:144-149` (`take: 50`, `nextCursor: null`). Fix: keyset on
  `(editedAt, id)` or cap edits.
- **L15. `lastMessageAt` can move backwards under concurrent sends; `markRead` then refuses
  to move the mark.** `conversations.service.ts:149-169` (timestamp taken at insert, row lock
  only on the update), `:179-187` (`caughtUp` compares against the denormalised value). A
  member whose mark lands between the two timestamps is "caught up" while `withUnread` still
  counts the newer message: the badge comes back on every refetch until the next message. Fix:
  `last_message_at = GREATEST(last_message_at, created_at)`, or compare against
  `row.messages[0].createdAt`.
- **L16. `GROUP_MAX_MEMBERS` check is not atomic.** `conversations.service.ts:210-221`: two
  concurrent `addMembers` both pass the count and both insert; harmless beyond the cap.
- **L17. P2002 `meta.target` shape is only tested synthetically.**
  `test/platform.int-spec.ts:38-44,154-160` throw a hand-built error; the real race after
  `assertAvailable` is never driven through `@prisma/adapter-pg`. The envelope still answers
  409 if the shape differs (`errors.ts:136-139`), only `fields` would be missing. Suggest one
  test that inserts the duplicate between the check and the create.
- **L18. `UPLOAD_MAX_PIXELS` default (25 MP, `env.ts:64`) differs from `.env.example:36`
  (40 MP).** Config drift only.

**Deploy / ops**

- **L19. `update.sh` aborts before `up -d` on any pull failure and pulls two Docker Hub
  images anonymously every 5 minutes.** `update.sh:5,9-10`: `set -e` plus a pull of all four
  images; a Hub outage or the anonymous rate limit leaves freshly pushed GHCR images unstarted
  with no alert. Pulling `cloudflared:latest` every 5 min also self-deploys every cloudflared
  release. Fix: pull only `api web` on the timer; pin and update postgres/cloudflared
  deliberately.
- **L20. Tunnel token on the cloudflared command line.** `deploy/docker-compose.yml:66`:
  visible in `ps`/`docker inspect` to every local user; a second connector with that token
  joins the tunnel and receives real traffic. Fix: pass `TUNNEL_TOKEN` as an environment
  variable (cloudflared reads it).
- **L21. `POSTGRES_PASSWORD` is interpolated unencoded into `DATABASE_URL`.**
  `docker-compose.yml:32`: a password containing `/ @ # ? %` (two thirds of
  `openssl rand -base64` outputs, which the file suggests two lines later for `JWT_SECRET`)
  makes the API refuse to boot with "Invalid environment configuration". Fix: document
  `openssl rand -hex 32` or URL-encode.
- **L22. The published web image has no operator name or contact email on the legal pages.**
  `docker.yml:58-67` passes no `build-args`; `apps/web/Dockerfile:12-15`, `lib/env.ts:8-11`;
  production `/privacy` names "the operator of this site" with no address. For a privacy notice
  this omits the controller identity. Fix: `build-args` from repository variables.
- **L23. Uploads and proxied API responses get no `nosniff`/`Referrer-Policy` from Caddy.**
  `Caddyfile:12-16` versus `:37-38` (headers only in the SPA block). Impact is small: every
  stored file is sharp-re-encoded WebP served as `image/webp`; helmet covers API responses.
  Fix: set the two headers at site level.
- **L24. The SPA has no CSP, `frame-ancestors`, `X-Frame-Options` or `Permissions-Policy`.**
  `Caddyfile:32-41`. Clickjacking impact is nil today because cookies are `SameSite=Lax`
  (`cookies.ts:17`): inside a cross-site iframe no API call carries the session. A CSP would
  not break the app: no inline scripts (`apps/web/index.html`), the emoji picker uses native
  glyphs, the socket is same-origin; it needs `style-src 'self' 'unsafe-inline'` (Radix,
  sonner), `img-src 'self' blob: data:` (`use-image-upload.ts:69`), `connect-src 'self' wss://<host>`.
  Fix: add it at site level and run the e2e suite against it.
- **L25. RUNBOOK's migration-failure guidance leaves the API in its restart loop.**
  `docs/RUNBOOK.md:224,230-232`, `entrypoint.sh:13-16`: a failed migration is recorded with
  `finished_at NULL`; every later `migrate deploy` refuses with P3009 even after a fix-forward
  migration is added. The runbook omits `prisma migrate resolve --rolled-back <name>`. Fix:
  add that step to §6.
- **L26. Request logs record Caddy's container IP, not the client.**
  `logger.module.ts:31-37`: pino-http's `remoteAddress` is the socket peer, not `req.ip`.
  Every production log line shows the same address, so abuse cannot be attributed. Fix: log
  `req.raw?.ip ?? req.ip`.
- **L27. Backups: no alerting, local only, 14-day retention (known: RUNBOOK §7, BACKLOG
  "Ops").** `backup.sh:9-12`: a failed `pg_dump` fails the unit (good) but leaves a 0-byte
  file and nothing notifies; a persistent failure silently ages out every valid dump after 15
  days, on the same disk as the data. Fix: `OnFailure=` notifier or a healthcheck ping, plus
  the planned off-box copy.

**Risk statements (no concrete bug).** Floating image tags (`node:24-slim`, `caddy:2-alpine`,
`postgres:17-alpine`, `cloudflare/cloudflared:latest`) and GitHub actions by major tag;
`mesh` in the `docker` group is root-equivalent on the box; no `mem_limit`/`cpus` on any
service (a sharp decode burst can OOM the box; decode concurrency is a known deferral); the
API runtime image carries the Prisma CLI (known deferral); new group members see the full
history from before they joined (`conversations.int-spec.ts:180-181` pins it as intended, ADR
0009 is silent; worth one sentence there).

---

## 4. Dependency audit

`pnpm audit --prod` on `pnpm-lock.yaml` (2026-10-16):

| Severity | Package | Advisory | Path | Reachable? |
|---|---|---|---|---|
| high | `deepmerge-ts` < 8.0.0 | GHSA-ggr8-5vv4-36mx (stack exhaustion on recursive graphs) | `prisma > @prisma/config > deepmerge-ts` | No: only used while loading `prisma.config.ts` (own config, not user input) during `migrate deploy` |
| high | `mysql2` < 3.22.0 | GHSA-3f6p-5ww8-9rcr (auth plugin downgrade) | `prisma > mysql2` | No: bundled by the Prisma CLI, never loaded for a PostgreSQL datasource |
| moderate | `mysql2` ≤ 3.23.0 | GHSA-rgwj-5xj2-c3m3 (decompression bomb) | `prisma > mysql2` | No, same reason |

All three live under the `prisma` CLI package, which is a runtime dependency only so the
container can run migrations (`CLAUDE.md`, BACKLOG "Images"). Moving `migrate deploy` into a
one-shot image, as the backlog already proposes, removes them from the runtime image entirely.
`allowBuilds` in `pnpm-workspace.yaml` has no placeholder lines; only `@prisma/engines`,
`prisma`, `argon2` and `esbuild` are allowed.

Resolved versions of the usual suspects (from the lockfile): express 5.2.1, body-parser 2.3.0,
qs 6.16.0, path-to-regexp 8.4.2, cookie 0.7.2, multer 2.4.0, busboy 1.6.0, sharp 0.35.5,
socket.io 4.8.4 / engine.io 6.6.11 / ws 8.21.3, nodemailer 10.1.2, pg 8.23.1, jsonwebtoken 9.0.3,
form-data 4.0.6, undici 8.11.2, vite 8.3.4, esbuild 0.28.2.

---

## 5. Checked and found fine

This is the coverage list: things that were looked at specifically and hold up. It is here so
the next reviewer does not redo them and so the absence of a finding is not mistaken for an
absence of review.

**Auth, sessions, CSRF**

- Cookies: `httpOnly`, `SameSite=Lax`, `Secure` in production (forced `'true'` in compose,
  `env.ts` refuses `"false"`), refresh cookie scoped to `/api/v1/auth`, cleared with matching
  attributes.
- Origin check runs before everything for POST/PUT/PATCH/DELETE regardless of cookie or
  Bearer (`app.setup.ts:36`); `Origin: null` refused; the self-host allowance cannot be
  satisfied by a cross-site page; the socket handshake applies the same list
  (`socket.adapter.ts`). No state-changing GET routes.
- Throttling: default tracker sees the real client IP behind Caddy (see "Client IP chain"
  below); `accountTracker` reads the already-parsed body and normalises like `emailSchema`;
  credential throttlers apply only to `@CredentialRoute()` handlers.
- JWT: HS256 pinned in `verifyOptions.algorithms`, issuer checked, secret ≥ 32 chars,
  placeholder refused in production; every token the app signs carries `exp`.
- Login timing: unknown email still runs argon2 against a one-time dummy hash; identical 401.
- `forgot-password` always 204, mail not awaited (no timing or response difference).
- Refresh race between tabs: Web Locks plus in-tab single flight.
- Email tokens: 256-bit, hash-only storage, kind-bound, atomic single use, same 400 on every
  failure; wrong-kind cross-use tested.
- `logout` is `@Public` (works with an expired token and unverified); `logout-all` is
  `@AllowUnverified`; both protected by the Origin check.
- Web session: `startSession`/`endSession` drop all per-viewer cache; `redirectTarget` blocks
  external and protocol-relative targets (browsers normalise `\` to `/`); the socket is
  disconnected on sign-out; auth endpoints opt out of the refresh retry; no redirect loops
  between `RequireAuth`, `RedirectIfAuthenticated` and the waiting room.
- Deleted account: refresh → 401 (rows cascade), `me` → 401.

**Realtime and conversations**

- Membership: every HTTP and socket path touching a conversation goes through
  `rowForMember`/`groupForMember`/`otherMemberIds`; non-members get 404; member lists and read
  marks only reach members; typing from non-members is dropped.
- Event audiences are computed from the row at the time: send → members at send time; read →
  the others; addMembers → updated list; leave → remaining plus `conversation:removed` to the
  leaver only; createGroup → all. No leaver receives later pushes; an empty list hits the
  `emitTo` guard.
- `ensureDirect` with yourself → 400; sorted `directKey`; `uuidSchema` lower-cases ids;
  the P2002 race is handled; `leave`/`addMembers` on a direct → 400.
- Handshake: Origin check plus CORS; cookie then `auth.token`; `ev:false`, expired and
  sub-less tokens refused (unit and integration tests); `expireWithToken` timer cleared on
  disconnect; `SessionsRevokedEvent` cuts the user room.
- `socketsByUser`: increment in middleware, decrement in `handleDisconnect`; socket.io 4.8's
  `Namespace._add` was traced: the middleware has no real I/O, so a transport close cannot
  interleave between accept and `connection`; no leak found. (Keep the middleware I/O-free; a
  DB lookup there would open this leak and lock users out at 5.)
- Rate limiters: per-user maps, forgotten on the last socket, bounded by online users; typing
  relays chained per socket with `.catch`.
- `withUnread` raw SQL is fully parameterised (`Prisma.sql` fragments joined with
  `Prisma.join`).
- `history` keyset: `createdAt desc, id desc` with `id lt`; cursor millisecond precision
  matches `Timestamptz(3)`; no Prisma `cursor:` anywhere.
- Socket payload keeps the "text or picture" refinement; pinned by `chat.int-spec.ts:469-475`.
- Web message cache: optimistic bubble replaced by `withoutFirstPending` plus id-deduped
  `prependItem`; push-before-ack and ack-before-push both converge; `upsertConversation`
  guards on `lastMessage.id`; the HTTP fallback produces no duplicate.
- `markRead`: optimistic clear then ack, forward-only; `onMessage` marks read only when the
  thread is active and the document visible.
- `typingIn`: 6 s expiry per (conversation, user), cleared on `false`, on that person's
  message and on unmount.
- `reconnectWithFreshToken` against a revoked session: refresh 401 → `notifySessionLost` →
  the provider unmounts and disconnects; no loop. `ev:false` never reaches the provider.
- `getChatSocket` singleton across sign-out/sign-in: effect keyed on `me.id`, all listeners
  removed and `disconnect()` on cleanup, `connect()` sends the current cookie, no per-user
  state in `lib/socket.ts`.

**Data layer and content APIs**

- `escapeLike` in `users.service.ts:33-35` is correct, not a double escape: Prisma does
  **not** escape `%`/`_` in `contains`/`startsWith`/`endsWith`
  ([prisma/prisma#19506](https://github.com/prisma/prisma/issues/19506), open; for
  `mode: 'insensitive'` [#10810](https://github.com/prisma/prisma/issues/10810); the
  [Prisma docs](https://www.prisma.io/docs/orm/v6/prisma-client/queries/filtering-and-sorting)
  tell users to backslash-escape themselves). `follows.int-spec.ts:120-129` searches
  `?q=flagged_user` and finds `flagged_user`.
- Keyset pagination: `@db.Timestamptz(3)` round-trips `Date.toISOString()` exactly, so the
  `createdAt` equality branch of `keysetAfter` matches; every list fetches `limit + 1`; the id
  tiebreak absorbs identical `created_at` from `createMany`; the ranked comment cursor's
  three-branch OR matches the `(post_id, reactions_count desc, created_at desc, id desc)`
  index; follows lists key on `(createdAt, followerId|followeeId)`; the deleted-cursor-row
  case is covered by `posts.int-spec.ts:150`.
- `reactions_count`: +1 only on insert, -1 only on a real delete, both inside the
  transaction; concurrent react/react hits the primary key and rolls back; comment and post
  deletion cascade the reaction rows; the only drift path (a `users` delete) has no API; the
  seed recomputes from rows.
- Ownership: post update/delete author-only; comment update author-only; comment delete by
  author or post author; revisions readable by any member (design); no private content, so
  `assertExists` 404s leak nothing.
- Migration `20261016101500_group_conversations`: the `messages_no_self_message` CHECK is
  table-level and is dropped automatically with `DROP COLUMN recipient_id`;
  `LEAST/GREATEST` on uuid is bytewise and equals the sorted-hex `direct_key` of the API and
  seed; every message gets a conversation (same key expression on both sides), so
  `SET NOT NULL` holds; `last_read_at` derivation is consistent with `send` marking the sender
  read. Schema and migrations are consistent (indexes, enums, cascades, `SetNull` on
  `created_by_id`).
- Pool and transactions: the three interactive transactions await only DB work; events and
  mail are emitted after commit; pool options are valid `pg` options.
- Uploads: `assertOwned` checks owner and kind; `UploadPathDto` regex, `UPLOAD_KEY_PATTERN`
  and `path.resolve` containment in `LocalStorageService.resolve`; `detectFormat` reads
  headers only and the pixel budget is enforced on decode; animated GIF decodes the first
  frame; multer `files:1, fields:0, parts:1` plus `fileSize`; `wx` write flag; `discard`
  reference-counts profiles, posts and messages.
- `assertAvailable` excludes the caller and the unique indexes are the final arbiter.
- Seed: faker seeded, usernames satisfy the shared rule, counters recomputed, read marks
  consistent with the model.

**Deployment and platform**

- Client IP chain: cloudflared forwards `CF-Connecting-IP` (set by Cloudflare's edge, not
  spoofable through the tunnel); Caddy's `header_up X-Forwarded-For {header.CF-Connecting-IP}`
  replaces the header, so the API receives exactly the client IP with Caddy as the socket
  peer; Express `trust proxy = 1` → `req.ip` is that entry, and both the default throttler
  tracker and `accountTracker` see the real client. Without the header (only reachable via
  the loopback-bound `127.0.0.1:8080`) `req.ip` falls back to Caddy's container IP; no
  shared-bucket or spoofing path from the internet.
- Postgres has no published port in production; the dev compose binds `127.0.0.1:5433`;
  `web` binds `127.0.0.1:8080` only.
- `.dockerignore` excludes `.env*`, `deploy`, `.git`; the build stage uses a dummy
  `DATABASE_URL`; the runtime image holds only prod deps, `dist`, `prisma` and the config.
- Entrypoint: executable in git; `setpriv` present in `node:24-slim`; privileges dropped
  before `migrate deploy`; Prisma's advisory lock serialises concurrent deploys; the
  non-recursive `chown` is enough because `node` creates the `<kind>/` folders.
- Caddyfile: `POST /api/v1/uploads?kind=…` (path `/api/v1/uploads`, no trailing segment) does
  not match `/api/v1/uploads/*` and is proxied; no `browse`, so directories 404; the only writer
  to the volume is `LocalStorageService.put` with keys restricted to `<kind>/<uuid>.webp`;
  `.webp` → `image/webp`; `admin off`, `auto_https off` correct behind the tunnel.
- `/health` is not proxied by Caddy, so DB status is visible only inside the compose network.
- Swagger is mounted only outside production; `/api/docs` in production is a 404 envelope;
  helmet's CSP is active for API responses in production.
- `env.ts` production checks: every `PRODUCTION_EXPLICIT` key is set by compose; the
  placeholder regex matches both `.env.example` values; `EMAIL_TRANSPORT=smtp` enforced;
  `WEB_ORIGINS` is the single `PUBLIC_URL`; compose defaults `LOG_LEVEL` to `info`.
- Logging: `authorization`, `cookie` and `set-cookie` redacted; the request serialiser logs
  only id, method, url, remote address and user agent, never bodies; verify/reset tokens travel
  in POST bodies, so `req.url` never carries them; `OutboxMailer` is refused in production; no
  `console.*` in `src/`; Prisma known-request errors carry no values.
- `backup.sh`: variables expand inside the container where compose sets them; the volume
  name matches `name: the-mesh`; `-T` suits the TTY-less systemd run.
- Compose: `stop_grace_period` 20 s (api) / 30 s (postgres) with `enableShutdownHooks`;
  `depends_on: service_healthy` on postgres.
- CI: `permissions: contents: read`; `packages: write` in `docker.yml` is only used by steps
  gated on `github.event_name != 'pull_request'`, and fork PRs get a read-only token; the
  Prisma client is generated and `db:check` runs before the integration tests.

**Web client**

- XSS: no `dangerouslySetInnerHTML`, `innerHTML`, `document.write` or `eval` anywhere in
  `apps/web/src`; all user text rendered as React children.
- User-data `href`s: only `profile-header.tsx:73` (`user.website`, restricted to http(s) with
  a domain hostname by `websiteSchema`) and `thread.tsx:308` (`message.imageUrl`, server
  generated or the local `blob:` preview). Every `target="_blank"` carries
  `rel="noopener noreferrer"` (or `noreferrer`, which implies it).
- Route params built from data: usernames are `[a-z0-9_]`, ids are uuids.
- Emoji picker: only `data.emoji` (a string) is inserted into controlled textarea state.
- Cache helpers: `prependItem` handles empty pages; `mapItems`/`filterItems`/
  `updateUserEverywhere` guard `undefined` data; new posts are prepended to the feed and own
  profile list only when cached; refetches replace pages wholesale, so no duplicates.
- Forms: `applyApiErrors` maps API `fields` to react-hook-form; `autoComplete` is correct on
  every password field; `buildProfilePatch` diffs against normalised values.
- Uploads: type and 5 MB checked before upload; abort and object-URL revoke on unmount,
  reselect and clear (except the hand-over in M10); failed uploads keep no key and block
  submit.
- Infinite scroll: observer only while `hasNextPage && !isFetchingNextPage`, disconnected on
  cleanup.
- Routing: feature areas lazy-loaded via shared `routes.tsx` chunks; `route-error.tsx` shows
  generic copy only; 404 keeps the shell; the bundle budget script reads only the entry and
  modulepreload scripts.
- Env: only `VITE_*` build-time values are read; nothing secret in `index.html` or
  `.env.example`.
- No per-navigation leaks found: every effect cleans up.

---

## 6. Suggested order of work

1. **H1** (refresh-token revocation): small change in one service plus three integration
   tests. Do this first; it is the only finding with a security angle in the High tier.
2. **H4** (`handleConnection` try/catch) and **H2 + H3** (socket reconnect and resync): all
   in two files, and they are what makes chat trustworthy across restarts, which the
   5-minute auto-deploy makes frequent.
3. **H5** (Caddyfile) and **M6** (restore procedure) and **M8** (log rotation): the
   deployment set; verify H5 on the box with the two `curl` commands.
4. **M1 + M2 + M3** (email change, verification sign-in, reset-mail flood): decide the
   product behaviour (ADR 0010 amendment), then implement together; M1 alone can be closed
   today by removing `email` from the profile patch.
5. **M4 + M5 + M10** (web cache correctness, cross-tab identity, preview hand-over).
6. **M7** (gate the deploy on green CI) and the Low list as ordinary follow-ups; L5, L6, L7,
   L11, L13, L20, L21 and L26 are each a few lines.

Add to the integration suite in the same pass: the three H1 cases, "forgot-password twice
keeps the first link valid for N seconds" (M3), and a `serverRefuse('Unauthorized')` unit test
for H2.
