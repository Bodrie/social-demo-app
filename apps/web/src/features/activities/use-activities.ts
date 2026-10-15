import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { fetchActivities } from '@/lib/api/activities';
import { NO_CURSOR } from '@/lib/infinite';
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
