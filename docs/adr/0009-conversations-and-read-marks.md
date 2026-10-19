# 0009 – Conversations as records, read state per member

Date: 2026-10-16 · Status: Accepted · Plan: §4.8 (8e)

## Context

Until v2.1 a message had a sender and a recipient, "conversations" were derived on the fly (`DISTINCT ON` the other party) and read state was a `read_at` stamp on every message. That shape cannot express a group: there is no recipient, no title, no member list, and "read" has to be answered per person.

## Decision

- `conversations` is a table with a `kind` (`direct` | `group`), an optional `title`, a creator and a denormalised `last_message_at`. A direct conversation is unique per pair through `direct_key` (`<smaller user id>:<larger user id>`) and is created the first time either side opens the thread (`PUT /conversations/direct/:userId`); it is listed only once it has a message. A group is created on purpose (`POST /conversations`) and is listed right away.
- `conversation_members` holds who is in a conversation and their read mark: `last_read_at`. Everything created up to that moment counts as read. Writing a message moves the author's own mark. Unread counts are computed from it (`messages from others with created_at > last_read_at`), and so are read receipts ("Seen" when the other member's mark passed my last message; "Seen by Bob", "Seen by everyone" in a group). Messages carry no read state of their own.
- Messages belong to a conversation (`conversation_id`), not to a recipient. Every list, send, read and member change goes through a membership check, and non-members get a 404 so the existence of a group never leaks.
- Membership changes stay small: any member can add people, anyone can leave, the last one out deletes the group. No admin roles, no renaming, no removing others. Those are backlog items if they are ever wanted.
- Realtime fan-out uses the existing per-user rooms: domain events carry the member ids, and the gateway emits to each `user:<id>` room (never to an empty room list, which socket.io treats as "everyone"). Membership changes push a `conversation:update` reference and the client refetches the conversation; a member who left gets `conversation:removed`. Typing relays look the membership up per signal; relays are chained per socket so a "stopped" can never overtake a "started".
- The migration `20261016101500_group_conversations` carries existing direct messages over: one conversation per pair, both people as members, each member's mark set to the newest message they had read or written.

## Amendment 2026-10-19: chat bubbles (plan B3a)

Messages that arrive while the viewer is elsewhere in the app surface as **chat bubbles**:
round avatars docked at the right edge (a row under the header on phones), one per
conversation, four at most, newest nearest the corner, each carrying the conversation's unread
count. A bubble opens a **chat window**, a docked mini thread (two side by side on a desktop,
one full-width panel on a phone) that reuses the messages page's `Thread` and composer and
therefore its cache and read marks: opening a window reads the thread, a message into an open
window is read on arrival, and a bubble on its own never reads anything. Minimising keeps the
bubble; the X hides a conversation until its next message; visiting the messages page clears
the layer (the page owns the threads); the viewer's own messages never raise a bubble. State is
per tab and in memory. The preference `chatBubbles` (default on) lives in `users.settings`, a
JSON column validated by the shared `userSettingsSchema` and changed through
`PATCH /users/me/settings`; two more keys (`messageSound`, `browserNotifications`) are reserved
for the chat follow-ups. Reads are now pushed to **every** member, the reader included, so the
reader's other tabs lower their badge (review L9).

## Amendment 2026-10-19: chat follow-ups (plan B3b)

- **Deleting a message.** The sender can take a message back at any age. It is a soft delete:
  `messages.deleted_at` is set, the text is cleared and the picture is discarded, but the row
  keeps its place so ordering, keyset cursors and read marks hold. Everyone sees "Message
  deleted" (the list snippet too, when it was the newest message); deleted messages count for
  nobody as unread. `DELETE /conversations/:id/messages/:messageId` answers the message as it is
  now, and `message:deleted` pushes the same to every member.
- **Group roles.** `conversation_members.role` (`admin` | `member`). The creator starts as admin
  (the migration backfills existing groups from `created_by_id`, falling back to the
  longest-standing member). Admins rename the group (`PATCH /conversations/:id`), remove people
  (`DELETE /conversations/:id/members/:userId`) and hand the role on or take it back
  (`PUT /conversations/:id/members/:userId/role`); demoting the last admin is refused. Anyone
  still adds people and leaves. When the last admin leaves, is removed or deletes their account,
  the longest-standing member is promoted (`promoteIfNoAdminSql`, run inside the same
  transaction). This supersedes the "no admin roles, no renaming, no removing others" line above.
- **System lines.** Membership changes and renames are written into the thread by the server as
  messages of `kind = system` with a small JSON subject (`system_meta`, the shared
  `systemLineSchema`: type, actor, people concerned, new title, with names as at the time so a
  line still reads after someone left). They are pushed like any message (`message:new`), move
  the conversation up the list and become its snippet, but count for nobody as unread, move no
  read mark, raise no chat bubble and no alert, and cannot be deleted.
- **List pagination.** `GET /conversations` is keyset-paginated on the activity stamp
  (`COALESCE(last_message_at, created_at)`, so a new group without messages sorts by its
  creation) and the id; the page's ids come from SQL and are hydrated afterwards. The web list
  is an infinite query and loads more on scroll.
- **Reading UX.** A "n new messages" pill when a push arrives while the reader is scrolled up;
  the unread total in the tab title (`(3) Messages · The Mesh`, one owner for the title and one
  for the badge in `lib/document-title.ts`); a sound (Web Audio, no asset) and a browser
  `Notification` for messages that arrive while the tab is hidden, each behind its account
  preference (`messageSound`, `browserNotifications`). The permission is requested only from the
  Settings switch.

## Consequences

- The web client addresses threads by conversation id (`/messages/:conversationId`); `/messages/with/:username` resolves a person to their direct thread and redirects. Group avatars, member lists, per-member read receipts and multi-person typing all derive from the conversation's `members`.
- The conversations list is still capped at 100 and not paginated (unchanged from v2.0); pagination by `last_message_at` is possible later without a schema change.
- Presence and typing remain in-memory per API instance (ADR 0002's single-instance assumption still holds).
