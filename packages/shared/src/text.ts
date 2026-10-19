import { z } from 'zod';
import { paginatedSchema } from './pagination.js';

/**
 * Entities inside free text (posts, comments, messages): @mentions, #hashtags and
 * http(s) links. One parser for the API (which stores the entities) and the web (which
 * renders them), so both agree on what counts as a mention or a tag.
 *
 * - A mention is `@` + a username (3–30 of `[A-Za-z0-9_]`, compared lower-case).
 * - A hashtag is `#` + Unicode letters/digits/underscores, at least one letter, at most
 *   `HASHTAG_MAX_LENGTH`; stored lower-case, displayed as written.
 * - Both must start the text or follow a character that cannot be part of a word, so
 *   `mail@example.com` and `C#` are plain text.
 * - A link starts with `http://` or `https://`; trailing punctuation stays outside it.
 */
export const HASHTAG_MAX_LENGTH = 50;
const MENTION_MIN_LENGTH = 3;
const MENTION_MAX_LENGTH = 30;

export type TextToken =
  | { type: 'text'; raw: string; value: string }
  /** `value` is the lower-cased username, `raw` the text as written (`@Alice`). */
  | { type: 'mention'; raw: string; value: string }
  /** `value` is the lower-cased tag, `raw` the text as written (`#Weekend`). */
  | { type: 'hashtag'; raw: string; value: string }
  | { type: 'url'; raw: string; value: string };

const ENTITY_PATTERN = /(https?:\/\/[^\s<>"']+)|([@#])([\p{L}\p{N}_]+)/gu;
const WORD_CHAR = /[\p{L}\p{N}_@#]/u;
const MENTION_HANDLE = /^[A-Za-z0-9_]+$/;
const HAS_LETTER = /\p{L}/u;
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

function atWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text.at(index - 1);
  return previous === undefined || !WORD_CHAR.test(previous);
}

/** Trailing punctuation is almost never part of a pasted link; a closing bracket only when one was opened. */
function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING_PUNCTUATION, '');
  while (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
    url = url.slice(0, -1);
  }
  return url;
}

/** Splits `text` into plain runs and entities, in order; concatenating `raw` gives `text` back. */
export function tokenize(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let cursor = 0;
  const pushText = (end: number) => {
    if (end > cursor) {
      const raw = text.slice(cursor, end);
      const last = tokens.at(-1);
      if (last?.type === 'text') {
        last.raw += raw;
        last.value += raw;
      } else {
        tokens.push({ type: 'text', raw, value: raw });
      }
    }
  };

  for (const match of text.matchAll(ENTITY_PATTERN)) {
    const [whole, url, sigil, body] = match;
    const start = match.index;
    if (url !== undefined) {
      const trimmed = trimUrl(url);
      pushText(start);
      tokens.push({ type: 'url', raw: trimmed, value: trimmed });
      cursor = start + trimmed.length;
      continue;
    }
    if (sigil === undefined || body === undefined || !atWordBoundary(text, start)) continue;
    if (sigil === '@') {
      if (
        body.length < MENTION_MIN_LENGTH ||
        body.length > MENTION_MAX_LENGTH ||
        !MENTION_HANDLE.test(body)
      ) {
        continue;
      }
      pushText(start);
      tokens.push({ type: 'mention', raw: whole, value: body.toLowerCase() });
    } else {
      if (body.length > HASHTAG_MAX_LENGTH || !HAS_LETTER.test(body)) continue;
      pushText(start);
      tokens.push({ type: 'hashtag', raw: whole, value: body.toLowerCase() });
    }
    cursor = start + whole.length;
  }
  pushText(text.length);
  return tokens;
}

export type TextEntities = { mentions: string[]; hashtags: string[] };

/** The distinct usernames and tags in `text`, lower-cased, in order of first appearance. */
export function extractEntities(text: string): TextEntities {
  const mentions = new Set<string>();
  const hashtags = new Set<string>();
  for (const token of tokenize(text)) {
    if (token.type === 'mention') mentions.add(token.value);
    else if (token.type === 'hashtag') hashtags.add(token.value);
  }
  return { mentions: [...mentions], hashtags: [...hashtags] };
}

// --- hashtag pages -------------------------------------------------------------
const HASHTAG_PATTERN = /^[\p{L}\p{N}_]+$/u;

/** A tag as it appears in a URL (`/tags/:tag`): a leading `#` is tolerated, case is folded. */
export const hashtagSchema = z
  .string()
  .trim()
  .transform((value) => (value.startsWith('#') ? value.slice(1) : value))
  .pipe(
    z
      .string()
      .toLowerCase()
      .min(1, 'Tag is required')
      .max(HASHTAG_MAX_LENGTH, `At most ${HASHTAG_MAX_LENGTH} characters`)
      .regex(HASHTAG_PATTERN, 'Letters, digits and underscores only')
      .regex(HAS_LETTER, 'A tag needs at least one letter'),
  );

export const trendingTagSchema = z.object({
  tag: z.string(),
  /** Posts carrying the tag inside the trending window. */
  count: z.int().nonnegative(),
});
export type TrendingTag = z.infer<typeof trendingTagSchema>;

export const trendingTagListSchema = paginatedSchema(trendingTagSchema);
export type TrendingTagList = z.infer<typeof trendingTagListSchema>;

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
export type TrendingQuery = z.output<typeof trendingQuerySchema>;
