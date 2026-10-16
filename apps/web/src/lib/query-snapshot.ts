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

/**
 * `cancelQueries` (used before an optimistic update) reverts in-flight fetches; a query
 * that had no data yet is then left pending and idle, a skeleton that never resolves.
 * Once the mutation settled, fetch those again so they land with the server's final state.
 */
export function resumePendingQueries(queryClient: QueryClient, ...filters: QueryFilters[]): void {
  for (const filter of filters) {
    void queryClient.refetchQueries({
      ...filter,
      type: 'active',
      predicate: (query) =>
        query.state.status === 'pending' &&
        query.state.fetchStatus === 'idle' &&
        (filter.predicate?.(query) ?? true),
    });
  }
}
