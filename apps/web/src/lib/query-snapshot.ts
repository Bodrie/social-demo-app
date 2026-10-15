import type { QueryClient, QueryFilters, QueryKey } from '@tanstack/react-query';

export type QuerySnapshot = [QueryKey, unknown][];

/** Captures the current data of every query matching the filters, for optimistic rollbacks. */
export function snapshotQueries(
  queryClient: QueryClient,
  ...filters: QueryFilters[]
): QuerySnapshot {
  return filters.flatMap((filter) => queryClient.getQueriesData(filter));
}

export function restoreQueries(queryClient: QueryClient, snapshot: QuerySnapshot): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}
