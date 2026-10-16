import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Helpers for optimistic toggles (likes, follows, reactions). Such a toggle touches one item
 * that may sit in many cached lists, so it must only ever touch that item: rolling back a
 * snapshot of whole lists would also undo every other toggle made in the meantime.
 */

/**
 * Cancels the fetches already on their way for these queries (an older answer landing after
 * the optimistic update would overwrite it) and returns the ones it interrupted, for
 * `resumeQueries` once the mutation settled.
 */
export async function holdQueries(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
): Promise<QueryKey[]> {
  const interrupted = queryKeys.filter((queryKey) => {
    const fetchStatus = queryClient.getQueryState(queryKey)?.fetchStatus;
    return fetchStatus !== undefined && fetchStatus !== 'idle';
  });
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey, exact: true })),
  );
  return interrupted;
}

/**
 * Runs the interrupted fetches again so they land with the server's final state. Without it a
 * query that had no data yet stays a skeleton that never resolves, and one that was being
 * refetched because something invalidated it quietly keeps its old data.
 */
export function resumeQueries(queryClient: QueryClient, interrupted: readonly QueryKey[]): void {
  for (const queryKey of interrupted) {
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }
}

/**
 * How many mutations under `mutationKey` whose variables carry `item` (e.g. `{ postId }`) are
 * still running, the calling one included (its callbacks run before it counts as settled). A
 * toggle that is not the latest for its item leaves the final word to the latest one.
 */
export function runningToggles(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  item: Readonly<Record<string, string>>,
): number {
  return queryClient.isMutating({
    mutationKey,
    predicate: ({ state }) => {
      const variables: unknown = state.variables;
      if (typeof variables !== 'object' || variables === null) return false;
      return Object.entries(item).every(([field, id]) => {
        const value: unknown = Reflect.get(variables, field);
        return value === id;
      });
    },
  });
}
