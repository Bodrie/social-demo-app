# 0013 – Text entities: mentions, hashtags and links

Date: 2026-10-19 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` B1

## Context

Post and comment text was opaque: `@alice` did not lead anywhere, `#weekend` grouped nothing
and a pasted address was not a link. Notifications (plan B4) need to know who was mentioned,
and search (B2) and discovery want tags. Parsing on the client alone cannot provide either, and
parsing differently on the two sides would make the web link things the API never recorded.

## Decision

- **One parser, in `packages/shared/src/text.ts`.** `tokenize(text)` splits a text into plain
  runs, mentions, hashtags and links; `extractEntities(text)` lists the distinct mentions and
  tags. The API stores what it extracts and the web renders what it tokenizes, so both agree.
- **Rules.** A mention is `@` + a username (3–30 of `[A-Za-z0-9_]`, matched lower-case). A
  hashtag is `#` + Unicode letters, digits and underscores, at least one letter, at most 50
  characters; stored lower-case, displayed as written, so `#Weekend` and `#weekend` are one
  tag. Both must start the text or follow a character that cannot be part of a word, so
  `mail@example.com` and `C#` stay text. Only `http://` and `https://` addresses are links;
  trailing punctuation and unbalanced closing brackets stay outside them.
- **Entities are resolved and stored when the text is saved.** `PostsService` and
  `CommentsService` look the mentioned usernames up (`UsersService.findByUsernames`); unknown
  names are ignored, never an error. Rows go to `post_mentions`, `comment_mentions` and
  `post_hashtags` (migration `text_entities`) and are replaced as a whole on every edit.
  Mentions are stored by user id, so a renamed member still links to the right profile; the
  tag rows copy the post's `created_at` so a tag page pages with the usual keyset and no join.
  Comments carry mentions only: tags in comments would group nothing anyone looks for.
- **Responses carry the resolved entities.** Posts and comments answer
  `mentions: UserSummary[]` (resolved at read time) and posts `hashtags: string[]`. The web
  links only the mentions in that list, so `@nobody` stays plain text. If a mentioned member
  renames, the written `@oldname` no longer matches and renders plain: accepted.
- **`user.mentioned` is a domain event** (`UserMentionedEvent`, `common/mentions.ts`), emitted
  once per member new to the text, never for the author about themselves. Nothing listens yet;
  notifications (B4) will. Activities do not record mentions: they describe what followed
  people did, not what happened to the reader.
- **Tag pages and trending.** `GET /tags/:tag/posts` (the `:tag` parameter is folded like the
  parser folds tags and may carry a leading `#`) lists the posts of a tag with the normal
  cursor; `GET /tags/trending?limit=` counts posts per tag over the last seven days with one
  grouped query and no cache (the window is indexed; a cache goes in when the query shows up
  in the logs).
- **Web.** `RichText` renders any text with its entities (mentions to profiles when resolved,
  tags to `/tags/:tag` where asked, links in a new tab with `rel="noopener noreferrer nofollow"`
  and a shortened label); it is used by post cards, comments and chat bubbles (links only
  there). `MentionTextarea` is the textarea with the `@` autocomplete, following the ARIA
  combobox pattern (the textarea keeps focus and the keyboard, the listbox is announced through
  `aria-activedescendant`); it backs the composer, the comment box and `InlineEditor`.
  The tag page reuses `PostList` under the posts lists prefix, so likes, edits and deletes
  reach it; a `TrendingCard` sits in the right bar and stays hidden while nothing is tagged.

## Consequences

- Mentions and tags written before this change are not indexed; editing such a post or
  comment indexes it. No backfill: the demo data is reseeded anyway.
- Hashtags of comments, `#` autocomplete and a cache for trending are deliberately out; the
  backlog has the cache note.
- Notifications can subscribe to `user.mentioned` without touching the posts or comments code.
