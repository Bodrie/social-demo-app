# 0016 – Moderation: blocks that cut both ways, mutes for oneself, reports for the admins

Date: 2026-10-20 · Status: Accepted (member side, B5a; the admin role and queue follow as B5b) · Source: `docs/IMPLEMENTATION_PLAN.md` B5

## Context

The site opens to strangers. A member needs a way to make another member disappear from their
world, a quieter way to stop seeing someone without the other noticing, and a way to tell the
people who run the site about something wrong. The admin side (who reads the reports, what they
can do) is the second half of this decision and lands with B5b.

## Decision

- **A block works both ways and is enforced in the services, never by the client.** `blocks`
  rows are one-directional (who blocked whom), but every rule asks "is there a block between
  these two": nothing of either side reaches the other. Concretely: posts, reposts, quotes and
  comments of the other are left out of the feed, the profile, tag pages, search, bookmarks and
  the activity feed; a post of the other does not exist by its address either (404); likes,
  reposts, quotes, comments and reactions on the other's things are refused with `403 BLOCKED`;
  the follows between the two are removed by the block (through the unfollow event, so their
  activity and notification rows go too) and new ones are refused; a direct thread between the
  two is hidden from the list and closed to both (404), and none can be started; mentions do
  not notify and what the other notified about before leaves the list; people search and
  suggestions leave the other out. The profile of the other comes
  **reduced**: who it is (name, username, avatar, join date) and the `blocked` / `blockedMe`
  flags, with no bio, cover, counts or follow flags. Only the blocker sees the way back.
- **A mute works for the muter alone.** The muted member's posts, reposts and quotes leave
  the muter's feed, tag pages, search and bookmarks, their doings leave the activity feed, and
  their notifications to the muter are silenced. Everything else stays: the muted member sees
  and does everything as before, their profile page still shows their posts to the muter (who
  went there on purpose), and their comments still show. The profile carries `muted`.
- **One `VisibilityService` answers the question for everyone.** `blockedIds(viewer)` (both
  directions), `hiddenAuthorIds(viewer)` (blocked plus muted, for feeds), `isBlockedBetween`,
  `assertNotBlocked` (the 403) and `isSilencedFor` (notifications). Every list service puts
  the ids into its `where` (or `NOT (author_id = ANY($ids))` in the raw unions), `toPost`
  masks the embed of a quote whose original author is hidden behind the "unavailable" frame,
  and `UsersService.present` chooses between the whole and the reduced profile. The module is
  global so that no list module has to import it.
- **Reports keep the target by id only.** `reports(reporter, target_type, target_id, reason,
  details, status, resolved_by, resolved_at)`: one open report per reporter and target (409),
  the target must exist now (404) and must not be the reporter's own (400), ten an hour per
  address. A post, a comment or a member can be reported from its menu with a reason from a
  fixed list and optional details; the reporter gets a thank-you, never the outcome. The admin
  queue reads the rows and may find the target gone.
- **On the web** the profile header has a "Profile options" menu (Mute/Unmute, Report, Block
  with a confirmation); either side of a block sees the reduced header with no tabs below it,
  the blocker an Unblock button; the post and comment menus carry "Report" for everyone but
  the author; Settings → **Privacy** lists blocked and muted members with the way back. A
  block invalidates every list the client holds rather than patching them one by one.

## Consequences

- Comment counts on posts still include hidden comments; the list hides them, the number is
  the post's. Acceptable for now, noted here so nobody hunts for the discrepancy.
- A blocked member may still see the other's name in a third party's content (a mention, a
  "bob reposted alice's post" line in someone else's feed); the block hides what the two do
  with each other, not every trace of them on the site.
- The visibility lists are read per request, not cached: two or three small indexed queries
  per list call. Fine at this size; a request-scoped cache is the first improvement if the
  query log says so.
- Private accounts (C4) will build on the same `VisibilityService`.
