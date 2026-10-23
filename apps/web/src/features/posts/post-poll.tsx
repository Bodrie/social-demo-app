import type { Poll } from '@beso/shared';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { CircleCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, formatTimeLeft } from '@/lib/format';
import { refreshPoll, useVotePoll } from './use-post-mutations';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

type PostPollProps = { postId: string; poll: Poll; className?: string };

/**
 * A post's poll (F3, decision P3). Before voting: the options as buttons, one press is the
 * final vote. Afterwards, at the close and for the author: the results, the viewer's choice
 * ticked and, once closed, the leaders marked. A poll that closed while on screen offers to
 * load its results, since the counts never came with it.
 */
export function PostPoll({ postId, poll, className }: PostPollProps) {
  const queryClient = useQueryClient();
  const vote = useVotePoll();
  // The clock when the card mounted: a poll that runs out on screen says so on its next load.
  const [now] = useState(Date.now);
  const ended = poll.closed || Date.parse(poll.closesAt) <= now;
  const counted = poll.options.every((option) => option.votes !== null);
  const total = plural(poll.totalVotes, 'vote');
  const top = Math.max(...poll.options.map((option) => option.votes ?? 0));
  const status = ended
    ? counted
      ? 'Final results'
      : 'Poll closed'
    : formatTimeLeft(poll.closesAt, now);

  return (
    <div className={cn('space-y-2', className)}>
      {counted ? (
        <ul aria-label="Poll results" className="space-y-1.5">
          {poll.options.map((option) => {
            const votes = option.votes ?? 0;
            const share = poll.totalVotes === 0 ? 0 : Math.round((votes / poll.totalVotes) * 100);
            const mine = option.id === poll.myVote;
            const leading = ended && votes === top && votes > 0;
            return (
              <li
                key={option.id}
                className="relative flex items-center gap-2 overflow-hidden rounded-md px-3 py-1.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-0 left-0',
                    leading ? 'bg-primary/30' : mine ? 'bg-primary/20' : 'bg-primary/10',
                  )}
                  style={{ width: `${share}%` }}
                />
                <span
                  className={cn('relative min-w-0 flex-1 break-words', leading && 'font-semibold')}
                >
                  {option.text}
                  {mine ? (
                    <>
                      <CircleCheckIcon
                        className="text-primary ml-1.5 inline size-4"
                        aria-hidden="true"
                      />
                      <span className="sr-only">, your vote</span>
                    </>
                  ) : null}
                </span>
                <span className="relative tabular-nums">
                  {share} %<span className="sr-only"> ({plural(votes, 'vote')})</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : ended ? null : (
        <ul aria-label="Poll" className="space-y-1.5">
          {poll.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={vote.isPending}
                className="border-primary/40 text-primary hover:bg-primary/10 focus-visible:ring-ring/50 w-full rounded-full border px-4 py-1.5 text-sm font-medium break-words transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
                aria-label={`Vote for ${option.text}`}
                onClick={() => vote.mutate({ postId, optionId: option.id })}
              >
                {option.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        {total} ·{' '}
        <time dateTime={poll.closesAt} title={formatDateTime(poll.closesAt)}>
          {status}
        </time>
        {ended && !counted ? (
          <>
            {' · '}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => void refreshPoll(queryClient, postId)}
            >
              See the results
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
