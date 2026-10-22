# Implementation plan (after R1, 2026-10-19)

**Status:** v0.5 — on 2026-10-20 the owner removed C1 (newcomer experience, parked in
`BACKLOG.md`) and pulled five backlog items into the plan as v2.7 (C5 chat extras, B6 `#`
autocomplete, C7 realtime activity, D4 picture cropping) and an E4 line (emoji picker upgrade);
otherwise v0.3, reviewed by the owner on 2026-10-19 in two rounds (all decisions in §9; no open points).
Written against `dev` at `cedd8f2` (legal pages, pre-release hardening and the runbook revision are
in; `main` is at PR #25). **The site opens to visitors around 2026-10-29.**
**Relation to the other documents:** `ROADMAP.md` says *what* and *why*; this document says *how*, in
which order, and what each slice ships. Every slice gets a row in `REBUILD_PLAN.md` §4.12 when it
lands, deferrals move to `BACKLOG.md`, new decisions become ADRs (numbers proposed below).

Conventions kept from the previous slices: work directly on `dev`, one commit per slice, the owner
commits; `pnpm check`, `pnpm test:int` and the Playwright suite stay green per slice; every slice ships
its shared zod schemas, API module, web feature, unit + integration + web tests, an e2e spec or an
extension of one, and its new pages in `e2e/a11y.spec.ts`. Sizes are the plan's S / M / L / XL, not
hours.

---

## 0. Where we are

| Area | Shipped | Not there |
|---|---|---|
| Accounts | register, login, rotating refresh, logout (all), password change, email verification gate, password reset, CSRF origin check, credential throttles | account deletion, data export, email change, sessions list, 2FA, bot protection |
| Profiles & people | `/u/:username` with tabs, edit with pictures, follow, search by name/username, suggestions | block/mute/report, private accounts |
| Posts | feed (own + followed), one picture, emoji, like, edit + history, delete | permalink, several pictures, image dimensions, link previews, mentions/hashtags/URL links, search, bookmarks, reposts |
| Comments | flat, newest/top, edit + history, delete, 5 reactions | replies |
| Activity | followed people's actions, sidebar + page | realtime, "about me" view (= notifications) |
| Chat | direct + group, receipts, typing, pictures, presence, resync | chat bubbles, delete message, group admin/rename/remove, new-messages pill, title badge, sound |
| Settings | theme, password, sign out everywhere, legal links | preferences (bubbles, sound), sessions, email, blocked list, danger zone |
| Platform | envelope, request ids, pino, throttling, Swagger, WebP uploads, bundle budget, axe, Docker, pull deploy, backups, runbook | box not yet running (per `ROADMAP.md`), uptime check, off-box backups, error tracking, upload reaper |

---

## 1. Tracks and order

Five tracks. A is what the opening needs; B is the agreed product order (mentions → post pages +
search → chat), extended with notifications and moderation; C are gaps nobody had written down; D is
account depth; E is polish and operations.

Sequence (one commit each, PR `dev → main` at each milestone line). The owner keeps the agreed order
and the opening date is fixed, so the two go-live slices that need code (A2, A3) follow B2 and land
before the opening; A1 is the owner's and runs in parallel.

```
B1  mentions, hashtags, URL links   ✅ 2026-10-19           ─┐
B2  post pages + search             ✅ 2026-10-19           │  v2.3 – before the opening (≈ 2026-10-29)
A2  account deletion + export       ✅ 2026-10-19           │
A3  Turnstile on register           ✅ 2026-10-19           │
A1  box + monitor + backups (owner, in parallel)           ─┘
A4  review-pass completion + cheap Low items ✅ 2026-10-19  ─┐
B3a chat bubbles                    ✅ 2026-10-19           │  v2.4
B3b chat follow-ups                 ✅ 2026-10-19           ─┘
C6  scheduler + reapers             ✅ 2026-10-20          ─┐
B4  notifications                   ✅ 2026-10-20           │  v2.5
C3  bookmarks (a) + reposts (b)     ✅ 2026-10-20          ─┘
B5  moderation (a + b)              ✅ 2026-10-20          ─┐
D1  email change, sessions list     ✅ 2026-10-20           │  v2.6
C2  comment replies                 ✅ 2026-10-20          ─┘
C5  chat extras (edit, reactions, role lines, sound) ✅ 2026-10-20 ─┐
B6  # autocomplete                  ✅ 2026-10-20           │  v2.7
C7  realtime activity                                       │
D4  picture cropping                ✅ 2026-10-21          ─┘
D2  richer posts                    ✅ 2026-10-21 (pulled forward by the owner)
D3  TOTP · E1–E4                                               later minors
```

The order inside a milestone can move; the dependencies that must hold are in §7. Moderation stays
in v2.6 by the owner's choice; if abuse shows up after the opening, B5a (block + report) is the slice
to pull forward, nothing else depends on its position.

---

## 2. Track A – the opening

### A1. First deployment, uptime check, off-box backups · S (ops, owner)

- Runbook §1–3 on the box; rehearse the restore drill (§5) once against a scratch database.
- Monitor: Cloudflare health check (or any external monitor) on `https://social.bodrie.dev/api/v1/auth/me` expecting 401; `/health` stays internal.
- Off-box copies of `backup.sh` output with `rclone` to any remote; the systemd timer gains a second step. Document the remote in the runbook, not in the repo's env. A failed dump must be noticed (review L27, moved here 2026-10-20): an `OnFailure=` unit that mails or pings, or a healthchecks-style ping at the end of `backup.sh`; and the script must not leave a 0-byte file behind.
- Fold in the few-line Low items that touch the deploy set: L19 (`update.sh` continues to `up -d` when only one pull fails), L20 (tunnel token via `env_file`, not the command line), L21 (URL-encode `POSTGRES_PASSWORD` in `DATABASE_URL`), L26 (client IP in request logs behind Caddy, with the integration test the backlog asks for). *L19–L21 were done with E4 on 2026-10-22 (ADR 0018), L26 the same day (client address in the request log, with the integration test).*
- Code side is tiny; no ADR, runbook edits only.

### A2. Account deletion and data export · M · ADR 0012 "Account lifecycle" · ✅ 2026-10-19

**Decision (owner, 2026-10-19): deletion erases, it does not anonymise.** Every row the schema
cascades from `users` goes (posts, comments, likes, follows, activities, reactions, refresh and email
tokens, uploads, conversation memberships, messages). A deleted member's messages vanish from other
people's threads; the ADR records the alternative (placeholder sender) and why it was not taken.

API

- `DELETE /users/me` body `{ password }` (`deleteAccountSchema`): verify the password (same argon2 path and timing as login; 5/min throttle like `POST /auth/password`), then in one transaction: for every conversation run the `leave` semantics (last member out deletes the group; a direct thread with one member left is deleted too, so the other side's list does not show a half-conversation), delete the user (cascades do the rest). After commit: delete every file of the user's `uploads` through `StorageService`, emit `SessionsRevokedEvent` (the gateway already disconnects sockets on it), clear both cookies, answer 204. Mail "your account was deleted" via `EmailService` (not awaited, like the reset mail).
- `GET /users/me/export` → `Content-Disposition: attachment; filename="beso-export-<username>-<date>.json"`; body `{ exportedAt, user, posts (with revisions, imageUrl), comments (with revisions), likes, follows, followers, reactions, messages (sent only, with conversation id and title), uploads (key, kind, url) }`. 1/min per account. Built in a new `AccountService` (`users/account.service.ts`) so `UsersService` does not grow.
- Shared: `deleteAccountSchema`, `accountExportSchema` (so the web can parse and offer "download").

Web

- Settings → new **Account** card at the bottom: "Download your data" (fetches, saves via a Blob link) and "Delete account" (destructive dialog: password field, "This cannot be undone", server field errors mapped). On success `endSession()`; the guard routes do the navigation.
- The privacy page gets a sentence on both rights (bump `LEGAL_UPDATED_ON`).

Tests: int (wrong password → field error, cascades incl. a group where the user was the last member and a direct thread, files removed, sockets disconnected, export shape and throttle); web (dialog, errors, session end); e2e (register a throwaway through the outbox, delete it, sign-in refused).

### A3. Spam protection on registration (Cloudflare Turnstile) · S · ✅ 2026-10-19

**Decision (owner): register only**; `forgot-password` and `resend` keep their existing limits.

- API: `CAPTCHA` token with two providers, like `MAILER`: `TurnstileVerifier` (POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET`, token and client IP; 2 s timeout; a network failure refuses the registration with 503 `CAPTCHA_UNAVAILABLE` rather than letting it through) and `NoopVerifier` when `TURNSTILE_SECRET` is unset (dev, tests). Production requires the secret unless `CAPTCHA=off` is set explicitly (same pattern as the email guard in `env.ts`). `registerSchema` gains optional `captchaToken`; a missing or failed token is a field error on `captchaToken`.
- Web: `VITE_TURNSTILE_SITE_KEY` (Dockerfile arg like the legal variables). When set, the register form renders the widget (script from `challenges.cloudflare.com` loaded on first visit to `/register`), passes the token, resets the widget on a server error. Without a key the form is unchanged (dev and Vitest untouched).
- Tests: int with a fake verifier (accepted, refused, unavailable); web with the key unset plus one test that stubs the widget global; e2e unchanged (no key in CI). Runbook §2: create the widget in the Cloudflare dashboard, where the two secrets go.
- ADR: one section in ADR 0012.

### A4. Finish the review pass and the cheap Low items · M · ✅ 2026-10-19 (`docs/REVIEW_2026-10-19.md`)

The four tracks the 2026-10-16 pass never reported on, each a read-and-fix commit with a short
report appended to `PRE_RELEASE_REVIEW_2026-10-16.md` (or a new `REVIEW_2026-10.md`):

1. **Accessibility sweep** beyond axe: keyboard order in the dialogs and pickers, focus return after dialogs close, live regions for toasts and the typing indicator, reduced motion in the navigation progress bar, 200 % zoom on the chat page.
2. **Shared-contract drift**: every `api.get(path, schema)` on the web matched against the controller that answers it; `@ZodResponse` on the handlers where it is free (backlog item), so `openapi.json` carries response schemas.
3. **Ops and docs drift**: `.env.example` files against `env.ts` (L18 already found one), runbook against compose, `CLAUDE.md` against the code.
4. **Test coverage**: the gaps list, then the missing cases (the review's suggestions: three H1 cases, the M3 "forgot twice" case, a `serverRefuse('Unauthorized')` unit test if still absent).

Plus the Low items that are each a few lines and not covered by A1: L5 (`COOKIE_SECURE` guard), L6, L7, L8, L11 (uncached 404 on missing upload), L13 (seed refuses `NODE_ENV=production`), L14 (revision lists paginate or state the cap), L15/L16 (`lastMessageAt` monotonic, member cap inside the transaction), L23/L24 (Caddy `nosniff`, `Referrer-Policy`, `frame-ancestors`, `Permissions-Policy`; a CSP in report-only first because of the emoji picker and Turnstile scripts). The remaining Lows stay in the review document as open.

---

## 3. Track B – product features

### B1. Mentions, hashtags and links in text · M–L · ADR 0013 "Text entities" · ✅ 2026-10-19

**Decision (owner): `@` autocomplete ships inside this slice.**

**Rules (shared parser, `packages/shared/src/text.ts`, used by API and web):**

- `tokenize(text)` → `Array<{ type: 'text' | 'mention' | 'hashtag' | 'url', value, raw }>`; `extractEntities(text)` → `{ mentions: string[], hashtags: string[] }` (lower-cased, unique, in order).
- Mention: `@` + `USERNAME_PATTERN` (3–30 chars), preceded by start of text or a non-word character, so `mail@example.com` is not a mention. Case-insensitive, stored lower-case.
- Hashtag: `#` + Unicode letters/digits/underscore, at least one letter, at most 50 chars, same boundary rule; display keeps the writer's case, storage lower-cases (`#Weekend` and `#weekend` are one tag).
- URL: `http(s)://` only, trailing punctuation excluded; rendered with the host and a shortened path, `rel="noopener noreferrer nofollow"`, `target="_blank"`. No auto-`www.` matching.
- Entities are parsed on create and on edit; the text itself is stored as written.

API

- Migration `text_entities`: `post_mentions(post_id, user_id, PK both)`, `comment_mentions(comment_id, user_id)`, `post_hashtags(tag text, post_id, created_at, PK (tag, post_id), index (tag, created_at desc, post_id desc))` where `created_at` copies the post's for the keyset. Comments carry mentions only (hashtags in comments add nothing).
- `PostsService.create/update` and `CommentsService.create/update`: resolve mentioned usernames to existing users (unknown names are ignored, never an error), replace the entity rows in the same transaction, emit `UserMentionedEvent(actorId, targetUserId, postId, commentId?)` per **new** mention (B4 listens; B1 itself records nothing in activities, which are "what followed people did").
- Response shapes: `postSchema` and `commentSchema` gain `mentions: UserSummary[]` (resolved at read, so renames stay correct) and posts gain `hashtags: string[]`. The web links only resolved mentions; `@nobody` stays plain text. If a mentioned member renames, the token no longer matches and renders plain. Accepted edge case.
- `GET /tags/:tag/posts?cursor=` (post list via the join, `postSelect(viewerId)` as everywhere); `GET /tags/trending?limit=` (counts over the last 7 days, cached in memory for 60 s). `tagParamSchema` normalises case.

Web

- `components/rich-text.tsx`: renders tokens (mention → `UserLink`, hashtag → `Link to="/tags/:tag"`, url → external anchor); used by `PostCard`, `CommentItem` and the chat bubble text (URLs only there). Replaces the plain `whitespace-pre-wrap` text.
- `/tags/:tag` page (lazy, `PostList`, title "#tag", empty state) and a **Trending** card in the right bar under Suggestions (hidden when empty).
- Composer and comment editor: `@` autocomplete popover (shadcn `Command`, results from `GET /users?q=`, keyboard navigable, inserts `@username `), reusing `insert-text.ts`. `#` autocomplete is not in this slice.
- Seed: a handful of posts with `#weekend`, `#beso`, mentions between alice/bob/carol.

Tests: shared parser (boundaries, emails, trailing punctuation, Unicode tags, limits) ~15; int (resolution, unknown mention ignored, re-parse on edit removes stale rows, tag feed with cursor, case folding, trending); web (rich text, autocomplete, tag page); e2e (post with a tag → tag page lists it; mention links to the profile); `/tags/:tag` in the a11y spec. Bundle: the popover adds to the first paint (composer is in the entry chunk); load the autocomplete list lazily or raise the budget with the reason in the commit.

### B2. Post pages and search · M · ADR 0014 "Search in Postgres" · ✅ 2026-10-19

**Decision (owner): a `/search` page with People and Posts tabs; `/users` stays the directory.**

Post page

- `/p/:postId` (lazy, in the posts feature `routes.tsx` with the tag page from B1): `PostCard` in an expanded variant (comments open, no collapse, larger picture), page title "Post by Alice", 404 state "This post is gone" (deleted or unknown), error state. `GET /posts/:id` exists.
- Permalink everywhere: the card's timestamp becomes a link; `PostMenu` gets "Copy link" for everyone (not only the author) via the Clipboard API with a toast; activity excerpts link to `/p/:id` (backlog item); the comment sort control survives in the URL (`?sort=`).
- `?comment=<id>` highlights and scrolls to a comment (used by B4 notifications). If the comment is not on the first page it is fetched alone through a new `GET /comments/:id`; a focused ring, no cross-page scrolling logic.

Search

- Migration `post_search`: `posts.search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED` + GIN index. `simple` because the content is multilingual (Bulgarian and English); stemming can come later with a per-language column. People search keeps the existing `ILIKE` (names are short; FTS gains nothing).
- `GET /search/posts?q=&cursor=`: filter `search_vector @@ websearch_to_tsquery('simple', $q)` through a `Prisma.sql` fragment inside the existing `postSelect(viewerId)` query, ordered `createdAt desc, id desc` so the normal keyset applies. No relevance ranking in v1 (a ranked cursor like `?sort=top` on comments is the upgrade path). `q` is trimmed, 2–100 chars; a `#tag` query redirects to the tag page on the web.
- Web: a search box in the header (desktop) and the navigation sheet (mobile), debounced, Enter navigates to `/search?q=…`; `/search` page with **People** and **Posts** tabs (`?type=`), People reusing the `UsersPage` list component.

Tests: int (match, phrase and `-exclusion` syntax of `websearch_to_tsquery`, cursor, no SQL injection through `q`, `GET /comments/:id`); web (post page, 404, copy link, search page and header box); e2e (open a post from the feed by its timestamp, search a seeded phrase); `/p/:id` and `/search` in the a11y spec.

### B3a. Chat bubbles · L · ADR 0009 amendment ("Chat surfaces") · ✅ 2026-10-19

Owner's request of 2026-10-19 (desktop sketch: four bubbles stacked on the right edge, the newest
at the bottom with its unread badge, two chat windows docked at the bottom, side by side, to the left
of the column; phone sketch: the Messenger pattern, a horizontal row of bubbles across the top and
the open conversation filling the screen below it). This brings back the legacy app's "chat heads +
up to two windows" on top of the persisted conversations. All points were settled on 2026-10-19
(§9, second table).

**Vocabulary.** A *bubble* is a round `ConversationAvatar` in the column at the right edge. A
*window* is a docked mini thread (header, messages, composer) at the bottom, left of the column.
The *layer* is the fixed overlay that holds both; it lives in `AppShell` inside `RequireAuth`, above
the page but below Radix dialogs, sheets and toasts, and is loaded lazily the first time it has
something to show (nothing in the first paint).

**Rules**

| # | Event | Result |
|---|---|---|
| 1 | `message:new` from another member of conversation C arrives while the viewer is **not** on a `/messages/*` route and the preference is on | C's bubble appears at the bottom of the column (moves there if already shown) with the conversation's unread count as badge; C is removed from the *hidden* set if it was there. The Messages nav badge counts as today. |
| 2 | Same, but C already has an open window | No bubble change; the window shows the message and marks C read (rule 7). |
| 3 | A fifth conversation arrives | The oldest bubble without an open window is evicted (its unread stays in the nav badge). |
| 4 | Click / Enter on a bubble | Opens C's window docked at the bottom, next to the column. Two windows at most: a third replaces the least recently opened one, whose bubble stays. Opening marks C read. |
| 5 | Window "–" (minimise) or `Escape` inside it | Closes the window; the bubble stays with its badge. |
| 6 | Bubble **X** | Removes the bubble and closes its window if open; C goes into the *hidden* set until its next incoming message (rule 1 clears it). Unread stays. |
| 7 | Read marks | `markRead(C)` runs only while C's window is open and the document is visible: on open, on each incoming message, on regaining visibility. A bubble alone never marks anything read, so the sender sees "Seen" only when the window is open. |
| 8 | Navigating to any `/messages/*` route | The whole layer is cleared (bubbles and windows); nothing comes back on leaving the page until a new message arrives. While on `/messages/*` rule 1 does nothing. |
| 9 | Own messages (sent from this or another tab or device) | Never create or raise a bubble; a `conversation:read` for the viewer's own mark (L9 fix, below) lowers the badge. |
| 10 | Preference "Show chat bubbles for new messages" off (Settings) | The layer is never mounted. Default on. |
| 11 | Sign-out, account switch | State is per tab and in memory; `RequireAuth` remounting drops it. Nothing is persisted across reloads (after a reload only the nav badge remains). |
| 12 | Phones (below `md`) | The column becomes a **horizontal row** of bubbles pinned under the header (newest on the right, badges on the bubbles, the X always visible since there is no hover). Tapping a bubble opens that conversation as a **full-width panel** that covers the page below the row; one panel at a time, tapping another bubble switches, tapping the active bubble, a chevron in the panel header or the browser back gesture minimises it. Rules 1–11 are otherwise identical. |

**Window.** Desktop: 320 × 440 px docked at the bottom, left of the column, two side by side at
most. Phone: full width under the bubble row, one at a time. Either way a `role="dialog"` non-modal
panel with `aria-label="Chat with Bob"`, header with `ConversationAvatar`, name (group title for
groups), presence dot or `typingIn` text, "Open in Messages" link (→ `/messages/:id`, which clears
the layer by rule 8), minimise (chevron on phones). Body reuses `Thread` in a compact variant (same
cache under `queryKeys.conversations.messages(id)`, day separators, receipts, sender names in
groups, older history on scroll-up). Footer reuses `MessageComposer` as is (text, emoji, picture,
typing signal). Focus moves into the window on open and back to the bubble on minimise; scrollable
list has `tabIndex={0}`. Dialogs, sheets and toasts stay above the layer.

**Bubble.** 48 px button, `aria-label="Open chat with Bob, 2 unread"`, badge from the conversation's
`unreadCount`, tooltip with the name, small X (`aria-label="Hide"`) on hover/focus on desktop and
always on phones, presence dot. The column (desktop) and the row (phone) are one component with a
`direction` prop; the breakpoint is Tailwind's `md`, read with a `useMediaQuery` so a resize moves
the open windows (two open on desktop → the most recent stays open on a phone-width viewport).

**State.** `features/chat/bubbles/` with a reducer in a `ChatBubblesProvider` fed by the existing
`ChatProvider` (one socket; the provider exposes `onMessage` subscriptions rather than a second
listener): `{ bubbles: conversationId[] (bottom = last), windows: conversationId[] (max 2),
hidden: Set<conversationId> }`; actions `arrive(C)`, `open(C)`, `minimise(C)`, `dismiss(C)`,
`clearAll()`. Route awareness through `useLocation` in the layer. Unread counts come from the
conversation list cache (`patchConversation` keeps `.list` and `.detail` in step), so a window and
the Messages page never disagree.

**API / shared.** Preferences infrastructure (also used by B3b and B4): migration `user_settings`
adds `users.settings jsonb not null default '{}'`, validated by `userSettingsSchema` in shared
(`{ chatBubbles: boolean (true), messageSound: boolean (false), browserNotifications: boolean (false) }`,
unknown keys dropped, defaults applied at read), exposed as `settings` on `UserPrivate`, changed
through `PATCH /users/me/settings` (partial). Fix L9 while here: `ConversationReadEvent` also goes
to the reader's own room, so other tabs lower their badges.

**Web (Settings).** New **Chat** card: "Show chat bubbles for new messages" switch (optimistic,
toast on failure); stored server-side in `users.settings` so it follows the account. Seed: nothing
new (bob's unread picture already triggers a bubble for alice on the first push in dev).

**Tests.** Web with `fakeSocket` (push → bubble with badge; second push → badge 2; click → window
with the thread and `markRead` called once; push into the open window marks read; minimise keeps the
bubble; X hides and a later push brings it back; fifth conversation evicts the oldest; third window
replaces the oldest; navigating to `/messages` clears everything; preference off → nothing; phone
width → row at the top, one full-width panel, switching between bubbles). Int: settings schema and
patch, own-room read push. E2E (`chat.spec.ts`): bob writes while alice is on the home feed →
bubble → alice opens it and replies → bob sees "Seen"; `mobile.spec.ts`: the row and the panel on
carol's phone viewport; axe on the open state (bubbles + one window) in both themes and viewports.

### B3b. Chat follow-ups · M–L · ADR 0009 amendment · ✅ 2026-10-19

**Decision (owner): system lines are in.**

- **Delete a message** (sender only, any age): soft delete, `messages.deleted_at`, content cleared and `image_key` discarded on delete; the row stays so ordering and read marks hold; shape gains `deletedAt` and the bubble shows "Message deleted". `DELETE /conversations/:id/messages/:messageId`; `MessageDeletedEvent` → `message:deleted` push → `message-cache.ts` patches the bubble. Conversation snippet recomputed from the newest non-deleted message. *Built as: the newest message stays the snippet and reads "Message deleted", so the push alone keeps every client in step.*
- **Group roles**: `conversation_members.role enum (admin | member)`, creator is admin (migration backfills from `created_by_id`). Admins rename (`PATCH /conversations/:id { title }`), remove members (`DELETE /conversations/:id/members/:userId`), promote (`PUT /conversations/:id/members/:userId/role`). Anyone still adds people and leaves (ADR 0009). Last admin leaving promotes the longest-standing member. Removal emits `ConversationLeftEvent` for the removed person (they get `conversation:removed`) and `ConversationUpdatedEvent` for the rest. `GroupMembersDialog` grows the admin actions and a rename field; the thread header title is inline-editable for admins (`InlineEditor`).
- **System lines** for membership changes and renames ("alice added bob", "carol renamed the group"): `messages.kind enum (user | system)` with a small JSON `meta`, rendered centred, excluded from unread counts and from bubble triggers (B3a rule 1 ignores `system`).
- **Reading UX**: "New messages ↓" pill when a push arrives while scrolled up (the thread already knows the scroll position for history loading); unread total in the tab title (`(3) Messages · BeSo`, a `useDocumentBadge` util shared with B4); sound and browser `Notification` for messages while the tab is hidden, both behind the B3a preferences (`messageSound`, `browserNotifications`; permission requested only from the switch).
- **Conversations pagination** (backlog): keyset on `(last_message_at, id)`, `nextCursor` on `GET /conversations`, the list loads more on scroll. No schema change.
- Seed: a deleted message and a system line in "Weekend plans". Tests: int (delete rules and push, roles and 403s, last-admin promotion, system lines, pagination), gateway spec for the new pushes, web (bubble states, pill, title badge, dialog actions), e2e extension of `chat.spec.ts` (delete seen by the other browser, rename).

### B4. Notifications · L · ADR 0015 "Notifications" · ✅ 2026-10-20

*Built as planned, with two deviations recorded in the ADR: no `NULLS NOT DISTINCT` unique and
no partial index (Prisma cannot declare them; the service de-duplicates by lookup, comment
types store `post_id` too, a plain `(user_id, read_at)` index serves the count), and the push
is handled by `ChatProvider` itself (`receiveNotification`) rather than a subscription API
nothing else needs yet. `POST_REPOSTED` arrives with C3b.*

- Migration `notifications`: `notifications(id uuid7, user_id, type enum, actor_id, post_id?, comment_id?, read_at?, created_at)`, indexes `(user_id, created_at desc, id desc)` and a partial `(user_id) where read_at is null`, unique `(user_id, type, actor_id, post_id, comment_id)` nulls-not-distinct so like → unlike → like does not multiply rows. Types: `POST_LIKED`, `POST_COMMENTED`, `COMMENT_REACTED`, `USER_FOLLOWED`, `MENTIONED_IN_POST`, `MENTIONED_IN_COMMENT`, `POST_REPOSTED` (C3b), later `COMMENT_REPLIED` (C2). Chat stays out: it has its own unread counts and bubbles.
- `NotificationsListener` modelled on `ActivitiesListener`: subscribes to `PostLikedEvent`, `CommentCreatedEvent` (recipient = post author), a new `CommentReactedEvent` (emitted by `CommentsService.react` on a new reaction), `UserFollowedEvent`, `UserMentionedEvent` (B1), `PostRepostedEvent` (C3b); never notifies the actor about themselves; `PostUnlikedEvent`/`UserUnfollowedEvent`/`PostUnrepostedEvent` delete the row (same as activities). Coalescing ("alice and 3 others liked…") is deliberately v2: the unique key makes it possible later without a migration.
- API: `GET /notifications?cursor=` (actor summary, post/comment excerpt reusing the activities mapper, `readAt`), `GET /notifications/unread-count` → `{ count }`, `POST /notifications/read` (everything up to now), `POST /notifications/:id/read`. `NotificationCreatedEvent` → gateway `notification:new` to `user:<id>` with the full item; `notification:read` is not pushed (other tabs refetch the count on focus, like `me`).
- Web: bell with badge in the header (desktop) and a **Notifications** nav entry with the badge on mobile; `/notifications` page (infinite list, unread rows tinted, sentence per type from a `notification-text.tsx` next to `activity-text.tsx`, click → `/p/:id?comment=` or the profile); opening the page marks all read; the badge updates from `notification:new` through the chat socket provider (same `onMessage`-style subscription as B3a). Tab title badge shared with B3b.
- Tests: int (one row per event, self-events skipped, unlike removes, read marks, cursor, push to the recipient's room only), web (bell, page, push), e2e (bob likes alice's post in a second context → alice's bell shows 1).

### B5. Moderation basics · L · ADR 0016 "Blocking, reporting and the admin role"

**Decision (owner): admins are bootstrapped from an `ADMIN_EMAILS` env variable.** Two commits.

**B5a – member side: block, mute, report · ✅ 2026-10-20 (ADR 0016, member half)**

*Built as planned. `VisibilityService` is a global module rather than a per-request cache;
the "blocked profile state page" is the reduced header with no tabs; comment counts still
include hidden comments (noted in the ADR).*

- Migration `moderation`: `blocks(blocker_id, blocked_id, created_at)`, `mutes(muter_id, muted_id, created_at)`, `reports(id, reporter_id, target_type enum (post | comment | user), target_id uuid, reason enum (spam | harassment | hate | sexual | violence | other), details text?, status enum (open | resolved | dismissed), created_at, resolved_by_id?, resolved_at?)`.
- Block effects (both directions, enforced in services, never the client): posts, reposts and comments hidden from each other's feed, profile posts, tag pages, search and activity; profile answers a reduced shape with `blocked: true` / `blockedMe: true` and no counts; follow rows removed on block and new follows refused (403 `BLOCKED`); comments on each other's posts refused; `ensureDirect` refused and existing direct threads hidden from the list while the block stands; mentions do not notify; suggestions exclude both. Implemented once as `VisibilityService.hiddenAuthorIds(viewerId)` (blocked ∪ blockers ∪ muted for feeds) injected into the `where` of the list queries, cached per request.
- Mute: one direction, hides the muted person's posts from my feed, tag pages and search and suppresses their notifications to me; they can still see and interact with me.
- Routes: `PUT/DELETE /users/:id/block`, `PUT/DELETE /users/:id/mute`, `GET /users/me/blocked`, `GET /users/me/muted`, `POST /reports` (one open report per reporter and target; 10/h).
- Web: profile header menu (Block, Mute, Report), `PostMenu` and comment menu gain Report (dialog with reason + details) for non-authors; Settings → **Privacy** card lists blocked and muted people with Unblock/Unmute; blocked profile state page.

**B5b – admin role and queue · ✅ 2026-10-20 (ADR 0016, admin half)**

*Built as planned; `ADMIN_EMAILS` is authoritative only when set (an empty list leaves the
seed's roles alone), and the queue hydrates each report's target per page rather than storing
a snapshot.*

- Migration `user_roles`: `users.role enum (member | admin)` default member, `users.suspended_at?`. Bootstrap: `ADMIN_EMAILS` (comma-separated) promotes matching accounts at startup and on login; removing an address from the list demotes on the next start.
- `@Roles('admin')` metadata + `RolesGuard` after the `AuthGuard`; the access token carries `role` next to `ev` (`AuthUser` gains `role`).
- Routes under `/admin`: `GET /admin/reports?status=&cursor=` (with target excerpt and reporter), `POST /admin/reports/:id/resolve|dismiss`, `DELETE /admin/posts/:id`, `DELETE /admin/comments/:id` (reuse the services with an `asAdmin` flag so events and image discard run), `POST /admin/users/:id/suspend` / `unsuspend` (suspension deletes refresh tokens and disconnects sockets; login answers 403 `SUSPENDED`; the content stays but is hidden by `VisibilityService`). Every admin action writes an `admin_actions` audit row.
- Web: `/admin` lazy route guarded by `role` (hidden from nav for members; direct visit → 404 page), a reports table with filters, target preview and the actions; `userPrivateSchema` gains `role`.
- Tests: int for every visibility rule (feed, profile, tags, search, comments, direct chat, suggestions), report limits, guard 403s, suspension end to end; web (menus, dialogs, Privacy card, admin page); e2e (bob blocks alice → alice sees the blocked profile and bob's posts vanish from her feed; a carol report shows up for an admin).

### B6. `#` autocomplete · S · ✅ 2026-10-20

Pulled from the backlog on 2026-10-20 (owner); B1 left it out on purpose.

- API: `GET /tags/suggest?q=` → `{ items: [{ tag, count }] }`: distinct tags starting with `q` (folded like `TagParamDto`, 1–50 chars) among the posts of the last 90 days, ordered by count then tag, at most 8; served by the existing primary key `(tag, post_id)`. Same module as trending (`tags/`); the 60 s cache the backlog mentions for trending applies to both if the query log ever asks.
- Web: `MentionTextarea` gains a second trigger: `#` followed by at least one character opens the same listbox with tags (`queryKeys.tags.suggest(q)`), Enter or Tab inserts `#tag `, and a `q` with no match offers nothing (the writer still types a new tag). The composer, the comment box and `InlineEditor` get it without changes.
- Tests: int (prefix, folding, window, limit), web (both triggers in one textarea, keyboard), e2e in `tags.spec.ts`.
- As built (2026-10-20): as planned; the prefix query (`tagSuggestQuerySchema`) folds like a tag but needs no letter yet, the answers reuse `trendingTagListSchema`, and the listbox is labelled "Tags" with the post count per tag. No cache yet (nothing in the query log asks for one).

---

## 4. Track C – gaps not written down before

### C1. Newcomer experience · removed 2026-10-20

Dropped by the owner (reverses Q8 in §9). The explore feed, the empty-feed state and the one-time
"follow people" step are parked in `BACKLOG.md` (Web). The slice id stays so the others keep
their names.

### C2. Comment replies · M · ✅ 2026-10-20

- One level only (Instagram style): `comments.parent_id?` (migration `comment_replies`), replies listed under their parent (`GET /comments/:id/replies?cursor=`), `replyCount` on top-level comments, the post's `commentCount` counts both. Reply to a reply inserts `@username` and attaches to the same parent. Notification `COMMENT_REPLIED` to the parent author (B4). Web: "Reply" action, "View N replies" expander, composer in context. Tests as usual; e2e in `comments.spec.ts`.
- As built: a reply is created through the existing `POST /posts/:postId/comments` with `parentId` (the API folds a reply to a reply under its parent; another post's comment is a field error); `replyCount` is a relation count, not a column; replies are listed oldest first (`keysetAfterAscending`); the post's author is told of a reply too (`POST_COMMENTED`) unless the reply was to their own comment, and a reply that names the parent's author does not mention-notify them a second time; the web folds every thread by default, unfolds it for a permalinked reply (`?comment=` on a reply pins its parent and itself), and keeps one reply composer open at a time. v2.6 is complete.

### C3. Bookmarks and reposts · S + L · ADR 0017 "Feed items"

**Decision (owner, 2026-10-19): reposts are in.** Two commits.

**C3a – Bookmarks · S · ✅ 2026-10-20**

- `bookmarks(user_id, post_id, created_at)`, `PUT/DELETE /posts/:id/bookmark` (idempotent, optimistic like likes with `withBookmark`), `GET /users/me/bookmarks?cursor=`, `bookmarkedByMe` on `postSchema`, a bookmark icon on the card, `/bookmarks` page via `PostList`, link in the account menu. Private to the member (no counts shown). *Built as planned; the list's keyset is the bookmark's own time, the export carries `bookmarks`, no ADR (ADR 0017 comes with C3b).*

**C3b – Reposts, with an optional quote · L · ✅ 2026-10-20 (ADR 0017)**

*Built as planned, with one deviation recorded in the ADR: the feed item is `postSchema` with
`repost: {…} | null` rather than a separate `feedItemSchema`, so every list shares the post
caches. The activity "bob reposted alice's post" uses `targetUser` for the author, which closes
the backlog's "post excerpts without author". v2.5 is complete.*

**Decision (owner, 2026-10-19): reposts carry an optional text.** One control, two outcomes: the
repost button opens a small popover with "Add your thoughts (optional)" and a **Repost** button. Empty
text → a plain repost; text → a quote post. A quote is a real post (likeable, commentable, has a
permalink, is searchable, parses mentions and hashtags) that embeds the original; a plain repost is
a pointer. That is the Twitter model and keeps every existing list, cache and mapper working on
`Post`.

- Plain repost: a repost of a repost acts on the original; own posts cannot be reposted (400); one plain repost per member and post, toggling off removes it. Quotes are not toggles: a member can quote the same post more than once, and deletes a quote like any post.
- Migration `reposts`: `reposts(id uuid7, user_id, post_id, created_at, unique (user_id, post_id), index (user_id, created_at desc, id desc))`; `posts.quoted_post_id uuid? (FK, onDelete SetNull)` and `posts.was_quote boolean default false` (so a quote whose original was deleted still renders "This post is unavailable"); `posts.repost_count` denormalised (plain reposts + quotes, as Twitter counts them; same approach as `reactions_count`). `postSchema` gains `repostCount`, `repostedByMe` (plain repost state) and `quotedPost: PostEmbed | null` where `PostEmbed = { id, author: UserSummary, content, imageUrl, createdAt } | { unavailable: true }`; `createPostSchema.quotedPostId?` (a quote always has text; without text the action is a plain repost, so the schema keeps `content` required). Embeds render one level deep: quoting a quote shows its text, not its own embed.
- **Feed item shape**: the list item stays a `Post`, extended with `repost: { by: UserSummary, at: datetime } | null` (`feedItemSchema = postSchema.extend(...)`). The home feed becomes a union of originals (quotes included, they are posts) and plain reposts ordered by `sortAt = coalesce(repost.created_at, post.created_at)`; one row per post, the newest occurrence wins (grouped subquery on `post_id` taking `max(sortAt)` and the matching reposter), so the same post never appears twice on a page. Done with a raw id-selection query (`Prisma.sql`, `UNION ALL` + `DISTINCT ON`) that returns `(post_id, sort_at, repost_id?)` for the page, then hydrated with the normal `postSelect(viewerId)`, which now also selects the embed. Cursor = `(sortAt, postId)` through `encodeRankedCursor`-style packing. `GET /users/:id/posts` gains `?include=reposts` (default on) so a profile shows what the person reposted, with the "Reposted" header.
- Events: `PostRepostedEvent` / `PostUnrepostedEvent` and `PostQuotedEvent` → activities `POST_REPOSTED` / `POST_QUOTED` ("bob reposted alice's post", needs the excerpt with author from the backlog) and notifications `POST_REPOSTED` / `POST_QUOTED` to the author (B4); unrepost and deleting a quote remove them.
- Web: repost button on the card between like and comment (count, filled when `repostedByMe`); the popover with the optional text and the embedded card preview; plain repost optimistic via `withRepost`, a quote goes through the normal create-post path and is prepended to the feed; "🔁 Bob reposted" header line on feed items with `repost`, the reposter's name links to the profile; `QuotedPostCard` embed (author, text, picture, timestamp, links to `/p/:id`, "This post is unavailable" state). `post-cache.ts` helpers match items by `post.id`, so a like on a reposted item updates its original wherever shown; a like on a quote updates the quote only. Hashtags, search and bookmarks index originals and quotes; nothing indexes plain reposts. B5a hides embeds of blocked authors behind the unavailable state.
- Seed: a few reposts and one quote between the fixed accounts. Tests: int (toggle, own-post refusal, quote creation with and without a valid original, feed union and dedupe, cursor stability when a repost is removed mid-page, profile include, counts, deleted-original embed, events), web (popover both outcomes, header line, embed states, optimistic rollback), e2e (bob reposts alice's post → it appears in carol's feed, who follows only bob; bob quotes it → the quote shows the embed).

### C4. Private accounts and follow requests · L · deferred

Needs the same visibility layer as B5 plus a request state on follows and rules for existing
followers when a profile turns private. Parked in `BACKLOG.md` with that note; nothing in B5 should
make it harder.

### C5. Chat extras · M–L · ADR 0009 amendment 3 · ✅ 2026-10-20

Pulled from the backlog on 2026-10-20 (owner). Four pieces, one commit; voice notes stay out.

- **Message editing** (sender only; user messages that are not deleted): `messages.edited_at` and `message_revisions(id, message_id, content, edited_at)` on the pattern of post and comment revisions (`common/revisions.ts`), `PATCH /conversations/:id/messages/:messageId { content }` (unchanged text is a no-op; the picture cannot be swapped, only the text), `GET …/messages/:messageId/revisions`. `MessageUpdatedEvent` → `message:updated` push with the full message to every member → `replaceMessage` in the cache (the path `message:deleted` already uses); the list snippet follows. Web: "Edit message" in the own-message options menu → `InlineEditor` in the bubble, `EditedMarker` with the history; chat windows and bubbles get it for free (same `Thread`). Editing moves no read mark and raises no bubble.
- **Reactions on messages**: `message_reactions(message_id, user_id, type ReactionType, created_at)`, primary key (message, user): one reaction per member, switching updates it. `PUT/DELETE /conversations/:id/messages/:messageId/reaction`; the message shape gains `reactions: ReactionSummary` (counts per type and `mine`), computed per page with one `groupBy` like comments; no denormalised counter, threads are not sorted by it. The change goes out as the same `message:updated` push. Web: `ReactionBar` reused under the bubble (pills + picker; long-press on phones), optimistic with `withMyReaction`; a reaction is nobody's unread, raises no bubble, plays no sound. System lines and deleted messages take no reaction and cannot be edited.
- **System lines for role changes and group creation**: `writeSystemLine` in `setRole` ("alice made bob an admin", "alice removed bob as admin") and in `createGroup` ("alice created the group"); `systemLineSchema` gains the types, `systemLineText` the sentences.
- **Sound while on another page**: today `MessageAlerts` plays the sound and shows the browser notification only while the tab is hidden. New rule for the sound (`messageSound`): it also plays, in a visible tab, for a message whose conversation is not on screen there (no open chat window, not the open thread) — exactly when a bubble appears or the Messages badge goes up. The browser `Notification` stays hidden-tab only (a visible tab shows the bubble instead). No new preference key.
- Tests: int (edit rules incl. 403 for others and 400 for deleted or system lines, revisions, reactions and their push, the new lines), gateway spec for `message:updated`, web (editor in the bubble and in a chat window, reaction pills, the snippet following an edit, the sound rule), e2e extension of `chat.spec.ts` (an edit and a reaction seen live by the other member).
- As built (2026-10-20): the message carries `reactions` as the plain `[{ userId, type }]` list instead of a `ReactionSummary` (one push serves every member; the client sums it), the picker lives in the bubble's hover toolbar with pills below (no long-press), `subscribeToMessages` listeners get `{ onScreen }` so the sound rule and the bubbles agree, and the export carries message revisions and reactions. The chat-window variant of the editor is covered by the shared `Thread`, not by a test of its own.

### C7. Realtime activity · S

Pulled from the backlog on 2026-10-20 (owner). *What it is:* the "Latest activity" card in the
right bar and the `/activity` page are fetched when a page mounts and refetched when the tab
regains focus; between those moments a post, like, comment or follow by someone the viewer
follows does not show up until a reload. With this slice it appears the moment it happens,
the way a message or a notification does.

- API: `ActivitiesListener` emits `ActivityRecordedEvent(activity, actorId)` once the row is written (the item already shaped by `toActivity`); the gateway answers with `activity:new` to the rooms of the actor's followers (`FollowsService.followerIds(actorId)`, one query; capped at 1 000 ids, which no demo account reaches) and never to the actor. Removals (unlike, unfollow) push nothing: the row disappears at the next fetch, as today.
- Web: `ChatProvider` hands the push to `receiveActivity` (`use-activities.ts`: `prependItem` into `queryKeys.activities.list` when it is loaded); the card keeps showing its six newest, the page its full list. No badge, no sound, nothing stored.
- Tests: int (push to followers only, never to the actor or a stranger), gateway spec, web (push → card and page), fake socket schema map.

### C6. Scheduler and reapers · S · ✅ 2026-10-20 (ADR 0012 amendment)

- `@nestjs/schedule` (catalog entry, `allowBuilds` check) with a `JobsModule`; jobs guarded by a `JOBS_ENABLED` env so only one container runs them. Daily: orphaned uploads older than 24 h (rows and files, through `StorageService`), expired `email_tokens` and `refresh_tokens`, unverified accounts older than 30 days (backlog; mail a warning at day 23), notifications older than 90 days (B4). Each job logs counts. Int test per job with a frozen clock.
- *Built as:* `jobs/` with `JobsService.runDaily(now)` (the jobs in order, one failure never stops the next, overlapping runs skipped) and `JobsScheduler` (registers the 04:00 UTC cron only when `JOBS_ENABLED`); each job lives with its table (`EmailTokensService.deleteExpired`, `RefreshTokensService.deleteExpired`, `UploadsService.deleteOrphans`, `AccountService.warnUnverified` / `eraseUnverified` over the shared `erase` that `DELETE /users/me` uses). The warning mail carries a fresh confirmation link and the removal date; `users.expiry_warned_at` makes it go out once. **B4 adds the notifications prune as one more entry in `JobsService`.**

---

## 5. Track D – account depth

### D1. Email change and sessions · M · ADR 0010 amendment · ✅ 2026-10-20

- Email change: `users.pending_email?`, token kind `change_email` (24 h) sent to the **new** address, notice to the old one; `POST /auth/email` `{ newEmail, password }` (uniqueness checked at request and again at confirm), `POST /auth/email/confirm` `{ token }` swaps the address and voids the pending state; the address stays read-only in the profile dialog, the change lives in Settings → **Email** with "Pending: new@…, resend / cancel". Re-send verification from the same card for unverified sessions (the waiting room already has it).
- Sessions: `GET /auth/sessions` from `refresh_tokens` where `revokedAt is null` (`id, userAgent (parsed to "Chrome on Windows"), ip (masked last octet), createdAt, lastUsedAt, current`), `DELETE /auth/sessions/:id` (deletes the row; that device's access token runs out within 15 min, as documented). Needs `last_used_at` stamped on rotation (migration). Settings → **Sessions** card becomes a list with "Sign out" per row and keeps "Sign out everywhere".
- Tests: int (change flow incl. taken address and expired token, notice mails in the outbox, sessions list and single sign-out), web (cards), e2e (sessions list shows the Playwright browser).
- As built (2026-10-20): the change form is shared with the waiting room (`EmailChangeForm`: a mistyped address is fixed before the account opens, and the confirmation marks the new address verified); the `change_email` kind has no cooldown (hourly cap and route throttles instead); `POST /auth/email/confirm` is public and answers `{ email }` only; the link lands on `/confirm-email`; re-sending the *verification* stays in the waiting room (Settings is not reachable unverified). Sessions are ordered by last activity; the row's id changes with each rotation (the chain keeps `createdAt`).

### D2. Richer posts · M–L · ✅ 2026-10-21

- Uploads store `width`, `height`, `bytes` (migration `upload_dimensions`, backfilled from the files on disk once), so every image response carries dimensions → `width`/`height` attributes and `srcset` end layout shift (performance item). Several pictures per post: `post_images(post_id, position, key)` with the single `image_key` migrated into it, `createPostSchema.imageKeys` (max 4), a grid on the card, swipe on phones, a lightbox (backlog) shared with chat pictures and profile covers. Link previews are **not** in this slice (SSRF-safe fetching, caching and a queue are their own piece of work; backlog).
- As built (2026-10-21, started by the owner ahead of C7): one migration `richer_posts` instead of `upload_dimensions`. `uploads.width/height/bytes` are written at upload time; files stored earlier are measured by a daily job (`UploadsService.fillSizes`, reading them back through `StorageService`) rather than by a one-off script, so nothing has to be run by hand after the deploy and a file that cannot be read stays without a size (the page then does not reserve its space). `post_images.key` and `messages.image_key` became foreign keys to `uploads.key` (the migration first creates any missing upload row, so it cannot stop a deploy); responses read the size through them as `StoredImage` (`{ url, width, height }`): `images` on posts and quote embeds, `image` on messages. `imageUrl` stays next to them (the first picture) and `createPostSchema.imageKey` is still accepted, both only for tabs opened before the deploy (they parse the old shape); dropping them is in `BACKLOG.md`. The card shows one picture in its own proportions within the height limit and two to four in a 16:9 grid (three: one tall on the left); the composer takes several files at once, each uploading on its own with remove and retry. The lightbox (`components/lightbox.tsx`, its dialog a lazy chunk of 1.4 kB gz) serves post pictures, chat pictures (they used to open a new tab) and the profile cover and avatar; it wraps around rather than disabling its arrows, swipes on touch, and hands focus back to whatever opened it. Quote embeds show the pictures without opening them. Bundle budget 256 → 258 kB (256.2 measured).

### D3. Two-factor authentication (TOTP) · M · ADR 0020 (0018 and 0019 went to E4)

- `user_totp(user_id, secret_encrypted, enabled_at, recovery_codes_hashed[])`, `otplib`; enrol from Settings (QR + confirm code), login becomes two steps when enabled: `POST /auth/login` answers `{ mfaRequired: true, ticket }` (short-lived signed ticket, no cookies yet) → `POST /auth/login/totp { ticket, code | recoveryCode }` → session. Password reset by mail still clears the way (the roadmap's reason to do this after email). Rate limits per ticket. Web: a second step on the sign-in page, Settings → **Security** card.

### D4. Picture cropping · S–M

Pulled from the backlog on 2026-10-20 (owner). Profile pictures only: the avatar is shown round
and the cover wide, so a member should choose which part of a photo is kept instead of getting
the centre cut the API presets take today.

- Web: after a file is chosen in the edit-profile dialog, a cropper replaces the preview (fixed aspect: 1:1 for the avatar, 3:1 for the cover; drag to move, wheel/pinch and +/- buttons to zoom, arrow keys to move, every control labelled), "Use this" draws the chosen area to a canvas and hands the blob to `useImageUpload(kind)` as today; the API presets keep resizing and converting (a cropped file is just a smaller file; no API change). `react-easy-crop` pinned in the catalog and loaded lazily inside the dialog, so the first paint carries nothing. Post and chat pictures stay uncropped.
- Tests: web (the upload receives the cropped blob, keyboard operation, cancel keeps the old picture), e2e extension of `profile.spec.ts` (change the avatar through the cropper), axe on the dialog with the cropper open.

Shipped 2026-10-21 with one deliberate departure from "no API change": the cover preset was 1600×600 (8:3) while the profile header and the field preview show 3:1, so the browser cropped a second time whatever the member chose. `PROFILE_PICTURE_SIZES` in `packages/shared` (avatar 512², cover 1800×600) now feeds both the API presets and the cropper's ratios; sharp's `attention` crop stays as the fallback for files uploaded uncropped (API clients, e2e).

---

## 6. Track E – polish and operations

- **E1 Performance**: `zod/mini` build of `packages/shared` for the browser (tsdown second entry), font preload for the Latin Inter subset, `fetchpriority="high"` on the first feed image, route chunk prefetch on link hover, measured with Lighthouse before and after (baseline in the backlog: feed 64, profile 74 on mobile).
- **E2 PWA + web push**: manifest, icons, a minimal service worker (no offline cache of API data), `push_subscriptions(user_id, endpoint, keys)` with `web-push` (VAPID keys in env), a `NotificationsListener` fan-out to subscriptions; the switch joins the B3a preferences.
- **E3 Observability**: error tracking (GlitchTip self-hosted on the box or Sentry's free tier; `@sentry/node` + `@sentry/react`, DSNs by env, request id attached), `enableShutdownHooks({ useProcessExit: true })` so pino flushes, route `ECONNRESET`/`EPIPE` through pino at debug (backlog), a status page later.
- **E4 Code structure** (backlog) · ✅ 2026-10-22 except the emoji picker line: `TokensModule`, `HttpExceptionFilter` → `ApiExceptionFilter`, event-name casing, `@ZodResponse` everywhere (started in A4), `migrate` as a one-shot image so the API image loses the Prisma CLI.
  *As built (2026-10-22, owner: "full fixes, downtime is fine"):* `tokens/` (`AccessTokensService` is the only user of the JWT secret; the global guard and the gateway import `TokensModule`); the filter renamed and taught to tell a response mismatch (`ZodSerializationException`, a logged masked 500) from a request validation error, which the duck-typed check had confused; `user.profileUpdated` → `profile.updated`, `auth.sessionsRevoked` → `sessions.revoked`; `@ZodResponse` on all 63 JSON handlers (ADR 0019, OpenAPI now 3.1); the migrate image (ADR 0018) needed a `.pnpmfile.cjs` because `@prisma/client`'s optional peer put the CLI back into the production install (API image 963 → 602 MB, not the 450 MB estimated); `update.sh` reworked with it, which also closes review L19–L21 from A1 (only our images pulled, all or nothing; the tunnel token in the environment; the password rule written where it is set) and runs the migrations on their own first because compose removes the old API container before a failing `migrate` inside `up -d`. Owner steps: make `beso-migrate` public, refresh `deploy/` (RUNBOOK §4.1).
  Maintenance (added 2026-10-20): upgrade `emoji-picker-react` 4.22 → 5.x — the emoji picker behind the composer and the chat composer; 5.0.0 shipped on 2026-10-10 as a major version with a changed API, so wait for a few weeks of fixes (not before November 2026), then re-check the lazy chunk's size and the keyboard behaviour of the picker.

---

## 7. Dependencies

```
B1 mentions ──► B4 notifications (UserMentionedEvent)
B2 post page ──► B4 notifications (link targets), B5 reports (target preview), C2 replies (?comment=)
B3a bubbles ──► B3b (preferences infra, Settings Chat card), B4 (socket subscription pattern), E2 (switch)
B3b chat ──► B4 (useDocumentBadge)
B5a block/mute ──► C4 private accounts
B1 mentions, B2 permalink ──► C3b quotes (parsed text, embed links)
C3b reposts ──► B4 (POST_REPOSTED, POST_QUOTED), B5a (hidden reposts and embeds)
C6 scheduler ──► B4 (pruning), D1 (token expiry), uploads reaper
D2 dimensions ──► E1 srcset
B4 notifications ──► E2 web push, C7 realtime activity (the push path through ChatProvider)
B3b chat ──► C5 chat extras (message cache, system lines, the options menu)
B1 mentions ──► B6 # autocomplete (MentionTextarea)
A2, A3 ──► the opening; A4 ──► nothing
```

---

## 8. Per-slice definition of done

1. Shared schemas and constants in `packages/shared` (never duplicated), API module with DTOs via `createZodDto`, migration committed with the schema change, seed extended when the feature has demo value.
2. Unit tests for parsers and mappers, integration tests for every route and rule, web tests for every new page and state, one e2e scenario, new pages added to `e2e/a11y.spec.ts`.
3. `pnpm check`, `pnpm test:int`, `pnpm --filter @beso/web e2e` green; `pnpm format:check` clean; bundle budget respected or raised with the reason in the commit message.
4. Docs: a row in `REBUILD_PLAN.md` §4.12, `ROADMAP.md` item struck or moved, deferrals to `BACKLOG.md`, the ADR when the slice makes a decision, `CLAUDE.md` conventions when a slice introduces one (e.g. `RichText`, `VisibilityService`, `useDocumentBadge`, the bubbles layer), runbook for new env variables.
5. One commit on `dev`, message `feat(scope): …` with the slice id, the owner commits.

---

## 9. Decisions taken in the review (2026-10-19)

| # | Question | Decision |
|---|---|---|
| Q1 | Go-live set before mentions? | No. The site opens around 2026-10-29; keep the agreed order (B1, B2), land A2 and A3 before the opening, fix and change freely afterwards. |
| Q2 | Turnstile beyond register? | Register only. |
| Q3 | Search page layout | `/search` with People + Posts tabs; `/users` stays the directory. |
| Q4 | `@` autocomplete | Inside B1. |
| Q5 | Account deletion and other people's threads | Erase (cascade). |
| Q6 | Chat system lines | Yes. |
| Q7 | Admin bootstrap | `ADMIN_EMAILS` env variable. |
| Q8 | Explore and onboarding | All posts newest first, and the one-time "follow people" step. **Withdrawn 2026-10-20:** C1 removed from the plan, parked in `BACKLOG.md`. |
| Q9 | Reposts | In scope (C3b), with an optional quote text. |
| Q10 | Notifications before chat? | No, chat (B3a, B3b) first. |
| Q11 | Versions | Minors v2.3 … v2.6. |
| — | New: chat bubbles | Added as B3a, first slice of v2.4. |

### Second round (chat bubbles and reposts, 2026-10-19)

| # | Point | Decision |
|---|---|---|
| Q-B1 | Phones | A horizontal bubble row under the header, the open conversation as a full-width panel below it (Messenger pattern, the owner's second sketch); one panel at a time. |
| Q-B2 | Reload | In memory per tab; after a reload only the Messages badge remains. |
| Q-B3 | Groups | Group messages raise bubbles too. |
| Q-B4 | Fifth conversation | The oldest bubble without an open window is evicted. |
| Q-B5 | Third window | Replaces the least recently opened one; its bubble stays. |
| Q-B6 | Window composer | The full `MessageComposer`, pictures included. |
| Q-B7 | The switch | Settings → Chat card, stored server-side in `users.settings`. |
| Q-B8 | Window X vs minimise | The window only minimises; the X that removes lives on the bubble. |
| Q-B9 | Layer order | Above the page, below dialogs, sheets and toasts. |
| Q-B10 | "Seen" semantics | Confirmed: read marks only from an open window (or the Messages page); a bubble never marks read. |
| Q-R1 | Quote posts | In: the repost popover has an optional text; text makes a quote post, no text a plain repost. |
| Q-R2 | Reposts in the feed | One row per post, the newest of the original or a plain repost from someone I follow; quotes are distinct posts. |

No open points remain; the plan is ready to start with B1.
