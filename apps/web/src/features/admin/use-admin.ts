import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { ReportStatus } from '@the-mesh/shared';
import { toast } from 'sonner';
import {
  adminDeleteComment,
  adminDeletePost,
  dismissReport,
  fetchAdminReports,
  resolveReport,
  suspendMember,
  unsuspendMember,
} from '@/lib/api/admin';
import { NO_CURSOR } from '@/lib/infinite';
import { queryKeys } from '@/lib/query-keys';

export const adminReportsQueryOptions = (status: ReportStatus) =>
  infiniteQueryOptions({
    queryKey: queryKeys.admin.reports(status),
    queryFn: ({ pageParam, signal }) => fetchAdminReports(status, { cursor: pageParam, signal }),
    initialPageParam: NO_CURSOR,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

export function useAdminReports(status: ReportStatus) {
  return useInfiniteQuery(adminReportsQueryOptions(status));
}

/** Every admin action changes the queue, so the lists are refetched rather than patched. */
function useAdminAction<Input>(
  run: (input: Input) => Promise<unknown>,
  done: string,
  failed: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      toast.success(done);
    },
    onError: () => toast.error(failed),
  });
}

export function useSettleReport() {
  return useAdminAction(
    ({ id, outcome }: { id: string; outcome: 'resolved' | 'dismissed' }) =>
      outcome === 'resolved' ? resolveReport(id) : dismissReport(id),
    'Report settled',
    'Could not settle the report',
  );
}

export function useAdminDelete() {
  return useAdminAction(
    ({ type, id }: { type: 'post' | 'comment'; id: string }) =>
      type === 'post' ? adminDeletePost(id) : adminDeleteComment(id),
    'Removed',
    'Could not remove it',
  );
}

export function useSuspension() {
  return useAdminAction(
    ({ id, suspended }: { id: string; suspended: boolean }) =>
      suspended ? unsuspendMember(id) : suspendMember(id),
    'Done',
    'Could not change the suspension',
  );
}
