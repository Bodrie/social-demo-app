import { type QueryClient, infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import type { Activity } from '@beso/shared';
import { fetchActivities } from '@/lib/api/activities';
import { NO_CURSOR, type Pages, filterItems, prependItem } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const activitiesQueryOptions = infiniteQueryOptions({
  queryKey: queryKeys.activities.list,
  queryFn: ({ pageParam, signal }) => fetchActivities({ cursor: pageParam, signal }),
  initialPageParam: NO_CURSOR,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

/** Shared by the sidebar card (first page only) and the Activity page (all pages). */
export function useActivities() {
  return useInfiniteQuery(activitiesQueryOptions);
}

/**
 * The same thing happening again: a like after an unlike, a follow after an unfollow. Undoing
 * pushes nothing, so the older line is still on screen when the new one arrives. A profile
 * picture can change any number of times, and each change keeps its own line, as in the list.
 */
function happenedAgain(older: Activity, newer: Activity): boolean {
  return (
    newer.type !== 'PROFILE_UPDATED' &&
    older.type === newer.type &&
    older.actor.id === newer.actor.id &&
    older.post?.id === newer.post?.id &&
    older.comment?.id === newer.comment?.id &&
    older.targetUser?.id === newer.targetUser?.id
  );
}

/**
 * An `activity:new` push (C7): the item goes on top of the loaded list, which the sidebar card
 * and the Activity page share; nothing happens when the list was never loaded.
 */
export function receiveActivity(queryClient: QueryClient, activity: Activity): void {
  queryClient.setQueryData<Pages<Activity>>(
    queryKeys.activities.list,
    (pages) =>
      pages &&
      prependItem(
        filterItems(pages, (item) => item.id !== activity.id && !happenedAgain(item, activity)),
        activity,
      ),
  );
}
