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
  per address, served as an attachment named `the-mesh-export-<username>-<date>.json`.
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

## Consequences

- Deleting an account removes the member's words from conversations others still have.
  The confirmation dialog says so.
- Content the member posted keeps living only in other people's exports made earlier, and in
  backups for 14 days (`RUNBOOK.md` §7), as the privacy notice states.
- A future "anonymise instead of erase" option would be a second path, not a change to this
  one.
- Registration depends on Cloudflare being reachable from the box; the runbook (§2.7) says
  how to run without the check on purpose.
- Someone building the web app from source without the variable gets a register form with
  no widget; whether that works depends on the API's secret, so the two halves are documented
  side by side.
