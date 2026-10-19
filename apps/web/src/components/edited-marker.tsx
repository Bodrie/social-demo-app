import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';
import type { RevisionList } from '@the-mesh/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { NO_CURSOR, flattenPages } from '@/lib/infinite';

type EditedMarkerProps = {
  editedAt: string;
  queryKey: QueryKey;
  /** Loads a page of previous versions; only called once the history is opened. */
  fetchRevisions: (options: { cursor?: string; signal?: AbortSignal }) => Promise<RevisionList>;
};

/** "edited" next to a timestamp; opens the list of previous versions, older ones on demand. */
export function EditedMarker({ editedAt, queryKey, fetchRevisions }: EditedMarkerProps) {
  const [open, setOpen] = useState(false);
  const history = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchRevisions({ cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: open,
  });
  const revisions = flattenPages(history.data);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
          title={`Edited ${formatDateTime(editedAt)}`}
        >
          edited
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Edit history</div>
        <div className="max-h-72 overflow-y-auto">
          {history.isPending ? (
            <div className="space-y-2 p-3" aria-hidden="true">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ) : history.isError ? (
            <p className="text-destructive p-3 text-sm">Could not load the history.</p>
          ) : revisions.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">No previous versions.</p>
          ) : (
            <>
              <ol aria-label="Previous versions" className="divide-y">
                {revisions.map((revision) => (
                  <li key={revision.id} className="space-y-1 px-3 py-2">
                    <p className="text-muted-foreground text-xs">
                      Until{' '}
                      <time dateTime={revision.editedAt} title={formatDateTime(revision.editedAt)}>
                        {formatRelativeTime(revision.editedAt)}
                      </time>
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap">{revision.content}</p>
                  </li>
                ))}
              </ol>
              {history.hasNextPage ? (
                <div className="border-t p-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    disabled={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                  >
                    {history.isFetchingNextPage ? 'Loading…' : 'Show older versions'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
