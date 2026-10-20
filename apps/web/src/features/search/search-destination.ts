import { hashtagSchema } from '@beso/shared';

/** Where a typed query leads: a `#tag` straight to its page, anything else to the search page. */
export function searchDestination(raw: string): string | null {
  const q = raw.trim();
  if (!q) return null;
  if (q.startsWith('#')) {
    const tag = hashtagSchema.safeParse(q);
    if (tag.success) return `/tags/${encodeURIComponent(tag.data)}`;
  }
  return `/search?q=${encodeURIComponent(q)}`;
}
