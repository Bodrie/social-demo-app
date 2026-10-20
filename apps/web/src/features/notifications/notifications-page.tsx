import { BellIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { usePageTitle } from '@/lib/use-page-title';
import { NotificationItem } from './notification-item';
import { useMarkAllNotificationsRead, useNotifications } from './use-notifications';

export function NotificationsPage() {
  usePageTitle('Notifications');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Likes, comments, reactions, follows and mentions of you.
        </p>
      </div>
      <NotificationList />
    </div>
  );
}

function NotificationList() {
  const notifications = useNotifications();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const sentinelRef = useInfiniteScroll({
    enabled: notifications.hasNextPage && !notifications.isFetchingNextPage,
    onReachEnd: () => void notifications.fetchNextPage(),
  });

  // Once the first page is on screen everything up to now counts as seen: the bell drops,
  // the rows keep the marks they came with.
  const marked = useRef(false);
  const loaded = notifications.data !== undefined;
  useEffect(() => {
    if (!loaded || marked.current) return;
    marked.current = true;
    markAllRead();
  }, [loaded, markAllRead]);

  if (notifications.isPending) return <NotificationListSkeleton />;
  if (notifications.isError) {
    return (
      <ErrorState
        message="Could not load your notifications."
        onRetry={() => void notifications.refetch()}
      />
    );
  }

  const items = flattenPages(notifications.data);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellIcon}
        title="Nothing here yet"
        description="When someone likes, comments on or reacts to your posts, follows you or mentions you, it shows up here."
      />
    );
  }

  return (
    <div>
      <ul
        aria-label="Notifications"
        aria-busy={notifications.isFetchingNextPage}
        className="bg-card divide-y overflow-hidden rounded-xl border"
      >
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            className="px-4 py-3"
          />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {notifications.isFetchingNextPage ? (
        <div className="text-muted-foreground flex justify-center py-4">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading more</span>
        </div>
      ) : null}
      {notifications.hasNextPage ? null : (
        <p className="text-muted-foreground py-4 text-center text-sm">You&apos;re all caught up.</p>
      )}
    </div>
  );
}

function NotificationListSkeleton() {
  return (
    <div className="bg-card divide-y rounded-xl border" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
