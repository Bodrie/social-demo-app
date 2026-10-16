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

## Consequences

- The web client addresses threads by conversation id (`/messages/:conversationId`); `/messages/with/:username` resolves a person to their direct thread and redirects. Group avatars, member lists, per-member read receipts and multi-person typing all derive from the conversation's `members`.
- The conversations list is still capped at 100 and not paginated (unchanged from v2.0); pagination by `last_message_at` is possible later without a schema change.
- Presence and typing remain in-memory per API instance (ADR 0002's single-instance assumption still holds).
