import type { UserSummary } from '@the-mesh/shared';

type Named = Pick<UserSummary, 'username' | 'name'>;

/**
 * The @mention autocomplete shows the server's search results (`GET /users?q=`: part of the
 * username or of the name, newest member first) re-filtered with the live query and ranked so
 * the obvious pick is highlighted: the exact username, then usernames starting with the query,
 * then a name with a word starting with it, then any other match in the server's order.
 * `null` means the member does not match at all.
 */
export function rankMention(user: Named, query: string): number | null {
  const needle = query.toLowerCase();
  if (needle === '') return 3;
  if (user.username === needle) return 0;
  if (user.username.startsWith(needle)) return 1;
  const name = user.name.toLowerCase();
  if (name.split(/\s+/).some((word) => word.startsWith(needle))) return 2;
  if (user.username.includes(needle) || name.includes(needle)) return 3;
  return null;
}

export function sortMentionMatches<T extends Named>(users: readonly T[], query: string): T[] {
  return users
    .map((user, index) => ({ user, index, rank: rankMention(user, query) }))
    .filter((entry): entry is { user: T; index: number; rank: number } => entry.rank !== null)
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.user);
}
