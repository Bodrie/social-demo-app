import { type PostEmbed, isAvailableEmbed } from '@beso/shared';
import { cn } from 'cn';
import { Link } from 'react-router';
import { RichText } from '@/components/rich-text';
import { UserAvatar } from '@/components/user-avatar';
import { formatDateTime, formatRelativeTime } from '@/lib/format';

type QuotedPostCardProps = {
  embed: PostEmbed;
  /** Inside the repost popover: a preview, no picture. */
  compact?: boolean;
  className?: string;
};

/** The original inside a quote post (ADR 0017), or the frame left once it was deleted. */
export function QuotedPostCard({ embed, compact = false, className }: QuotedPostCardProps) {
  if (!isAvailableEmbed(embed)) {
    return (
      <div
        className={cn(
          'text-muted-foreground rounded-lg border border-dashed p-3 text-sm',
          className,
        )}
      >
        This post is unavailable
      </div>
    );
  }
  return (
    <div className={cn('rounded-lg border p-3', className)}>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <UserAvatar user={embed.author} size="sm" />
        <Link
          to={`/u/${embed.author.username}`}
          className="min-w-0 truncate font-semibold hover:underline"
        >
          {embed.author.name}
        </Link>
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          @{embed.author.username} ·{' '}
          <Link to={`/p/${embed.id}`} className="hover:underline">
            <time dateTime={embed.createdAt} title={formatDateTime(embed.createdAt)}>
              {formatRelativeTime(embed.createdAt)}
            </time>
            <span className="sr-only">
              , {formatDateTime(embed.createdAt)}, open the quoted post
            </span>
          </Link>
        </span>
      </div>
      <RichText
        text={embed.content}
        mentions={[]}
        className="mt-2 line-clamp-6 text-sm break-words whitespace-pre-wrap"
      />
      {embed.imageUrl && !compact ? (
        <img
          src={embed.imageUrl}
          alt={`Posted by ${embed.author.name}`}
          loading="lazy"
          decoding="async"
          className="mt-2 max-h-64 w-full rounded-md border object-cover"
        />
      ) : null}
    </div>
  );
}
