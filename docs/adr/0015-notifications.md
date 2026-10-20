# 0015 – Notifications: what happened to your own things, as rows, over the chat socket

Date: 2026-10-20 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` B4

## Context

Activities (`activities`) tell a member what the people they follow did. Nothing told them
what was done *to them*: a like on their post, a comment, a reaction on their comment, a new
follower, a mention. Chat has its own unread counts and pushes since ADR 0009, so the question
was how to add the second kind of "something for you" without a second delivery system.

## Decision

- **A `notifications` table, written from the domain events.** `NotificationsListener` is the
  twin of `ActivitiesListener`: it subscribes to `post.liked`, `comment.created` (recipient
  the post's author), the new `comment.reacted` (emitted only for a person's first reaction on
  a comment, not for a switch of emoji), `user.followed` and `user.mentioned` (ADR 0013), and
  never writes a row for the actor's own doing. `post.unliked` and `user.unfollowed` delete
  the row, read or not, as they delete the activity. Chat stays out.
- **One row per (recipient, type, actor, post, comment).** A repeat of the same event (a
  reaction taken off and put back, a mention edited out and in) refreshes the row, new and
  unread again, rather than adding one: the service looks the key up before writing; the
  unique index backs it for the types whose subjects are all set and `post_id` is stored for
  the comment types too, so only a follow has nulls in the key. The plan's `NULLS NOT
  DISTINCT` unique and partial unread index were not used: Prisma cannot declare either, and a
  hand-written one would trip `db:check`; a plain `(user_id, read_at)` index serves the count.
  Coalescing ("alice and 3 others") is a later layer; the key makes it possible without a
  migration.
- **Read marks are the member's, in two grains.** `POST /notifications/read` marks everything
  up to now (the page calls it when it opens); `POST /notifications/:id/read` marks one.
  `GET /notifications/unread-count` is what the bell shows; the list is keyset-paginated like
  every list. Rows older than 90 days are removed by the daily jobs (ADR 0012 amendment).
- **Delivery rides the chat socket.** `notification.created` → `notification:new` to the
  recipient's `user:<id>` room with the full item, through the gateway's `emitTo` like every
  other push; nothing is pushed for read marks, other tabs refetch the count when they regain
  focus, as `me` does. The web side is the one socket owner, `ChatProvider`, which validates
  the push against the shared schema and hands it to the notifications cache
  (`receiveNotification`): the item tops the loaded list and the count goes up, unless the
  item replaced an unread copy of itself.
- **On the web**: a bell with the count in the header, a **Notifications** entry with the same
  badge in the navigation, the unread total of messages and notifications in the tab title;
  `/notifications` lists newest first with the unread rows tinted and marks everything read
  once its first page is on screen, keeping the rows as they came so what was new stays
  visible until the next visit. Sentences live in `notification-text.tsx` next to
  `activity-text.tsx`; the excerpt leads to the post or the comment (`?comment=`, ADR 0014).

## Consequences

- Every new event that concerns a person is one `@OnEvent` method in the listener and one
  sentence in `notification-text.tsx`; reposts (C3b) and replies (C2) add theirs that way.
- A refreshed row changes its `createdAt`, so "bob reacted" can move to the top of the list
  after bob took the reaction off and put it back; that is the chosen trade-off against
  piling up rows.
- Deleting a post, a comment or an account cascades the rows; nothing needs a listener.
- Browser or push notifications for these (E2) subscribe to the same event.
