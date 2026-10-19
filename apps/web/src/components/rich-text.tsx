import { type TextToken, type UserSummary, tokenize } from '@the-mesh/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { displayUrl } from '@/lib/format';

const URL_DISPLAY_LENGTH = 48;

/** `example.com/some/long/path`, cut with an ellipsis past a point; the full address is the title. */
function shortenUrl(url: string): string {
  const bare = displayUrl(url);
  return bare.length > URL_DISPLAY_LENGTH ? `${bare.slice(0, URL_DISPLAY_LENGTH - 1)}…` : bare;
}

/** Tokens with their character offset, which is the natural key of a run inside the text. */
function tokensWithOffsets(text: string): Array<{ token: TextToken; offset: number }> {
  const entries: Array<{ token: TextToken; offset: number }> = [];
  let offset = 0;
  for (const token of tokenize(text)) {
    entries.push({ token, offset });
    offset += token.raw.length;
  }
  return entries;
}

type RichTextProps = {
  text: string;
  /** Only these members are linked; any other `@handle` stays plain text. Omit to link none. */
  mentions?: ReadonlyArray<Pick<UserSummary, 'username'>>;
  /** Link `#tags` to their page (posts and comments); chat leaves them as text. */
  hashtags?: boolean;
  as?: 'p' | 'span';
  className?: string;
  /** Overrides the link colour, e.g. inside a filled chat bubble. */
  linkClassName?: string;
};

/**
 * Text with its entities turned into links: mentions to profiles, hashtags to tag pages, URLs
 * to new tabs. Uses the shared tokenizer, so what the API stored is exactly what gets linked.
 */
export function RichText({
  text,
  mentions,
  hashtags = false,
  as: Tag = 'p',
  className,
  linkClassName,
}: RichTextProps) {
  const linked = new Set(mentions?.map((user) => user.username));
  const link = cn('text-primary font-medium underline-offset-2 hover:underline', linkClassName);
  return (
    <Tag className={className}>
      {tokensWithOffsets(text).map(({ token, offset }) => {
        switch (token.type) {
          case 'mention':
            return linked.has(token.value) ? (
              <Link key={offset} to={`/u/${token.value}`} className={link}>
                {token.raw}
              </Link>
            ) : (
              token.raw
            );
          case 'hashtag':
            return hashtags ? (
              <Link key={offset} to={`/tags/${encodeURIComponent(token.value)}`} className={link}>
                {token.raw}
              </Link>
            ) : (
              token.raw
            );
          case 'url':
            return (
              <a
                key={offset}
                href={token.value}
                title={token.value}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={cn(link, 'break-all')}
              >
                {shortenUrl(token.value)}
              </a>
            );
          default:
            return token.raw;
        }
      })}
    </Tag>
  );
}
