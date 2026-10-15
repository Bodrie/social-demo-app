import { UserXIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/features/users/use-users';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import { Thread } from './thread';

/** Resolves the username in the address to a person, then shows the thread. */
export function ThreadPage() {
  const { username = '' } = useParams();
  const profile = useProfile(username);
  usePageTitle(profile.data ? `${profile.data.name} · Messages` : 'Messages');

  if (profile.isPending) {
    return (
      <div className="space-y-3 p-4" aria-hidden="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-2/5 rounded-2xl" />
        <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
      </div>
    );
  }
  if (profile.isError) {
    if (isApiClientError(profile.error) && profile.error.status === 404) {
      return (
        <EmptyState
          icon={UserXIcon}
          title="This person doesn't exist"
          description={`There is nobody called @${username}.`}
          className="m-4"
          action={
            <Button asChild variant="outline">
              <Link to="/messages">Back to messages</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ErrorState
        className="m-4"
        message="Could not open this conversation."
        onRetry={() => void profile.refetch()}
      />
    );
  }

  const { id, name, avatarUrl } = profile.data;
  return <Thread peer={{ id, username: profile.data.username, name, avatarUrl }} />;
}
