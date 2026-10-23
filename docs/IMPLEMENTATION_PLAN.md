# Implementation plan (after R1, 2026-10-19)

**Status:** v0.6 — on 2026-10-22 the owner agreed the next stretch after v2.7: Track F, growth and
play (§7: the installable app with push first, then invites, achievements, polls and a weekly
digest, games that others can watch, events and stories, one-to-one calls, a store app), with the
decisions in §10 (third round); monitoring stays in `BACKLOG.md`. Before that, v0.5: on 2026-10-20 the owner removed C1 (newcomer experience, parked in
`BACKLOG.md`) and pulled five backlog items into the plan as v2.7 (C5 chat extras, B6 `#`
autocomplete, C7 realtime activity, D4 picture cropping) and an E4 line (emoji picker upgrade);
otherwise v0.3, reviewed by the owner on 2026-10-19 in two rounds (all decisions in §10).
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

**Where we are on 2026-10-22** (§0 below is the picture of 2026-10-19): shipped A2–A4, B1–B6, C2,
C3, C5, C6, D1, D2, D4 and E4 (merged up to D2, E4 and the L26 fix on `dev`); the box, the tunnel,
Turnstile and Resend run. C7 followed the same day, so v2.7 is complete. Open: D3, E1, E2 (now step 1 of Track F), Track F;
A1's monitor, alerts and off-box copies and E3 sit in `BACKLOG.md` ("Monitoring and alerting"), C4
stays deferred.

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

Six tracks. A is what the opening needs; B is the agreed product order (mentions → post pages +
search → chat), extended with notifications and moderation; C are gaps nobody had written down; D is
account depth; E is polish and operations; F (added 2026-10-22) is growth and play.

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
C7  realtime activity                ✅ 2026-10-22           │
D4  picture cropping                ✅ 2026-10-21          ─┘
D2  richer posts                    ✅ 2026-10-21 (pulled forward by the owner)
E4  code structure                  ✅ 2026-10-22 (the emoji picker upgrade waits for November)
── agreed 2026-10-22 (§7, §10 third round) ──
C7  realtime activity                ✅ 2026-10-22              finishes v2.7
E2  installable app + web push      ✅ 2026-10-22              v2.8  (step 1)
F1  invites + explore                ✅ 2026-10-22          ─┐
F2a achievements: engine, first groups ✅ 2026-10-22        │
F2b achievements: recognition, community, hidden, time zone ✅ 2026-10-22 │  v2.9  (step 2)
F3  polls + frequent jobs                                   │
F4  weekly digest                                           ─┘
F5  games: engine, Connect Four, watching                   ─┐  v2.10 (step 3)
F6  chess                                                   ─┘
F7  events                                                  ─┐  v2.11 (step 4)
F8  stories                                                 ─┘
F9  one-to-one calls                                           v2.12 (step 5)
F10 store app (Android first)                                  v3.0  (step 6)
D3  TOTP between any two milestones · E1 when performance asks · E4 emoji picker in November
```

The order inside a milestone can move; the dependencies that must hold are in §8. Moderation stays
in v2.6 by the owner's choice; if abuse shows up after the opening, B5a (block + report) is the slice
to pull forward, nothing else depends on its position.

---

## 2. Track A – the opening

### A1. First deployment, uptime check, off-box backups · S (ops, owner)

*Status 2026-10-22: the box, the tunnel, Turnstile and Resend run (owner). L19–L21 and L26 are fixed; the monitor, the failure alerts (L27) and the off-box copies were parked by the owner in `BACKLOG.md` ("Monitoring and alerting", "Operations").*

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
(§10, second table).

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

Dropped by the owner (reverses Q8 in §10). The explore feed, the empty-feed state and the one-time
"follow people" step are parked in `BACKLOG.md` (Web). The slice id stays so the others keep
their names. *Back on 2026-10-22 in a new shape: the explore feed and the empty-feed state in F1
(with invites), the "follow people" step as F2's Getting started checklist.*

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

### C7. Realtime activity · S · ✅ 2026-10-22

Pulled from the backlog on 2026-10-20 (owner). *What it is:* the "Latest activity" card in the
right bar and the `/activity` page are fetched when a page mounts and refetched when the tab
regains focus; between those moments a post, like, comment or follow by someone the viewer
follows does not show up until a reload. With this slice it appears the moment it happens,
the way a message or a notification does.

- API: `ActivitiesListener` emits `ActivityRecordedEvent(activity, actorId)` once the row is written (the item already shaped by `toActivity`); the gateway answers with `activity:new` to the rooms of the actor's followers (`FollowsService.followerIds(actorId)`, one query; capped at 1 000 ids, which no demo account reaches) and never to the actor. Removals (unlike, unfollow) push nothing: the row disappears at the next fetch, as today.
- Web: `ChatProvider` hands the push to `receiveActivity` (`use-activities.ts`: `prependItem` into `queryKeys.activities.list` when it is loaded); the card keeps showing its six newest, the page its full list. No badge, no sound, nothing stored.
- Tests: int (push to followers only, never to the actor or a stranger), gateway spec, web (push → card and page), fake socket schema map.
- As built (2026-10-22): the listener works out the recipients itself and the event carries them (`ActivityRecordedEvent(activity, recipientIds)`, the gateway convention), because a follower must also be able to *see* the item: `GET /activities` leaves out anything by, about or on the post of someone the viewer blocked, was blocked by or muted, so the push asks the same of the actor, the target and the post's author through the new `VisibilityService.viewersOf(viewers, subjects)` (three queries for any number of followers; nobody when a subject is suspended). The client replaces an older line for the same thing happening again (a like after an unlike, which pushes nothing) and, after any socket gap, refetches the activity list and the notification count, since nothing queues pushes for an absent socket. Found on the way: the bell's query said "a tab regaining focus refetches" but focus refetching is off app-wide; it now has it. The socket helpers of the chat integration tests moved to `test/setup/sockets.ts`; e2e `activity.spec.ts`.

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
- **E2 PWA + web push**: detailed on 2026-10-22 as step 1 of Track F (§7), where it now lives.
- **E3 Observability**: error tracking (GlitchTip self-hosted on the box or Sentry's free tier; `@sentry/node` + `@sentry/react`, DSNs by env, request id attached), `enableShutdownHooks({ useProcessExit: true })` so pino flushes, route `ECONNRESET`/`EPIPE` through pino at debug (backlog), a status page later. *Parked by the owner on 2026-10-22 with the rest of the monitoring: `BACKLOG.md`, "Monitoring and alerting", step 3.*
- **E4 Code structure** (backlog) · ✅ 2026-10-22 except the emoji picker line: `TokensModule`, `HttpExceptionFilter` → `ApiExceptionFilter`, event-name casing, `@ZodResponse` everywhere (started in A4), `migrate` as a one-shot image so the API image loses the Prisma CLI.
  *As built (2026-10-22, owner: "full fixes, downtime is fine"):* `tokens/` (`AccessTokensService` is the only user of the JWT secret; the global guard and the gateway import `TokensModule`); the filter renamed and taught to tell a response mismatch (`ZodSerializationException`, a logged masked 500) from a request validation error, which the duck-typed check had confused; `user.profileUpdated` → `profile.updated`, `auth.sessionsRevoked` → `sessions.revoked`; `@ZodResponse` on all 63 JSON handlers (ADR 0019, OpenAPI now 3.1); the migrate image (ADR 0018) needed a `.pnpmfile.cjs` because `@prisma/client`'s optional peer put the CLI back into the production install (API image 963 → 602 MB, not the 450 MB estimated); `update.sh` reworked with it, which also closes review L19–L21 from A1 (only our images pulled, all or nothing; the tunnel token in the environment; the password rule written where it is set) and runs the migrations on their own first because compose removes the old API container before a failing `migrate` inside `up -d`. Owner steps: make `beso-migrate` public, refresh `deploy/` (RUNBOOK §4.1).
  Maintenance (added 2026-10-20): upgrade `emoji-picker-react` 4.22 → 5.x — the emoji picker behind the composer and the chat composer; 5.0.0 shipped on 2026-10-10 as a major version with a changed API, so wait for a few weeks of fixes (not before November 2026), then re-check the lazy chunk's size and the keyboard behaviour of the picker.

---

## 7. Track F – growth and play (added 2026-10-22)

Agreed with the owner on 2026-10-22, once v2.7 is done (decisions in §10, third round). The order:
finish v2.7 with C7; **step 1** the installable app and web push (E2, detailed below); **step 2**
filling the network: invites and the explore feed (F1), achievements (F2a, F2b), polls (F3) and the
weekly digest (F4); **step 3** games that others can watch (F5 the engine and Connect Four, F6
chess); **step 4** events (F7) and stories (F8); **step 5** one-to-one calls (F9); **step 6** a store
app (F10). D3 (two-factor sign-in) fits between any two steps.

What shapes the sizes: one home box behind a tunnel that carries HTTP and WebSockets but no UDP
and accepts no inbound connections; a residential upload line and the box's own disk; an i5 shared
with Frigate; a small community in which few people are online at the same time. Hence no media
servers and no video on the box, managed relays where real-time media needs them, asynchronous
modes before live ones, and nothing that only works with a crowd.

Every F slice keeps the existing rules on top of §9: `VisibilityService` in every new list and
`assertNotBlocked` on every new interaction between two members, a report target wherever members
publish something new, the export and the erasure (ADR 0012) for every new per-user table or file,
notifications through `NotificationsService`, pushes from domain events, its seed data, and its
own achievements (F2's catalogue lists them).

### E2. Installable app and web push · M–L · ADR 0022 "Web push" (step 1) · ✅ 2026-10-22

The base of the later steps: an incoming call, "your move" and an event reminder have to reach a
closed tab, and an installed app with notifications is most of what members mean by "a real app".

- Manifest (`name` BeSo, `display: standalone`, theme colours from the tokens, shortcuts to
  Messages and Notifications) and icons: `pnpm brand` also writes the 192 and 512 px and the
  maskable PNGs. Install offers: the browser's own prompt where there is one
  (`beforeinstallprompt`, offered from Settings and the account menu) and a short "Share → Add to
  Home Screen" note on iPhone Safari, where push works only for an installed app (iOS 16.4+).
- A service worker for push only, with no caching of the app or the API: `index.html` stays
  `no-cache` and the reload after a deploy (`lib/new-version.ts`) stays in charge; an offline page
  at most. `push` shows the notification unless a window of the app is focused
  (`clients.matchAll`); `notificationclick` focuses an open window or opens the link.
- API: `push_subscriptions(id, user_id, endpoint unique, p256dh, auth, user_agent, created_at,
  last_used_at)`; `GET /push/public-key`, `PUT /push/subscriptions` (upsert by endpoint),
  `DELETE /push/subscriptions` (by endpoint). `PushService` (`web-push`, VAPID keys from
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) sends for `notification.created` and
  `message.sent` to members whose preferences allow it; a 404 or 410 from the push service deletes
  the subscription. Signing out removes this device's subscription; sign out everywhere, a password
  reset and a suspension remove them all; the erasure cascades.
- Preferences in `users.settings`: `pushMessages`, `pushSocial` (likes, comments, replies,
  mentions, follows, reposts), `pushPreviews` (message text in the notification, default on); later
  slices add `pushGames`, `pushEvents`, `pushCalls`. A device is on or off by having a subscription.
  Settings → Notifications card; the in-tab `Notification` of B3b stays for an open tab.
- Payloads: a title, a short body, a link and a tag (one per conversation or notification type, so
  a newer one replaces the older).
- Tests: unit (payloads, the preference filter), int (subscription routes, the fan-out through a
  fake sender, the 410 clean-up, the sign-out clean-up), web (the Settings card with a stubbed
  `PushManager`), e2e (the manifest and the service worker are served and register; push itself is
  not driven end to end). Runbook: generating the VAPID keys, the `.env` lines.
- As built (2026-10-22): the device belongs to a **sign-in**, not just a member. A refresh-token
  chain had no stable id (each rotation is a new row), so a signed-out device would have kept
  receiving message previews: `refresh_tokens.sign_in_id` (migration `web_push`) is carried along
  rotation and signed into the access token as `sid`; every way sessions end emits
  `SessionsEndedEvent`, which drops the subscriptions of sign-ins with no live token (a daily job
  catches expiry). Tokens without `sid` get 401 on the push route and are refreshed by the client.
  Endpoints must belong to a known push service (the API posts to them: SSRF), ten devices per
  member at most. Sending is detached from the request. The words of a notification push come
  from `NOTIFICATION_PHRASES` in shared, which the web's `NotificationText` now reads as well. The
  service worker shows a push only when no app window is visible, a message uses the conversation
  id as its tag like B3b's tab notification, and `MessageAlerts` leaves the system notification to
  the worker where this browser has push on. `localStorage` remembers which member switched push
  on in a browser, so another member signing in there drops it; a subscription made with replaced
  VAPID keys is made again on the next start. Found on the way: `UsersService.updateSettings`
  copied each known key by name, so new preference keys were silently dropped; it now merges any
  key of the shared schema. The install offer (`beforeinstallprompt`) is kept for Settings and the
  account menu; `pnpm brand` draws the manifest's icons. `PushSync` is lazy: the first paint grew
  by 1 kB (257.3 of 258). Playwright's headless shell has no notifications, so e2e covers the
  manifest, the icons, the worker's registration and the card; the switch flow is in the web tests.

### F1. Invites and the explore feed · M (step 2) · ✅ 2026-10-22

The newcomer experience parked on 2026-10-20, now with invites: a new network's biggest risk is a
newcomer looking at an empty feed.

- Invites: one personal link per member, `/join/<code>` (`invite_codes(code unique, user_id,
  created_at, revoked_at)`; a new code on request, the old one stops working). `GET /invites/:code`
  (public, throttled) answers the inviter's `UserSummary` for the join page; `registerSchema` gains
  an optional `inviteCode`; `users.invited_by_id` (SetNull). When the invitee confirms the address,
  they follow the inviter and the inviter gets `INVITE_JOINED` with a Follow back button (P1).
  "Invite friends" in the account menu and on the own profile: copy the link, or the system share
  sheet where there is one (`navigator.share`). Turnstile and the email confirmation still apply;
  registering does not require an invite.
- Explore: `/explore` with **Latest** (`GET /posts?scope=all`: everyone's posts and quotes newest
  first through `postSelect(viewerId)`, hidden authors removed) and **Popular** (the last 7 days by
  likes + 2 × comments + reposts, with a ranked cursor like `?sort=top`), in the navigation next to
  Home. An empty home feed points to Explore and People.
- Tests: int (codes, registration with and without one, the follow and the notification after the
  confirmation, revoked codes, explore visibility and both orders), web (join page, invite menu,
  explore tabs, empty feed), e2e (invite link → register → confirm → following the inviter), axe for
  `/join/:code` and `/explore`.
- As built (2026-10-22): the code lives on the user (`users.invite_code`, unique; renewing replaces
  it) rather than in an `invite_codes` table, and `users.invited_by_id` (SetNull, indexed). The
  follow happens on `UserVerifiedEvent`, emitted by every path that confirms an address for the
  first time (the mailed link, a password reset, a corrected address confirmed from the waiting
  room); the follow's event carries `viaInvite`, so the inviter gets one `INVITE_JOINED` ("accepted
  your invite and follows you") instead of `USER_FOLLOWED`, with a Follow back button in the
  notification row (the actor's profile tells whether that already happened). A dead code is no
  invite, never an error; suspended inviters and blocks stop the follow. The export carries the
  member's code and whose invite they used. Explore is `GET /explore/posts?sort=` (latest is
  `PostsService.list`, popular a raw ranking with the ranked cursor); `/explore` is in the main
  navigation. Bundle: a lazy `/join/:code` sharing `RegisterPage` with the eager `/register` made
  the bundler split the entry into a dozen small shared chunks (+4.9 kB); `/register` is lazy
  now too, so both share one on-demand chunk and the first paint is 257.2 kB, a little under
  where it was. The invite dialog loads when opened.

### F2. Achievements · M + M (two commits) · ADR 0021 "Achievements" (step 2)

Badges for what members do and for what others do with what they share. The first ones form an
onboarding checklist that turns a sign-up into an active member; the rest reward what a small
network lives on (welcoming newcomers, replying, being worth reading), and every later slice adds
its own. Rules agreed with the owner (§10, third round): **no streaks**; volume badges mixed with
badges that need other people; **earned is earned** (deleting posts later takes nothing away);
badges visible on the profile with a switch to hide them; no announcements in the activity feed.

**How it works**

- Definitions live in `packages/shared/src/achievements.ts`: per badge a key (`posts-50`), group,
  series and tier, title, description (a hint for hidden ones), lucide icon name and whether it is
  hidden. The tiers of a series are separate keys with a threshold each. The API stores
  `user_achievements(user_id, key text, earned_at, notified boolean)`, primary key
  `(user_id, key)`; keys are text checked against the shared list, so a new badge needs no
  migration.
- Evaluation counts, it never increments: `AchievementsService.check(userId, series[])` runs one
  indexed count per series and inserts every tier reached and not yet held (`createMany` with
  `skipDuplicates`). That makes it idempotent and correct after deletions. `AchievementsListener`
  (the twin of `NotificationsListener`, never throws) maps domain events to the members and series
  concerned: `post.created` to the author's posts, pictures, tags, firsts and the content checks of
  that post; `post.liked` to the liker's likes given and the author's likes received and post
  highlights; `comment.created` to comments, replies, first responder and welcome committee, and
  the post author's conversation highlights; `user.followed` to following, followers, mutual
  follows and welcome committee; `profile.updated`, `message.sent`, reposts, quotes, mentions and
  reactions likewise. Checks of a single post or comment (only emoji, exactly 500 characters, a
  palindrome, a kiss emoji, the time of day) run on the item the event carries.
- A daily sweep (`AchievementsService.sweep(now)`, one more entry in `JobsService`) checks every
  series of every member: tenure, "Around the clock" and whatever a failed listener missed. Its
  awards are **silent** (`notified = true`, no notification), so the first run after the deploy is a
  backfill rather than a dozen notifications per member.
- Notifications: `ACHIEVEMENT_EARNED` through `NotificationsService` without an actor:
  `notifications.actor_id` becomes nullable and the table gains `achievement_key`; `notify` skips
  its "your own doing" rule for actor-less types; the unique key includes the badge. Pushed like
  any notification (`notification:new`, a toast with the badge while the tab is open, E2 for a
  closed one); the sentence lives in `notification-text.tsx`, with the badge's icon where the avatar
  would be.
- Time zone: `users.settings.timeZone` (an IANA name checked with `Intl`), set by the web from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` after sign-in when it is missing, shown and
  changeable in Settings. The time-of-day and calendar badges use it (none without it); F4 uses it
  for the digest's hour; the export carries it.
- Settings: `showAchievements` (default on; off hides the badges from everyone else, never from the
  member) and `hideGettingStarted` (the checklist card dismissed).
- Routes: `GET /users/:id/achievements` (earned badges; hidden ones only once earned; nothing when
  the owner hides them or across a block), `GET /users/me/achievements` (earned badges plus the
  progress of every series, the checklist and hidden found / total), `GET /achievements/stats`
  (holders per badge as a share of members, cached in memory for an hour: "12 % of members have
  this"). Lists keep the `{ items, nextCursor }` shape.
- Web: a strip of the three rarest badges on the profile header and an **Achievements** tab (a
  grouped grid; on one's own profile locked badges are greyed with their progress, hidden ones show
  as "?" with the number found); the **Getting started** card at the top of the home feed until it
  is done or dismissed; a toast when a badge arrives; the switch in Settings → Privacy and the time
  zone in Settings → Account. Badges are lucide icons in token-coloured circles (bronze, silver,
  gold and platinum get tokens of their own, contrast-checked in both themes), so no artwork.
- The export lists earned badges; the erasure cascades.

**Commits.** **F2a**: the engine, the notification change, the settings, the profile tab and strip,
the Getting started card, and the groups Getting started, Firsts, Milestones and Tenure. **F2b**:
Recognition, Community, Hidden and the time zone. Later slices add theirs in their own commits.

- As built, F2a (2026-10-22): the four groups as listed (Locked down waits for D3), 65 badges. The
  definitions, types and schemas are the entry `@beso/shared/achievements` rather than part of
  the main one, so the web loads them with the badge screens only. Instead of a `notified` column,
  `users.achievements_checked_at` marks an account as counted: the accounts from before F2 (and
  the seed's) start null and their first check, by any event, the sweep or a profile view, awards
  what they had reached silently; new accounts get the stamp at creation, so their badges are
  announced from the first. The sweep's awards therefore notify too (tenure arrives as a badge).
  Awards use `createManyAndReturn` with `skipDuplicates`, so racing checks announce a badge once.
  Badges are **not** sent as web push (bursts, and the sweep runs at night): the bell, the toast
  and the Badges tab carry them. New small events: `GroupCreatedEvent`, `PostBookmarkedEvent`
  (first save of a post), `PushSubscribedEvent`, and `MessageUpdatedEvent.actorId`. Indexes added
  for counting: `comments.author_id`, `messages.sender_id`, `comment_reactions.user_id`,
  `post_hashtags.post_id`. The interface says "Badges": the tab is `/u/:username/badges`
  (tiered series folded into one tile with the next goal), `/badges` leads to one's own, the
  strip of the three rarest sits under the profile's counts, the Getting started card is lazy on
  Home (the checklist's "Show Getting started on Home" button on one's own Badges tab undoes the
  dismissal), the switch is in Settings → Privacy. Bundle budget 258 → 259 kB (258.6 measured;
  most of the growth is the bundler re-splitting zod and Radix into chunks of their own).
- As built, F2b (2026-10-22, ADR 0021 amendment): Recognition, Community and Hidden as listed,
  119 badges in all. Every badge is still a counted series, so the sweep re-evaluates anything:
  SQL for the relational and timing ones, JavaScript over the member's posts, comments and
  messages for the words (emoji only, palindromes with accents folded, exactly 500 UTF-16
  units) and for the clock, which reads `settings.timeZone` with `Intl` (shared
  `time-zone.ts`), never in SQL. The zone is saved by the shell from the device when missing and
  changed in a new Settings card; there is no "none" (the shell would set it again). Switching a
  comment reaction is an event now (`first` keeps notifications to first reactions), and
  `post.edited` is new. `progress` leaves out the hidden series; the tab shows found hidden
  badges and "n more to find". Two icons changed to stay off the first paint's modules (258.8 kB,
  budget unchanged). The privacy notice names preferences, the time zone, badges, the inviter
  and push devices.

**Catalogue**: 120 badges with every tier counted, 22 of them hidden, before the later slices add theirs (titles are proposals; tiers are bronze · silver · gold · platinum)

_Getting started_ (the checklist card; a badge each, and one for all six)

| Badge | Earned for |
|---|---|
| Say cheese | a profile picture |
| Widescreen | a cover photo |
| About me | a bio |
| Good company | following three members |
| Hello, world | the first post |
| Joining in | the first comment |
| All set | all six above |

_Firsts_

| Badge | Earned for |
|---|---|
| Worth a thousand words | the first post with a picture |
| Tagged | the first post with a hashtag |
| Shout-out | the first @mention of a member |
| Pass it on | the first repost |
| In my own words | the first quote |
| Say hi | the first chat message |
| Host | the first group chat created |
| Big heart | the first like given |
| Feelings | the first reaction on a comment or a message |
| Saved for later | the first bookmark |
| The full picture | picture, cover, bio, city and website all filled in |
| Pocket-sized | push switched on for a device (with E2) |
| Locked down | two-factor sign-in switched on (with D3) |

_Milestones_

| Badge | Counts | Tiers |
|---|---|---|
| Storyteller | posts | 10 · 50 · 100 · 250 |
| Commentator | comments | 10 · 50 · 100 · 250 |
| In the thread | replies to comments | 10 · 50 · 100 |
| Generous | likes given | 10 · 100 · 500 · 1 000 |
| Expressive | reactions given on comments and messages | 10 · 100 · 500 |
| Shutterbug | pictures posted | 10 · 50 · 200 |
| Chatterbox | chat messages sent | 100 · 1 000 · 5 000 |
| Tag explorer | different hashtags used | 5 · 20 · 50 |
| Amplifier | reposts and quotes made | 10 · 50 · 100 |
| Well connected | members followed | 10 · 25 · 50 · 100 |
| Collector | achievements earned | 10 · 25 · 50 |

_Recognition_ (what others do with what you share)

| Badge | Earned for |
|---|---|
| Crowd | followers: 10 · 25 · 50 · 100 |
| Loved | likes received: 10 · 100 · 500 · 1 000 |
| Hit · Smash hit · Legend | one post with 10 · 25 · 50 likes |
| Conversation starter · Town square | one post with 10 · 25 comments |
| Crowd favourite | one comment with 10 reactions |
| Spreading · Viral | one post reposted or quoted 5 · 20 times |
| Talk of the town | mentioned by 10 different members |
| Trendsetter | the first to use a hashtag that 5 other members then used |

_Community_

| Badge | Earned for |
|---|---|
| Welcome committee | following or commenting on members in their first week: 1 · 5 · 20 newcomers |
| First responder | the first comment on another member's post: 1 · 10 · 50 posts |
| Inner circle | mutual follows: 5 · 15 · 30 |
| Crew | a group chat you created reaches 5 members |
| Big table | being in a group chat of 10 or more |
| Recruiter | members who joined through your invite: 1 · 5 · 10 (with F1) |

_Tenure_

| Badge | Earned for |
|---|---|
| One month · Six months · One year · Two years · Three years · Five years | time since sign-up (the daily sweep) |
| Pioneer | an account from before the opening (2026-10-29): the testers |
| Founding member | joining within 30 days after the opening |
| One of the first 100 | being among the first 100 accounts by sign-up |

_Hidden_ (a "?" until earned; times in the member's time zone)

| Badge | Earned for |
|---|---|
| Night owl | a post or comment between 02:00 and 04:59 |
| Early bird | a post between 05:00 and 06:59 |
| Make a wish | a post at 11:11, morning or evening |
| Around the clock | posts, comments or messages in every one of the 24 hours (over any time) |
| Weekend warrior | 20 posts on Saturdays and Sundays |
| Happy new year | a post in the first hour of 1 January |
| Leap of faith | a post on 29 February (next: 2028) |
| Unlucky for some | a post on a Friday the 13th (next: 2026-11-13) |
| Trick or treat | a post with 🎃 or 👻 on 31 October |
| Un beso | a post or message with 😘 or 💋 (BeSo: _beso_, a kiss) |
| Home team | a post with #beso |
| Speechless | a post made only of emoji |
| To the letter | a post of exactly 500 characters, the limit |
| Racecar | a post that reads the same backwards (7 letters or more; spaces and punctuation ignored) |
| Quick draw | a reply within a minute of the comment it answers (someone else's) |
| Archaeologist | a comment on a post more than a year old |
| Welcome back | a post after 60 days without one |
| Perfectionist | a post edited three times |
| Inception | quoting a post that is itself a quote |
| Full range | all five comment reactions used at least once |
| Talking to myself | a reply to your own comment |
| Detective | five hidden achievements found |

_Added by later slices_ (in their own commits)

| Slice | Badges |
|---|---|
| F3 polls | First poll · Pollster (a poll with 20 votes) · Voice heard (voted in 10 · 50 polls) |
| F5 games | First game · First win · Winner (10 · 50 · 100 wins) · Good sport (a rematch after a loss) · Kibitzer (watched 10 games) · hidden Diagonal thinking (a Connect Four win on a diagonal) |
| F6 chess | Checkmate (the first chess win) · Grandmaster in the making (25 chess wins) · hidden Scholar (mate within four moves) · hidden Horse play (a win after promoting to a knight) · hidden Stalemate (a draw by stalemate) · hidden Photo finish (a win with less than 10 seconds on your clock) |
| F7 events | Host with the most (1 · 5 events hosted) · Regular (attended 1 · 5 · 10) · Crowd puller (an event with 10 going) |
| F8 stories | First story · Snapshots (10 · 50 stories) · Must-see (a story seen by 20) |
| F9 calls | First call · Long distance (a call longer than an hour) |

**Feasibility.** Every badge above is computed from tables that exist, or arrive with the slice that
adds it, through indexed counts; "Around the clock" and tenure run only in the daily sweep. Nothing
new is recorded for the badges' sake except the time zone. Not offered: streaks (agreed), badges
for reporting or blocking people, badges that would reveal private data (bookmarks of one's posts,
sessions, devices).

- Tests: unit (every threshold and content check; time zones across a daylight-saving change; the
  leap day; palindromes and emoji with combining characters), int (an event awards once, a deletion
  revokes nothing, the sweep is silent and idempotent, actor-less notifications, hidden and
  switched-off badges, blocks), web (the profile tab and strip, the checklist card, the toast, the
  settings), e2e (a new member completes the checklist, sees the toast and the card go).

### F3. Polls · M (step 2) · ✅ 2026-10-23

- A post may carry a poll: `polls(post_id PK, closes_at, ended_notified_at)`,
  `poll_options(id, post_id, position, text ≤ 80)`, `poll_votes(post_id, user_id, option_id,
  created_at)` with `(post_id, user_id)` unique. `createPostSchema` gains an optional
  `poll: { options: 2–4 texts, duration: 1 h | 1 d | 3 d | 7 d }`; the post shape gains
  `poll: { options: [{ id, text, votes }], totalVotes, myVote, closesAt, closed } | null`, counted
  with one `groupBy` per page like reactions. `PUT /posts/:id/poll/vote { optionId }`: one vote,
  final (P3). Results show after voting or once closed, always to the author. The poll cannot change
  after the first vote; the post text can. Quote embeds show "Poll" and the text only.
- **Frequent jobs** (ADR 0012 amendment 2): `JobsService.runFrequent(now)` every 5 minutes next to
  the daily run, behind the same `JOBS_ENABLED`, under the same rules (the clock as a parameter,
  idempotent through `*_notified_at` stamps, counts logged). Its first task: `POLL_ENDED` to the
  author and the voters. F4, F5, F7 and F8 add theirs.
- Tests: int (creation, vote rules, counts, closing, the frequent job), web (the composer with a
  poll, voting, result states), e2e (alice posts a poll, bob votes, both see the result).
- As built (2026-10-23): migration `polls` (the three tables, `POLL_ENDED`; the job's lookup is an
  `(ended_notified_at, closes_at)` index because Prisma's partial indexes are a preview feature).
  Counts come with `postSelect` as relation counts in the same query rather than a `groupBy` per
  page, like `likeCount`; `toPost` now takes the viewer id, since whether the counts show depends
  on who reads (`votes: null` per option until then; `totalVotes` always shows). Decisions on the
  way: the author cannot vote in their own poll (they always see the results; 403); a post has
  pictures or a poll, never both, and a quote asks none (field error on `poll`, in the shared
  schema); a vote refused because the poll closed or the member voted elsewhere is a 409, after
  which the client reloads the poll; the poll is fixed at creation like the pictures. `POLL_ENDED`
  goes to the voters with the author as the actor ("Alice asked, and the results are in") and to
  the author without one ("The results of your poll are in", `NOTIFICATION_PHRASES[…].own`), so
  pushes reach both. `PollsService` (`posts/`) owns the vote and the frequent job
  `endClosed(now)` (ADR 0012, frequent jobs). Badges: Show of hands (first poll), Voice heard
  (10 · 50 votes), Pollster (a poll with 20 votes). Web: "Poll" in the composer (the editor a
  lazy chunk), `PostPoll` on the card (one press votes; results with the choice ticked and the
  leaders marked at the close; a poll that closed on screen offers "See the results"), "Poll" in
  quote embeds and chat cards, the privacy notice names votes (`LEGAL_UPDATED_ON` bumped). The
  seed has an open poll of bob's and a closed one of carol's. First paint 258.0 of 259 kB.

### F4. Weekly digest · M · ADR 0010 amendment 2 (step 2)

- One mail a week, on Monday at 09:00 in the member's time zone (F2b), on by default with a one-click
  unsubscribe (P4): the most liked posts from people they follow in the last 7 days (up to five),
  new followers, unread notifications and messages, badges earned, and later upcoming events (F7)
  and games waiting for their move (F5). Only to members not active in the last 3 days
  (`refresh_tokens.last_used_at`) and only when there is something to say; `users.digest_sent_at`
  keeps it to once a week (frequent jobs, F3).
- Unsubscribing without signing in: a signed token (an HMAC of the user id and the purpose, no
  expiry, no table) in the footer link and in the `List-Unsubscribe` and `List-Unsubscribe-Post`
  headers (RFC 8058); `POST /email/unsubscribe { token }` is public. Settings → Email gains the
  switch (`digest: weekly | off`). The privacy notice names the digest (`LEGAL_UPDATED_ON` bumped).
- Tests: int (selection rules, the hour in several time zones, once a week, the token and the
  headers in the outbox), web (the switch, the unsubscribe page), e2e (the unsubscribe link from the
  outbox).

### F5. Games: the engine, Connect Four and watching · L · ADR 0023 "Turn-based games" (step 3)

The best fit of the new features: it reuses the socket, notifications, profiles and the feed, and
gives members something to do together.

- An engine in `packages/shared/src/games/`: a game is pure functions over plain data
  (`initialState`, `applyMove(state, move, seat)` → the new state or an error,
  `result(state)` → nothing yet or `{ winner, reason }`, zod schemas for its state and moves), so
  the browser shows legal moves and the server referees. Connect Four first (7 × 6; a draw on a full
  board): small enough to prove invitations, turns, watching and notifications.
- Data: `games(id, type, status invited | active | finished | declined | cancelled, mode
  correspondence | live, visibility public | followers | players, created_by, state jsonb,
  move_count, turn_seat, deadline_at, result jsonb, created_at, started_at, finished_at)`,
  `game_players(game_id, user_id, seat, outcome)`, `game_moves(game_id, ply, user_id, move jsonb,
  created_at)` (the state can be replayed from them), `game_watchers(game_id, user_id,
  first_seen_at)` for Kibitzer.
- Routes: `POST /games { type, opponentId, mode, visibility }` (a challenge; `assertNotBlocked`;
  the opponent's `gameInvites: everyone | following | nobody`), accept, decline, cancel,
  `POST /games/:id/moves { ply, move }` (the `ply` must equal `move_count`, so a double tap or a race
  is a 409), resign, offer and accept a draw, rematch, `GET /games/:id` (state, players, moves),
  `GET /games?status=&userId=`, `GET /games/watch` (public games in progress).
- Realtime: moves come in over HTTP and go out as domain events. The gateway gains **game rooms**
  (`game:<id>`): `game:watch { gameId }` joins after the visibility check (a member blocked by
  either player is refused) and answers the state, `game:unwatch` leaves, `game:update` goes to the
  room and to the players' user rooms, and the room's size goes out as a watcher count (names are
  not shown, P5).
- Correspondence first (P5): 3 days per move, then the game is lost on time (a frequent job).
  Notifications `GAME_INVITED`, `GAME_TURN` (not while the player has the game open) and
  `GAME_ENDED`; a finished game becomes an activity ("alice beat bob at Connect Four") unless it was
  players-only. Preference `pushGames`.
- Web: `/games` (invitations, your games with "your move" first, games to watch, Challenge someone
  through `PeoplePicker`), `/games/:id` (board, players, moves, watcher count, resign, draw,
  rematch), Challenge from the profile menu and the chat thread header. Keyboard play (arrow keys
  pick a column, Enter drops) and an `<output>` announcing every move. Lazy routes.
- Seed: a game in progress between alice and bob, a finished one. Tests: unit (rules, wins, draws),
  int (lifecycle, move conflicts, visibility, blocks, timeouts, watchers), gateway spec (rooms), web
  (board, hub), e2e (bob challenges alice and they play to a win while carol watches the moves
  arrive).

### F6. Chess · L (step 3)

- `chess.js` (BSD-2) on both sides inside the engine contract (FEN as the state, SAN for moves,
  every draw rule it knows); a board from `react-chessboard` (MIT; not chessground, which is GPL-3),
  lazy loaded; a promotion picker; PGN download; finished games replayable move by move.
- Modes: correspondence (1, 3 or 7 days per move) and **live** with clocks (5+0, 10+5, 15+10).
  The clocks are the server's, without timers: every move stores the time used, and when a clock
  runs out on the opponent's screen the client claims the timeout and the server checks it against
  the stored times (`POST /games/:id/claim-timeout`), so a restart loses nothing.
- Accessibility: moves can also be typed in SAN next to the board, the move list is a table, check
  and the last move are announced.
- Engine assistance cannot be prevented in casual play. Ratings and leaderboards wait in
  `BACKLOG.md` until members ask.
- Tests: unit (the adapter, clocks), int (a live game to a timeout claim, draws, PGN), web (board
  with promotion, typed moves), e2e (a scholar's mate in a live game while a third member watches).

**Later games** on the same engine, each a small slice in the order members ask for them: checkers,
backgammon (dice rolled by the server), a daily word puzzle everyone plays and compares, battleship
(hidden information through a per-seat view of the state).

### F7. Events · L · ADR 0024 "Events" (step 4)

- `events(id, host_id, title ≤ 100, description ≤ 2000, starts_at, ends_at?, time_zone,
  place ≤ 200, cover_key?, visibility public | followers, capacity?, cancelled_at, created_at)` and
  `event_rsvps(event_id, user_id, status going | maybe | declined, created_at)`. Creating an event
  also creates a post that embeds it (like a quote), so it reaches the host's followers.
- Routes: create, edit (going and maybe are told), cancel, `PUT /events/:id/rsvp`,
  `GET /events/:id`, `GET /events?scope=upcoming | hosting | attending`,
  `GET /events/:id/calendar.ics`.
- Notifications `EVENT_RSVP` (to the host), `EVENT_CHANGED` and `EVENT_CANCELLED` (to going and
  maybe), `EVENT_REMINDER` 24 hours before (frequent jobs; push with E2, preference `pushEvents`).
  The host can open a group chat for the people going (`createGroup`); later RSVPs are offered to
  join it.
- Web: `/events` (upcoming, hosting, attending), `/events/:id` (cover, the time in the viewer's
  zone with the host's zone noted, place with a map link, going and maybe, RSVP), "Event" in the
  composer, the event card in feeds; the cover through the cropper (3:1, the profile cover frame).
- Reports gain the `event` target. The export lists events and RSVPs; erasing a host cancels their
  events and tells the guests.
- Tests: int (visibility, RSVP rules, reminders, changes, the `.ics`), web, e2e (alice hosts, bob
  says he is going, the reminder arrives).

### F8. Stories · L · ADR 0025 "Stories" (step 4)

- Pictures and text only. No video: transcoding on the shared i5, the storage, the home upload
  line, and Cloudflare's terms for video on the free plan. `stories(id, user_id, image_key?, text?,
  background?, created_at, expires_at = created_at + 24 h)` with an upload kind `story` (a 9:16
  preset, 1080 × 1920; the cropper gains the frame) and `story_views(story_id, viewer_id,
  viewed_at)`.
- Visible to everyone who can see the author's posts (P7). The ring row above the feed shows the
  people you follow with active stories, unseen ones first; profiles show the ring on the avatar.
  `POST /stories`, `DELETE /stories/:id`, `GET /stories/feed`, `GET /users/:id/stories`,
  `POST /stories/:id/view` (idempotent), `GET /stories/:id/viewers` (the author only).
- Replies and reactions go to the direct chat as a message that cites the story (`messages.story_id`,
  SetNull; "This story is no longer available" once it is gone).
- Expired stories disappear at read; a frequent job deletes their files through
  `UploadsService.discard`. Reports gain the `story` target.
- Web: the ring row; a full-screen viewer (tap or arrow keys to move, hold or Space to pause, swipe
  down or Escape to close, progress bars, reduced motion respected, focus kept inside); the
  composer (a picture through the cropper, or text on a token-coloured background).
- Tests: int (expiry, visibility, views, replies), web (the viewer by keyboard and pointer, the
  composer), e2e (alice posts a story, bob sees the ring, views it and replies, alice sees bob among
  the viewers).

### F9. One-to-one calls · L–XL · ADR 0026 "Calls" (step 5)

- Audio and video between two members over WebRTC, peer to peer. Signalling over the chat socket
  (`call:invite`, `call:accept`, `call:decline`, `call:cancel`, `call:end` and `call:signal` with
  the SDP and the ICE candidates; zod-validated payloads with acks, like messages); the call's state
  in memory (one instance); `calls(id, conversation_id, caller_id, callee_id, media, created_at,
  answered_at, ended_at, end_reason)` for the history, shown as system lines ("Missed video call",
  "Audio call · 12 min").
- ICE: Cloudflare's STUN, and a **managed TURN relay** for the connections that cannot go direct
  (mobile networks often): the box cannot relay media through the tunnel and opens no ports by
  design. `GET /calls/ice-servers` hands out short-lived credentials from the provider (Cloudflare's
  TURN service first, P8). Direct calls show each side the other's address; a "relay only" switch
  hides it at the cost of relayed traffic (the privacy notice says so).
- Who can call: `whoCanCall: everyone | following | nobody` (P8, default following); blocks refuse.
  It rings for 30 s; a closed tab rings through push (E2, `pushCalls`); then it is a missed call.
- Web: call buttons in the thread header and in chat windows, the incoming call dialog (the ring
  sound by preference), the call view (mute, camera, switch camera on phones, screen sharing on
  desktop, hang up, picture in picture). A lazy chunk.
- Group calls need a media server (SFU) and stay in `BACKLOG.md`.
- Tests: unit (the call state machine), gateway spec (signalling, refusals), web (the dialogs with
  a stubbed `RTCPeerConnection`), e2e (two browsers with Chromium's fake media devices connect and
  hang up).

### F10. Store app · L, plus the store chores · ADR 0027 "Native app" (step 6)

- The same React build in a Capacitor shell; Android first (no macOS needed), iOS when the cost is
  accepted (Apple's $99 a year, a macOS runner or a Mac for the builds).
- Signing in without the site's cookies: the shell runs on an origin of its own, so the access
  token goes in the `Authorization` header (already accepted) and the refresh token travels in the
  body and lives in the device's secure storage (a native variant of `/auth/refresh` bound to a
  device id).
- Native push (FCM, APNs) as a second transport behind `PushService`; deep links
  (`/.well-known/assetlinks.json` and `apple-app-site-association`, served by Caddy); the camera and
  photo picker for uploads; safe areas and the status bar.
- Store requirements: reporting and blocking exist (B5); the privacy labels follow the privacy
  notice.
- Tests: the web suites cover the interface; CI builds the Android app and runs a smoke test.

---

## 8. Dependencies

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
E2 push ──► F5/F6 "your move", F7 reminders and F9 ringing for closed tabs, F10 (native push behind PushService)
F2a achievements engine ──► every later F slice (its badges); F1 invites ──► F2's Recruiter
F2b time zone ──► F4 (Monday 09:00 local), the time-of-day badges
F3 frequent jobs ──► F4 sending, F5 move deadlines, F7 reminders, F8 expiry
F5 engine + game rooms ──► F6 chess, later games
B4 notifications ──► F1, F2a (actor-less ACHIEVEMENT_EARNED), F3, F5, F7
D4 cropper ──► F7 covers, F8 (9:16 frame); B3b/C5 chat ──► F8 story replies, F9 call lines
B5 moderation ──► every F slice (blocks, new report targets)
```

---

## 9. Per-slice definition of done

1. Shared schemas and constants in `packages/shared` (never duplicated), API module with DTOs via `createZodDto`, migration committed with the schema change, seed extended when the feature has demo value.
2. Unit tests for parsers and mappers, integration tests for every route and rule, web tests for every new page and state, one e2e scenario, new pages added to `e2e/a11y.spec.ts`.
3. `pnpm check`, `pnpm test:int`, `pnpm --filter @beso/web e2e` green; `pnpm format:check` clean; bundle budget respected or raised with the reason in the commit message.
4. Docs: a row in `REBUILD_PLAN.md` §4.12, `ROADMAP.md` item struck or moved, deferrals to `BACKLOG.md`, the ADR when the slice makes a decision, `CLAUDE.md` conventions when a slice introduces one (e.g. `RichText`, `VisibilityService`, `useDocumentBadge`, the bubbles layer), runbook for new env variables.
5. One commit on `dev`, message `feat(scope): …` with the slice id, the owner commits.

---

## 10. Decisions taken in the reviews (2026-10-19, 2026-10-22)

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

### Third round (growth and play, 2026-10-22)

| # | Point | Decision |
|---|---|---|
| R3-1 | What comes after v2.7 | Track F in this order: E2 installable app + push → F1 invites + explore, F2 achievements, F3 polls, F4 digest → F5/F6 games with watching → F7 events, F8 stories → F9 one-to-one calls → F10 store app. D3 between any two steps. |
| R3-2 | Bulgarian interface | Not for now (`BACKLOG.md`). |
| R3-3 | Monitoring, alerting, error tracking, dashboards | Not now; parked in `BACKLOG.md` in that order. |
| R3-4 | Achievements | In, step 2, with an extended catalogue including hidden badges; no streaks; volume and recognition badges mixed; earned is earned; visible on the profile with a switch. |
| R3-5 | Not now | Group calls and live audio rooms (a media server), video stories and video uploads (the box and the line), a React Native rewrite, self-hosted TURN or SFU on the box (no inbound ports by design). |

**Proposed defaults** (the slice uses them unless the owner says otherwise when it starts)

| # | Slice | Default |
|---|---|---|
| P1 | F1 | The invitee follows the inviter on confirming the address; the inviter is notified and offered Follow back, nothing automatic. |
| P2 | F2 | Badges shown by default; the backfill is silent; the founding window is the 30 days after the opening (2026-10-29 → 2026-11-28); "Pioneer" for accounts from before it. |
| P3 | F3 | 2–4 options, one vote, final; results after voting or at the close (always to the author); 1 h, 1 day, 3 days or 7 days. |
| P4 | F4 | On by default with one-click unsubscribe; Monday 09:00 local; only to members away for 3 days and only with something to say. |
| P5 | F5/F6 | Correspondence first (3 days a move, then lost on time); live with clocks for chess; visibility "followers" by default; watchers shown as a count, not by name; results in the activity feed unless players-only. |
| P6 | F7 | Public or followers-only events; a reminder 24 hours before; the attendees' group chat only when the host opens it. |
| P7 | F8 | Visible to everyone who can see the author's posts; the ring row for people you follow; the viewers list for the author only; pictures and text only. |
| P8 | F9 | `whoCanCall` defaults to people you follow; Cloudflare's TURN service first; a "relay only" switch for members who prefer to hide their address. |
| P9 | F10 | Only after E2 has been in use for a while; Android first, iOS when the yearly fee and the macOS builds are accepted. |
