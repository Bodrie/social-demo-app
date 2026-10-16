import { MessageSquareOffIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/current-user';
import { isApiClientError } from '@/lib/api/client';
import { usePageTitle } from '@/lib/use-page-title';
import { conversationName } from './conversation-display';
import { Thread } from './thread';
import { useConversation } from './use-conversations';

/** Loads the conversation in the address, then shows the thread. */
export function ThreadPage() {
  const { conversationId = '' } = useParams();
  const me = useCurrentUser();
  const conversation = useConversation(conversationId);
  usePageTitle(
    conversation.data ? `${conversationName(conversation.data, me.id)} · Messages` : 'Messages',
  );

  if (conversation.isPending) {
    return (
      <div className="space-y-3 p-4" aria-hidden="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-2/5 rounded-2xl" />
        <Skeleton className="ml-auto h-9 w-1/2 rounded-2xl" />
      </div>
    );
  }
  if (conversation.isError) {
    const status = isApiClientError(conversation.error) ? conversation.error.status : 0;
    if (status === 404 || status === 400) {
      return (
        <EmptyState
          icon={MessageSquareOffIcon}
          title="This conversation doesn't exist"
          description="It may have been deleted, or you are no longer part of it."
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
        onRetry={() => void conversation.refetch()}
      />
    );
  }
  return <Thread conversation={conversation.data} />;
}
