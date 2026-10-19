# 0014 – Post pages and search in Postgres

Date: 2026-10-19 · Status: Accepted · Source: `docs/IMPLEMENTATION_PLAN.md` B2

## Context

Posts had no address of their own, so nothing could be shared, and notifications (B4) and
reports (B5) would have had nothing to link to. The only search was people by name. A search
over post text needs an index; the question was whether to add a search engine or to use what
PostgreSQL already has.

## Decision

- **Every post has a page**, `/p/:postId`, showing the post with its comments open. The card's
  timestamp links there everywhere, every post's menu has "Copy link", and activity excerpts
  link to the post (and, for comments, to `/p/:postId?comment=:commentId`). The comment sort
  lives in the URL on that page (`?sort=top`) and `?comment=` rings a comment; one that is not
  among the loaded pages is fetched alone (`GET /comments/:id`) and pinned on top rather than
  paged to.
- **The page's cache entry is a one-item list** under the posts lists prefix
  (`queryKeys.posts.detail`), so likes, edits and deletes made anywhere, including on the page
  itself, reach it through the same helpers as every feed, and a deleted post becomes an
  empty page ("This post is gone") without special cases.
- **Search stays in PostgreSQL.** `posts.search_vector` is a stored generated column,
  `to_tsvector('simple', content)`, with a GIN index (migration `post_search`). The `simple`
  configuration does no stemming because the content is multilingual (Bulgarian and English
  so far); a per-language column can come later if stemming is wanted. Queries go through
  `websearch_to_tsquery`, so quotes keep phrases together, `or` works and `-word` excludes,
  and anything else in the input is treated as text, never as operators.
- **Results are newest first with the ordinary keyset**, not ranked by relevance. The ids come
  from one raw query (Prisma has no `@@` operator), the rows from the normal `postSelect`, so a
  result is exactly a feed item. A ranked order is the upgrade path (a ranked cursor like the
  comments' `?sort=top`).
- **People keep `GET /users?q=`** (`ILIKE` on name and username; names are short and a
  tsvector gains nothing). The web's `/search` page has a Posts and a People tab and a search
  box in the header; `/users` stays the directory. A `#tag` typed anywhere goes to the tag page.
- **Prisma and the generated column.** Prisma cannot define generated columns, so the column
  is `Unsupported("tsvector")` with the `@default(dbgenerated(...))` that Prisma's introspection
  reports; that keeps `migrate diff` (the CI drift check) quiet while the expression itself
  lives only in the migration SQL. The GIN index is declared in the schema (`type: Gin`).

## Consequences

- Posts written before the migration are indexed by the generated column at once; no backfill.
- Search is as current as the database: an edit is searchable immediately, a deleted post is
  gone immediately, with no indexer to run or to fall behind.
- Relevance ranking, highlighting of matched words and stemming are not provided; the backlog
  notes them for when the volume justifies it.
- A second search engine (Meilisearch, Typesense) would only be worth its operational cost
  for typo tolerance and ranking; nothing in the API shape prevents swapping the inside of
  `PostsService.search` later.
