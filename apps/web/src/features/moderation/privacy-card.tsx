import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { UserSummary } from '@beso/shared';
import { Link } from 'react-router';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type Pages, flattenPages } from '@/lib/infinite';
import { useBlockedMembers, useMutedMembers, useUnblock, useUnmute } from './use-moderation';

type MemberListProps = {
  label: string;
  query: UseInfiniteQueryResult<Pages<UserSummary>>;
  action: string;
  onAction: (user: UserSummary) => void;
  pending: boolean;
  empty: string;
};

function MemberList({ label, query, action, onAction, pending, empty }: MemberListProps) {
  if (query.isPending) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return <p className="text-destructive text-sm">Could not load this list.</p>;
  }
  const members = flattenPages(query.data);
  if (members.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <div className="space-y-2">
      <ul aria-label={label} className="divide-y rounded-lg border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2">
            <UserAvatar user={member} size="sm" />
            <Link to={`/u/${member.username}`} className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{member.name}</span>{' '}
              <span className="text-muted-foreground">@{member.username}</span>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onAction(member)}
              aria-label={`${action} @${member.username}`}
            >
              {action}
            </Button>
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Show more
        </Button>
      ) : null}
    </div>
  );
}

/** Settings → Privacy: whom the viewer blocked and muted, with the way back (ADR 0016). */
export function PrivacyCard() {
  const blocked = useBlockedMembers();
  const muted = useMutedMembers();
  const unblock = useUnblock();
  const unmute = useUnmute();
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>Privacy</h2>
        </CardTitle>
        <CardDescription>
          Blocked members cannot see you, nor you them. Muted members simply leave your feeds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Blocked</h3>
          <MemberList
            label="Blocked members"
            query={blocked}
            action="Unblock"
            onAction={(member) => unblock.mutate(member)}
            pending={unblock.isPending}
            empty="You have not blocked anyone."
          />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Muted</h3>
          <MemberList
            label="Muted members"
            query={muted}
            action="Unmute"
            onAction={(member) => unmute.mutate(member)}
            pending={unmute.isPending}
            empty="You have not muted anyone."
          />
        </section>
      </CardContent>
    </Card>
  );
}
