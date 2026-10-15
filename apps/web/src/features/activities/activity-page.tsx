import { ActivityIcon, Loader2Icon } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { usePageTitle } from '@/lib/use-page-title';
import { ActivityItem } from './activity-item';
import { useActivities } from './use-activities';

export function ActivityPage() {
  usePageTitle('Activity');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Activity</h1>
        <p className="text-muted-foreground text-sm">What the people you follow are up to.</p>
      </div>
      <ActivityList />
    </div>
  );
}

function ActivityList() {
  const activities = useActivities();
  const sentinelRef = useInfiniteScroll({
    enabled: activities.hasNextPage && !activities.isFetchingNextPage,
    onReachEnd: () => void activities.fetchNextPage(),
  });

  if (activities.isPending) return <ActivityListSkeleton />;
  if (activities.isError) {
    return (
      <ErrorState
        message="Could not load the activity."
        onRetry={() => void activities.refetch()}
      />
    );
  }

  const items = flattenPages(activities.data);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Nothing here yet"
        description="Follow people and their posts, likes and comments will show up here."
      />
    );
  }

  return (
    <div>
      <ul
        aria-label="Activity"
        aria-busy={activities.isFetchingNextPage}
        className="bg-card divide-y rounded-xl border"
      >
        {items.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} className="px-4 py-3" />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {activities.isFetchingNextPage ? (
        <div className="text-muted-foreground flex justify-center py-4">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading more</span>
        </div>
      ) : null}
      {activities.hasNextPage ? null : (
        <p className="text-muted-foreground py-4 text-center text-sm">You&apos;re all caught up.</p>
      )}
    </div>
  );
}

function ActivityListSkeleton() {
  return (
    <div className="bg-card divide-y rounded-xl border" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
