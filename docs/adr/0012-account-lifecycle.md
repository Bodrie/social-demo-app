# 0012 – Account lifecycle: a copy of everything, deletion that erases, and a bot check at the door

Date: 2026-10-19 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` A2 and A3

## Context

The site opens to strangers at the end of October 2026 and is hosted in the EU. Two GDPR rights
need a self-service path before that: a copy of one's data in a machine-readable form and
deletion. The schema has cascaded from `users` since the rebuild, so the question was not
whether deletion is possible but what it means for the people the member interacted with,
and how to keep denormalised counters honest.

## Decision

- **Deletion erases; it does not anonymise.** `DELETE /users/me`, confirmed with the password
  (checked like a login, field error `password` when wrong, five attempts a minute), deletes
  the user row in one transaction and lets the cascades take posts, comments, likes,
  reactions, follows, activities, mentions, refresh and email tokens, upload rows,
  conversation memberships and messages with it. A deleted member's messages therefore
  vanish from other people's threads. The alternative, a "Deleted account" placeholder that
  keeps the messages, needs a nullable sender and a tombstone user shape in every list; the
  owner chose not to carry that for a demo network.
- **Conversations are tidied in the same transaction.** Direct threads with the member and
  groups where the member was the last one are deleted outright, so the other side never sees
  a half conversation; groups that go on lose the member and have their `last_message_at`
  recomputed, since the newest message may have been theirs. The remaining members are told
  (`conversation.left` → `conversation:update`), the other side of a direct thread gets a new
  `conversation.deleted` → `conversation:removed` push.
- **Denormalised counters are corrected before the rows go.** `comments.reactions_count` of
  other people's comments is decremented for the reactions that cascade away. Like and
  comment counts are derived at read time and need nothing.
- **After the commit**: the member's files are deleted through `StorageService` (best effort,
  one failure never blocks the others; the rows already cascaded), the sockets are cut through
  the existing `sessions.revoked` event, the cookies are cleared, and a last mail confirms the
  deletion to the address (not awaited, like the reset mail).
- **The export is one JSON document** (`GET /users/me/export`, `accountExportSchema`):
  profile, posts with their revisions and tags, comments with revisions, likes, reactions,
  following and followers, the member's own messages with the conversation they belong to,
  and the upload keys with URLs. Other people's content is not included: it is theirs.
  Pictures are referenced by URL rather than embedded; they are public files. Twice a minute
  per address, served as an attachment named `beso-export-<username>-<date>.json`.
- **Both work before the address is confirmed** (`@AllowUnverified`): someone who registered
  by mistake must be able to leave without first proving the inbox.
- **On the web both live in Settings → Your account**: a download button (the file is built
  from the parsed response, so the silent token refresh applies) and a destructive dialog
  that asks for the password and ends the session on success. The privacy notice names the
  path.

## Registration: a bot check (A3)

- **Cloudflare Turnstile on the register form, and nowhere else.** The zone is on Cloudflare
  already, the widget is free and usually invisible, and the owner chose to leave the other
  anonymous routes (`forgot-password`, `verify-email/resend`) to their existing per-address
  and per-account limits.
- **The API decides, not the browser.** `registerSchema` carries an optional `captchaToken`;
  `AuthService.register` asks the `CAPTCHA` verifier before anything is looked up or
  created. With `TURNSTILE_SECRET` set the verifier is Cloudflare's `siteverify` (token plus
  the client address, two-second timeout); without it (development, tests) a no-op verifier
  lets everyone through. A rejected or missing token is a field error on `captchaToken`.
- **An outage closes the door instead of opening it.** When the check itself cannot be made
  (network, non-2xx, unexpected body) registration answers 503 `CAPTCHA_UNAVAILABLE` rather
  than skipping the check; the alternative would make the protection disappear exactly when
  someone makes Cloudflare unreachable.
- **Production must choose.** The API refuses to start in production without the secret
  unless `CAPTCHA=off` is set explicitly, the same shape as the email transport guard.
- **The site key is built into the web bundle** (`VITE_TURNSTILE_SITE_KEY`, a CI repository
  variable passed as a Docker build argument, together with the legal-page variables that the
  pre-release review had found missing). Without a key the form is unchanged, so local
  development and the test suites never load Cloudflare's script. With one, the widget
  follows the theme, the submit button waits for its token, and a refused registration resets
  the widget because tokens work once.

## Retention: unconfirmed accounts, tokens and abandoned uploads (C6, 2026-10-20)

- **An account that never confirms its address is removed after 30 days**, with one warning
  mail at day 23 that carries a fresh confirmation link and the date after which the account
  goes. Until then the account is closed anyway (the guard answers 403 to unverified
  sessions), so what is removed is a row other people may have followed, mentioned or
  messaged; the erasure is the same `AccountService.erase` the member's own `DELETE /users/me`
  uses (threads tidied, counters corrected, files and sockets gone), without the last mail: an
  address that was never confirmed is written to once, not twice. The warning is stamped on
  the row (`users.expiry_warned_at`) so a missed night cannot send it again, and an account
  that already had its share of confirmation mails that hour is simply picked up by the next
  run. No index was added: the users table is scanned once a night.
- **Expired tokens go by `expires_at`**, email and refresh tokens alike. A rotated refresh
  token stays until it expires because reuse detection needs it (ADR 0011); the hourly mail
  limits look only at the last hour, so dropping expired email tokens changes nothing they
  count.
- **Uploads nobody attached within 24 hours are deleted**, rows first: the statement
  re-checks the four columns that can reference a key (`users.avatar_key`, `users.cover_key`,
  `posts.image_key`, `messages.image_key`) so an attach racing the job is refused rather than
  left pointing at a missing file; the files follow through `StorageService`, best effort, as
  everywhere.
- **One process runs the jobs.** `JobsService.runDaily` runs them in order, each on its own
  (a failure is logged, the next job still runs, a run that overlaps the previous one is
  skipped) and logs a count per job; `JobsScheduler` registers the 04:00 UTC cron through
  `SchedulerRegistry` only when `JOBS_ENABLED` is true, so a second API container with it set
  to false has no timer at all, and the test environment never runs anything it did not call
  itself. Every job takes the clock as a parameter and never uses `now()` in SQL, which is
  what makes the integration tests deterministic.

## Frequent jobs (F3, 2026-10-23)

Some work is due at a moment rather than overnight: the end of a poll now, later the weekly
digest at a member's local hour (F4), a move timing out (F5), an event reminder (F7), a story
expiring (F8). Waiting for 04:00 would make "the results are in" up to a day late.

- **A second list, every five minutes.** `JobsService.runFrequent(now)` runs `frequentJobs`
  under the same rules as the daily run (one at a time, a failure logged and the next job run,
  an overlapping run of the same kind skipped, the clock as a parameter, never `now()` in SQL);
  a daily run that is still going does not hold it up. `JobsScheduler` registers it as
  `frequent-jobs` (`*/5 * * * *`) next to the daily one, both only when `JOBS_ENABLED`. Only
  runs that did something are logged, so the log does not get a line every five minutes.
- **Idempotent through a stamp.** A frequent job claims its rows and stamps them in one
  statement (`UPDATE … SET <x>_notified_at = $now WHERE <x>_notified_at IS NULL AND <due> <= $now
  RETURNING …`), then acts on what it claimed, so two runs, or a run after a restart, never act
  twice; a row that fails is logged and the others go on. The first one is
  `PollsService.endClosed`: `polls.ended_notified_at`, then `PollEndedEvent`, which the
  notifications listener turns into `POLL_ENDED` for the author (without an actor: nobody is
  told about their own doing) and for each voter (with the author as the actor, so muting or
  blocking the author silences it like anything else they do). A job that must catch up on a
  missed window (the box was down) simply finds more rows due on its next run.
- **Tests** call `runFrequent(now)` with a clock of their own, like the daily jobs
  (`test/jobs.int-spec.ts`).

## Consequences

- Deleting an account removes the member's words from conversations others still have.
  The confirmation dialog says so.
- A registration whose address was mistyped is forgotten after a month; the warning mail is
  the only one such an address ever gets. Adding a retention rule is one more entry in
  `JobsService` and one integration test; a second API container needs `JOBS_ENABLED=false`,
  which the runbook says.
- Content the member posted keeps living only in other people's exports made earlier, and in
  backups for 14 days (`RUNBOOK.md` §7), as the privacy notice states.
- A future "anonymise instead of erase" option would be a second path, not a change to this
  one.
- Registration depends on Cloudflare being reachable from the box; the runbook (§2.7) says
  how to run without the check on purpose.
- Someone building the web app from source without the variable gets a register form with
  no widget; whether that works depends on the API's secret, so the two halves are documented
  side by side.
