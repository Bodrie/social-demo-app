import {
  type AdminReport,
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  type ReportStatus,
} from '@beso/shared';
import { cn } from 'cn';
import { InboxIcon, Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserLink } from '@/components/user-link';
import { useCurrentUser } from '@/features/auth/current-user';
import { NotFoundPage } from '@/features/not-found/not-found-page';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { flattenPages } from '@/lib/infinite';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { usePageTitle } from '@/lib/use-page-title';
import { useAdminDelete, useAdminReports, useSettleReport, useSuspension } from './use-admin';

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/** `/admin`: the reports queue (ADR 0016). Members get the same page as any unknown address. */
export function AdminPage() {
  const me = useCurrentUser();
  return me.role === 'admin' ? <ReportsQueue /> : <NotFoundPage />;
}

function ReportsQueue() {
  usePageTitle('Admin');
  const [status, setStatus] = useState<ReportStatus>('open');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">
          What members flagged. Settle a report once you have looked at it; removing content or
          suspending a member is a separate step.
        </p>
        <fieldset className="mt-3 flex gap-1">
          <legend className="sr-only">Status</legend>
          {REPORT_STATUSES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={status === value ? 'secondary' : 'ghost'}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {STATUS_LABELS[value]}
            </Button>
          ))}
        </fieldset>
      </div>
      <ReportList status={status} />
    </div>
  );
}

function ReportList({ status }: { status: ReportStatus }) {
  const reports = useAdminReports(status);
  const sentinelRef = useInfiniteScroll({
    enabled: reports.hasNextPage && !reports.isFetchingNextPage,
    onReachEnd: () => void reports.fetchNextPage(),
  });

  if (reports.isPending) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }
  if (reports.isError) {
    return (
      <ErrorState message="Could not load the reports." onRetry={() => void reports.refetch()} />
    );
  }
  const items = flattenPages(reports.data);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title={`No ${STATUS_LABELS[status].toLowerCase()} reports`}
        description={status === 'open' ? 'Nothing waits for you.' : 'Nothing here yet.'}
      />
    );
  }
  return (
    <div>
      <ul aria-label="Reports" aria-busy={reports.isFetchingNextPage} className="space-y-3">
        {items.map((report) => (
          <ReportItem key={report.id} report={report} />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {reports.isFetchingNextPage ? (
        <div className="text-muted-foreground flex justify-center py-4">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading more</span>
        </div>
      ) : null}
    </div>
  );
}

const TARGET_NAMES = { post: 'Post', comment: 'Comment', user: 'Member' } as const;

function targetLink(report: AdminReport): string | null {
  const { target } = report;
  if (target.gone) return null;
  if (target.type === 'post') return `/p/${target.id}`;
  if (target.type === 'comment')
    return target.postId ? `/p/${target.postId}?comment=${target.id}` : null;
  return target.member ? `/u/${target.member.username}` : null;
}

function ReportItem({ report }: { report: AdminReport }) {
  const me = useCurrentUser();
  const settle = useSettleReport();
  const remove = useAdminDelete();
  const suspension = useSuspension();
  const { target } = report;
  const link = targetLink(report);
  const removable = !target.gone && target.type !== 'user' ? target.type : null;
  const member = target.member;
  const busy = settle.isPending || remove.isPending || suspension.isPending;

  return (
    <li className="bg-card space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{REPORT_REASON_LABELS[report.reason]}</Badge>
        <span>
          by <UserLink user={report.reporter} />
        </span>
        <time
          dateTime={report.createdAt}
          title={formatDateTime(report.createdAt)}
          className="text-muted-foreground text-xs"
        >
          {formatRelativeTime(report.createdAt)}
        </time>
        {report.status !== 'open' ? (
          <Badge variant="outline" className="ml-auto">
            {STATUS_LABELS[report.status]}
          </Badge>
        ) : null}
      </div>
      {report.details ? (
        <p className="text-sm break-words whitespace-pre-wrap">{report.details}</p>
      ) : null}
      <div className={cn('rounded-lg border p-3 text-sm', target.gone && 'border-dashed')}>
        <p className="text-muted-foreground text-xs font-medium uppercase">
          {TARGET_NAMES[target.type]}
          {member ? (
            <>
              {' · '}
              <UserLink user={member} />
              {member.suspended ? (
                <Badge variant="destructive" className="ml-2">
                  Suspended
                </Badge>
              ) : null}
            </>
          ) : null}
        </p>
        {target.gone ? (
          <p className="text-muted-foreground mt-1">
            This {TARGET_NAMES[target.type].toLowerCase()} is gone.
          </p>
        ) : target.excerpt !== null && link ? (
          <Link to={link} className="mt-1 block break-words hover:underline">
            “{target.excerpt}”
          </Link>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {report.status === 'open' ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => settle.mutate({ id: report.id, outcome: 'resolved' })}
            >
              Resolve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => settle.mutate({ id: report.id, outcome: 'dismissed' })}
            >
              Dismiss
            </Button>
          </>
        ) : null}
        {removable ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => remove.mutate({ type: removable, id: target.id })}
          >
            Delete {TARGET_NAMES[target.type].toLowerCase()}
          </Button>
        ) : null}
        {member && member.id !== me.id ? (
          <Button
            type="button"
            size="sm"
            variant={member.suspended ? 'outline' : 'destructive'}
            disabled={busy}
            onClick={() => suspension.mutate({ id: member.id, suspended: member.suspended })}
          >
            {member.suspended ? 'Unsuspend member' : 'Suspend member'}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
