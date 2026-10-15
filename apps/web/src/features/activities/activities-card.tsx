import { cn } from 'cn';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityItem } from './activity-item';
import { useActivities } from './use-activities';

const PREVIEW_COUNT = 6;

/** Sidebar preview of the latest activity; the Activity page has the full list. */
export function ActivitiesCard({ className }: { className?: string }) {
  const activities = useActivities();
  const items = activities.data?.pages[0]?.items.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="px-4">
        <CardTitle>Latest activity</CardTitle>
        <CardAction>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to="/activity">See all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        {activities.isPending ? (
          <ul className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <li key={index} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </li>
            ))}
          </ul>
        ) : activities.isError ? (
          <p className="text-muted-foreground text-sm">Could not load the activity.</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing yet. Follow people to see what they are up to.
          </p>
        ) : (
          <ul aria-label="Latest activity" className="space-y-3">
            {items.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
