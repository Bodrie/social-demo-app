import { UserXIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/features/users/use-users';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import { useEnsureDirect } from './use-conversations';

/** `/messages/with/:username`: finds (or starts) the direct thread and moves to its address. */
export function WithUserPage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const profile = useProfile(username);
  const ensureDirect = useEnsureDirect();
  const startedFor = useRef<string | null>(null);
  usePageTitle('Messages');

  const userId = profile.data?.id;
  const { mutate } = ensureDirect;
  useEffect(() => {
    if (!userId || startedFor.current === userId) return;
    startedFor.current = userId;
    mutate(userId, {
      onSuccess: (conversation) => void navigate(`/messages/${conversation.id}`, { replace: true }),
    });
  }, [userId, mutate, navigate]);

  if (profile.isError && isApiClientError(profile.error) && profile.error.status === 404) {
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
  if (profile.isError || ensureDirect.isError) {
    const message =
      ensureDirect.isError && isApiClientError(ensureDirect.error)
        ? ensureDirect.error.message
        : 'Could not open this conversation.';
    return (
      <ErrorState
        className="m-4"
        message={message}
        onRetry={() => {
          if (profile.isError) void profile.refetch();
          else if (userId)
            mutate(userId, {
              onSuccess: (c) => void navigate(`/messages/${c.id}`, { replace: true }),
            });
        }}
      />
    );
  }
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-9 w-2/5 rounded-2xl" />
      <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
    </div>
  );
}
