# 0017 – Feed items: plain reposts as pointers, quotes as posts, one row per post

Date: 2026-10-20 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` C3b (owner's decisions Q9, Q-R1, Q-R2)

## Context

The owner wanted reposts, with the option of adding a few words. Two different things hide
behind that word: pointing at someone's post as it is, and publishing something of one's own
about it. The question for the data model was what a feed row is once posts can turn up in a
feed because somebody else passed them on.

## Decision

- **Two kinds behind one control.** A *plain repost* is a row in `reposts` (one per member
  and post, a toggle, never of one's own post): a pointer that puts the original into the
  reposter's profile and their followers' feeds at the time of the repost. A *quote* is a
  real `Post` with `quoted_post_id`: likeable, commentable, searchable, taggable,
  bookmarkable, repostable, deletable like any post; the same post may be quoted any number
  of times. On the web the repost button opens a popover with an optional text: empty, the
  button reposts (or undoes the repost); with words, it posts a quote through the normal
  create path.
- **A feed row is still a `Post`.** It carries `repost: { by, at } | null` (set only by the
  feed and profile unions; every other list leaves it null) instead of the separate
  `feedItem` shape the plan sketched, so every list shares the `Pages<Post>` caches and every
  helper keyed by post id keeps working: a like on a reposted item updates the original
  wherever it is shown, a like on a quote updates the quote only.
- **One row per post, at its newest occurrence.** The feed and the profile are built by a
  SQL union of the posts and the plain reposts of the member set (the viewer plus the people
  they follow; one member for a profile), `DISTINCT ON (post_id)` keeping the newest
  occurrence, ordered by `(sort_at, post_id)` with the ordinary keyset cursor; the ids come
  from SQL, the rows from `postSelect(viewerId)`. `GET /users/:id/posts?include=own` gives
  the posts alone. The union scans the members' posts and reposts on every page; that is fine
  for a network of this size and is the first thing to materialise if it ever is not.
- **Embeds are one level deep.** `quotedPost` carries the original's id, author, text,
  picture and time, never the original's own embed. When the original is deleted the quote's
  `quoted_post_id` is set to null and `was_quote` keeps the frame, shown as "This post is
  unavailable" (B5a will use the same frame for blocked authors).
- **Counted on the post.** `posts.repost_count` is the plain reposts plus the quotes, kept
  in step by `PostsService` (repost, undo, quote, delete of a quote) and corrected when an
  account is erased, like `reactions_count` (ADR 0012).
- **Told like everything else.** `post.reposted` / `post.unreposted` / `post.quoted`
  events; a quote emits `post.quoted` instead of `post.created`, so the activity feed says
  "bob quoted alice's post" once rather than "published a post" as well. Activities store
  the original's author as `targetUser` ("bob reposted alice's post", which closes the
  backlog's "post excerpts without author"); notifications `POST_REPOSTED` (post = the
  original) and `POST_QUOTED` (post = the quote, leading to its page) go to the original's
  author, and an undo retracts them.

## Consequences

- Nothing indexes plain reposts: tags, search and bookmarks see originals and quotes only.
- The repost trigger keeps the name "Repost" and shows its state through the count and the
  colour; the popover's button says "Undo repost" when there is one to undo.
- After a repost the item stays where it is in the lists the viewer is looking at; where the
  repost itself appears (the viewer's profile, their followers' feeds) comes from the server
  on the next load, like a new follower's posts do.
- A quote of a quote shows the quoted quote's words, not the post under it; following the
  embed's link shows the rest.
