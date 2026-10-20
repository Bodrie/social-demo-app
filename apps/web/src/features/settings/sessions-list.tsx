import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@the-mesh/shared';
import { toast } from 'sonner';
import { ErrorState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { endSession, fetchSessions } from '@/lib/api/account';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const deviceName = (session: Session): string =>
  `${session.browser ?? 'Unknown browser'} on ${session.os ?? 'an unknown system'}`;

/** The member's signed-in devices, this one marked, each with its own "Sign out". */
export function SessionsList() {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: ({ signal }) => fetchSessions(signal),
  });
  const end = useMutation({
    mutationFn: endSession,
    onSuccess: () => {
      toast.success('That device was signed out');
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    },
    onError: () => toast.error('Could not sign out that device'),
  });

  if (sessions.isPending) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (sessions.isError) {
    return (
      <ErrorState message="Could not load your sessions." onRetry={() => void sessions.refetch()} />
    );
  }
  return (
    <ul aria-label="Sessions" className="divide-y rounded-lg border">
      {sessions.data.items.map((session) => {
        const name = deviceName(session);
        return (
          <li key={session.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {name}
                {session.current ? <Badge variant="secondary">This device</Badge> : null}
              </p>
              <p className="text-muted-foreground text-xs">
                Signed in{' '}
                <time dateTime={session.createdAt} title={formatDateTime(session.createdAt)}>
                  {formatRelativeTime(session.createdAt)}
                </time>
                {' · '}last active{' '}
                <time dateTime={session.lastUsedAt} title={formatDateTime(session.lastUsedAt)}>
                  {formatRelativeTime(session.lastUsedAt)}
                </time>
                {session.ip ? ` · ${session.ip}` : ''}
              </p>
            </div>
            {session.current ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={end.isPending}
                aria-label={`Sign out ${name}`}
                onClick={() => end.mutate(session.id)}
              >
                Sign out
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
