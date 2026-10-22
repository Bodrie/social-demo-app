# 0021 – Achievements: counted, never tallied; earned is earned

Date: 2026-10-22 · Status: Accepted, amended 2026-10-22 (the rest of the catalogue and the time zone, plan F2b) · Plan: `IMPLEMENTATION_PLAN.md` F2 (step 2 of Track F)

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

## Amendment 2026-10-22: Recognition, Community, Hidden and the time zone (plan F2b)

### Context
F2a left out the badges that depend on other people (Recognition: what others do with a
member's posts; Community: welcoming, answering, groups, invites) and the hidden ones, many of
which read the clock ("Night owl", "Happy new year") or the words of a post ("Speechless",
"Racecar", exactly 500 characters). The clock needs the member's time zone, which nothing stored.

### Decision
- **The catalogue** grows to 119 badges: Recognition 18, Community 14, Hidden 22 (the plan's 120
  counted "Locked down", which waits for D3). Tiers may carry titles of their own ("Hit",
  "Smash hit", "Legend"); `tiered()` takes one title or one per tier, and the web names a tile
  after the tier on show. A third derived series, `hidden-found`, makes Detective.
- **Still counted, never tallied.** Every new badge is a series counted from the tables: SQL for
  relations and timing (most liked post, first comment on a post, follows inside a newcomer's
  first week, mutual follows, the largest group created or joined, confirmed invitees, a reply
  within a minute, a comment on a post a year older, a 60-day gap between posts, three edits of
  one post, a quote of a quote), and JavaScript over the member's posts, comments and messages
  where SQL cannot say it well. The member's items are loaded at most once per check (`History`
  in `AchievementCounter`).
- **The clock in JavaScript, not SQL.** `users.settings.timeZone` (IANA, checked with `Intl`;
  `localTime`/`isTimeZone`/`timeZoneSchema` in shared `time-zone.ts`) and the clock checks run on
  `Intl` in the API (`content-checks.ts`), so the API, the web and later the digest share one
  idea of local time and Postgres's zone list never matters. Without a zone the clock badges
  count nothing. Times of past items are read in the current zone (a member who moves sees their
  history in the new one).
- **The zone comes from the device.** The shell saves `Intl…resolvedOptions().timeZone` when the
  account has none; Settings → Time zone changes it. There is no "none" to choose, since the
  shell would set it again; a stored name `Intl` stops knowing reads as none instead of
  resetting the other settings (`.catch(null)` on the field).
- **Words.** "Speechless" strips pictographs, skin tones, joiners, variation selectors, flags,
  tags and keycaps and needs nothing left; "Racecar" folds case and accents (NFD without marks)
  and needs seven letters; "To the letter" counts UTF-16 units like the composer.
- **Events.** A switch of comment reaction is now an event too (`CommentReactedEvent.first`
  tells the notifications listener to keep to first reactions); `PostEditedEvent` drives
  Perfectionist and the text series; `ConversationUpdatedEvent` checks a group's creator (Crew)
  and, once it has ten members, everyone in it (Big table); `UserVerifiedEvent` counts the
  inviter's recruits; a new post checks whoever first used each of its tags (Trendsetter).
  Around the clock is left to the daily sweep, which reads every message.
- **Hidden stays hidden.** `GET /users/me/achievements` leaves the series whose badges are all
  hidden out of `progress`; the Badges tab shows found hidden badges and one "n more to find"
  tile, never a hint. Others see hidden badges once earned, like any other.
- **First paint.** Badge icons avoid the ones the first paint uses (Night owl on `moon-star`,
  Crowd on `user-round-plus`): an icon shared with eager code is split into a chunk of its own.
  First paint 258.8 kB, within the 259 kB budget.
- **Privacy notice.** "What we collect" now names preferences, the time zone, badges, the
  inviter and push devices; "Who else sees it" names badges.

