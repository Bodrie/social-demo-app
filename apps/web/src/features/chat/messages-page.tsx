import { cn } from 'cn';
import { MessageCircleIcon } from 'lucide-react';
import { Outlet, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/lib/use-page-title';
import { ConversationList } from './conversation-list';
import { NewMessageDialog } from './new-message-dialog';

/** Two panes from `md` up; on phones the list and the thread take turns. */
export function MessagesPage() {
  const { username } = useParams();
  const threadOpen = Boolean(username);

  return (
    <div className="bg-card flex h-[calc(100svh-6.5rem)] min-h-[28rem] overflow-hidden rounded-xl border shadow-sm">
      <aside
        aria-label="Conversations"
        className={cn('w-full shrink-0 border-r md:w-80', threadOpen ? 'hidden md:block' : 'block')}
      >
        <ConversationList />
      </aside>
      <section
        aria-label="Conversation"
        className={cn('min-w-0 flex-1', threadOpen ? 'block' : 'hidden md:block')}
      >
        <Outlet />
      </section>
    </div>
  );
}

export function MessagesIndex() {
  usePageTitle('Messages');
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <MessageCircleIcon className="size-6" aria-hidden="true" />
      </div>
      <p className="text-foreground font-semibold">Your messages</p>
      <p className="max-w-xs text-sm">Pick a conversation on the left, or start a new one.</p>
      <NewMessageDialog>
        <Button variant="outline" size="sm">
          New message
        </Button>
      </NewMessageDialog>
    </div>
  );
}
