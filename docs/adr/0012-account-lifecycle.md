# 0012 – Account lifecycle: a copy of everything, and deletion that erases

Date: 2026-10-19 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` A2 (A3, registration abuse protection, will amend this record)

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

## Consequences

- Deleting an account removes the member's words from conversations others still have.
  The confirmation dialog says so.
- Content the member posted keeps living only in other people's exports made earlier, and in
  backups for 14 days (`RUNBOOK.md` §7), as the privacy notice states.
- A future "anonymise instead of erase" option would be a second path, not a change to this
  one.
