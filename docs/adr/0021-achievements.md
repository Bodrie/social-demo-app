# 0021 – Achievements: counted, never tallied; earned is earned

Date: 2026-10-22 · Status: Accepted · Plan: `IMPLEMENTATION_PLAN.md` F2 (step 2 of Track F)

## Context
Track F fills a small network. Badges were agreed with the owner (§10, third round) as a way to
turn a sign-up into an active member (a Getting started checklist) and to reward what a small
network lives on, with four rules: no streaks; volume badges next to badges that need other
people; **earned is earned** (deleting posts takes nothing away); badges visible on the profile
with a switch to hide them, and never announced in the activity feed. Every later slice of
Track F adds badges of its own, so adding one has to be cheap.

Open questions the platform did not settle:
- **Counting.** A counter per member and series drifts (a missed event, a deletion, a retry).
- **The members who are already there.** On the deploy, every existing member has reached a
  dozen badges; announcing them all at their next action would bury the bell.
- **Notifications without an actor.** Every notification so far was someone doing something
  (ADR 0015), and the read path, the silencing rules and the web assumed an actor.
- **Weight.** The catalogue (titles, thresholds, icons) is several kB; the web's first paint is
  on a tight budget.

## Decision
- **Definitions in shared, one entry of their own.** `packages/shared/src/achievements.ts` lists
  every badge: key (`posts-50`), group, series, threshold, tier (bronze · silver · gold ·
  platinum, or none), title, description, lucide icon name, hidden. The tiers of a series are
  separate keys. It is published as `@beso/shared/achievements`, **not** from the main entry,
  together with the response schemas and the types: the web imports it only from the screens
  that show badges, so none of it is on the first paint. The API stores
  `user_achievements(user_id, key, earned_at)`, primary key `(user_id, key)`; keys are text, so
  a new badge needs no migration.
- **Evaluation counts.** `AchievementsService.check(userId, series[])` runs one indexed count per
  series that still has a badge to give (`AchievementCounter`; new indexes on `comments.author_id`,
  `messages.sender_id`, `comment_reactions.user_id`, `post_hashtags.post_id` for it) and inserts
  every badge reached and not yet held with `createManyAndReturn` + `skipDuplicates`, so two
  racing checks award a badge once and only the inserted rows are announced. "All set" (the six
  Getting started badges) and Collector (badges held) count badges and settle last. Nothing ever
  deletes a row but the erasure.
- **Listener and sweep.** `AchievementsListener` (the twin of `NotificationsListener`, never
  throws) maps domain events to the member and the series: posts and quotes, reposts, mentions
  given, comments and replies, likes, comment and message reactions (`MessageUpdatedEvent` now
  carries its actor), messages, group creation (`GroupCreatedEvent`), follows, first bookmarks
  (`PostBookmarkedEvent`), push devices (`PushSubscribedEvent`), profile changes and the account
  opening (tenure). The daily sweep (`JobsService` entry `achievements`) checks every series of
  every confirmed, unsuspended member: tenure, and whatever a failed listener missed.
- **The silent backfill.** `users.achievements_checked_at` is null for the accounts that existed
  before F2 (and for the seed's); the first check of such an account awards everything it had
  reached without a notification and sets the stamp. New accounts get it at creation (a column
  default added after the backfill rows), so their badges are announced from the first one. A
  profile view backfills too, so the badges appear before the member does anything. This differs
  from the plan's `notified` column: the stamp is per member and needs no second write per badge.
- **Notifications without an actor.** `ACHIEVEMENT_EARNED` with `notifications.actor_id` nullable
  and `achievement_key`; `notify` skips its own-doing and silencing rules for actor-less rows,
  and the silencing filter reads `actor_id IS NULL OR actor_id NOT IN (…)` (a bare `NOT IN` drops
  the null). Pushed over the socket like any notification (`notification:new`): the web shows a
  toast with the badge and refreshes the badge queries. **Not sent as web push** (a change from
  the plan): badges come in bursts, and the sweep's at four in the morning.
- **Settings.** `showAchievements` (on by default; off hides the badges from everyone but the
  member; blocks and suspensions hide them too) and `hideGettingStarted` (the checklist card
  dismissed; the member's own Badges tab brings it back).
- **Routes.** `GET /users/me/achievements` (earned plus the count of every series, for progress),
  `GET /users/:id/achievements` (earned; empty when hidden), `GET /achievements/stats` (holders per
  badge and the number of members, in memory for an hour). All lists keep `{ items, nextCursor }`.
- **Web.** "Badges" in the interface: the profile tab `/u/:username/badges` (tiered series folded
  into one tile with the highest tier and the next goal; on one's own profile locked badges are
  greyed with a progress bar), a strip of the three rarest under the profile's counts, the
  Getting started card on Home (lazy), the toast, `/badges` leading to one's own tab (where a
  badge notification links), the switch in Settings → Privacy. Badges are lucide icons in circles
  of tier tokens (`--badge-*`, icon on medallion at least 5.6:1 in both themes), so no artwork.
- **Export and erasure.** The export lists earned badges with their names; the erasure cascades.

## Consequences
- A new badge is one entry in the catalogue; a new series is one counter case (the `never`
  check makes a missing one a type error) and, if an event drives it, one line in the listener.
- Counting costs one query per open series per event; series whose badges are all held are not
  counted again. The sweep is a few dozen counts per member per day, fine at this size; a much
  larger network would want the sweep restricted to tenure and recent activity.
- The first check after the deploy can award many badges silently in one go; the bell stays
  quiet, which is the point, and the Badges tab shows them at once.
- Hidden badges, Recognition and Community (what others do with a member's posts), the time zone
  and the time-of-day badges are F2b; the plan's `notified` column and pushing badges are not
  part of the design.
- The first paint grew by 1.4 kB gz (the settings keys, the notification shape, the push handler
  and two lazy entry points, plus the bundler re-splitting shared chunks); the budget is 259 kB.
